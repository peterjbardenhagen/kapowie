/// <reference types="chrome" />

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DownloadOptions {
  url: string;
  headers?: Record<string, string>;
  timeout?: number; // ms
  maxRetries?: number;
  onProgress?: (bytesReceived: number, totalBytes: number) => void;
}

export interface DownloadResult {
  data: Uint8Array;
  contentType: string;
  status: number;
}

export interface ConcurrentDownloadOptions {
  maxConcurrency: number;
  onItemComplete?: (url: string, index: number) => void;
  onItemError?: (url: string, index: number, error: Error) => void;
}

// ─── Single Download ──────────────────────────────────────────────────────────

/**
 * Fetch a remote resource as raw bytes with timeout and retry.
 * Uses fetch API for streaming progress reporting.
 */
export async function downloadBinary(options: DownloadOptions): Promise<DownloadResult> {
  const { url, timeout = 30000, maxRetries = 3 } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: options.headers,
        credentials: 'same-origin',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new DownloadError(`HTTP ${response.status}: ${response.statusText}`, response.status);
      }

      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      const contentType = response.headers.get('content-type') || 'application/octet-stream';

      // Use streaming reader for progress if callback provided and content-length known
      if (options.onProgress && contentLength > 0 && response.body) {
        const data = await downloadWithProgress(response.body, contentLength, options.onProgress);
        return { data, contentType, status: response.status };
      }

      // Fall back to simple arrayBuffer fetch
      const arrayBuffer = await response.arrayBuffer();
      return {
        data: new Uint8Array(arrayBuffer),
        contentType,
        status: response.status,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on abort (timeout) or non-retryable status codes
      if (err instanceof DownloadError && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) {
        throw err;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Timeout — retry
        continue;
      }

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new DownloadError('Download failed after retries', 0);
}

async function downloadWithProgress(
  body: ReadableStream<Uint8Array>,
  totalBytes: number,
  onProgress: (bytesReceived: number, totalBytes: number) => void
): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let bytesReceived = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    bytesReceived += value.byteLength;
    onProgress(bytesReceived, totalBytes);
  }

  // Concatenate all chunks into a single buffer
  const result = new Uint8Array(bytesReceived);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}

// ─── Concurrent Downloads ─────────────────────────────────────────────────────

/**
 * Download multiple URLs with bounded concurrency.
 * Uses a simple limit-based pool to avoid overwhelming the network.
 */
export async function downloadConcurrent<T extends { url: string }>(
  items: T[],
  downloadFn: (item: T) => Promise<Uint8Array>,
  options: ConcurrentDownloadOptions
): Promise<Map<string, Uint8Array>> {
  const { maxConcurrency } = options;
  const results = new Map<string, Uint8Array>();
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      try {
        const data = await downloadFn(item);
        results.set(item.url, data);
        options.onItemComplete?.(item.url, currentIndex);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        options.onItemError?.(item.url, currentIndex, error);
      }
    }
  }

  const workers = Math.min(maxConcurrency, items.length);
  await Promise.all(
    Array.from({ length: workers }, () => worker())
  );

  return results;
}

// ─── Rate-Limited Downloader ──────────────────────────────────────────────────

/**
 * Download manager that respects rate limits and ordering.
 * Ideal for HLS segment fetches where we want to download fast
 * but not overwhelm the origin server.
 */
export class DownloadManager {
  private queue: Array<{
    url: string;
    headers?: Record<string, string>;
    resolve: (data: Uint8Array) => void;
    reject: (error: Error) => void;
    priority: number;
  }> = [];
  private activeCount = 0;
  private activeBytes = 0;

  constructor(
    private maxConcurrent = 6,
    private maxBytesPerSecond = 0, // 0 = unlimited
    private retryCount = 3
  ) {}

  async fetch(url: string, priority = 0): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      this.queue.push({ url, resolve, reject, priority });
      this.queue.sort((a, b) => b.priority - a.priority);
      this.processNext();
    });
  }

  async fetchWithHeaders(url: string, headers?: Record<string, string>, priority = 0): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      this.queue.push({ url, headers, resolve, reject, priority });
      this.queue.sort((a, b) => b.priority - a.priority);
      this.processNext();
    });
  }

  private async processNext() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) return;

    const item = this.queue.shift();
    if (!item) return;

    this.activeCount++;

    try {
      const result = await this.doDownload(item.url, item.headers);
      item.resolve(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      item.reject(error);
    } finally {
      this.activeCount--;
      this.processNext();
    }
  }

  private async doDownload(url: string, headers?: Record<string, string>): Promise<Uint8Array> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        const result = await downloadBinary({
          url,
          headers,
          timeout: 10000,
        });

        // Rate limiting
        if (this.maxBytesPerSecond > 0) {
          this.activeBytes += result.data.byteLength;
          const expectedTime = (result.data.byteLength / this.maxBytesPerSecond) * 1000;
          if (expectedTime > 100) {
            await new Promise((resolve) => setTimeout(resolve, expectedTime));
          }
          this.activeBytes -= result.data.byteLength;
        }

        return result.data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.retryCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }

    throw lastError || new DownloadError('Download failed', 0);
  }

  cancelAll(): void {
    for (const item of this.queue) {
      item.reject(new DownloadError('Cancelled', 0));
    }
    this.queue = [];
  }

  get pending(): number {
    return this.queue.length;
  }

  get active(): number {
    return this.activeCount;
  }
}

// ─── Error Type ──────────────────────────────────────────────────────────────

export class DownloadError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'DownloadError';
  }
}
