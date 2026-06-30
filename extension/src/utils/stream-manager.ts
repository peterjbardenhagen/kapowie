/// <reference types="chrome" />

import type { StreamInfo, Recording } from '../types';
import { KeyCache } from './crypto';
import { DownloadManager } from './downloader';
import { parseHLSManifest, parseDASHManifest, computeDASHSegmentUrl, selectVariant } from './parsers';
import { storeSegmentsBatch, SegmentBuffer } from './storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecordingState =
  | 'idle'
  | 'fetching_manifest'
  | 'downloading'
  | 'paused'
  | 'error'
  | 'completed';

export interface RecordedSegment {
  url: string;
  data: Uint8Array;
  timestamp: number;
  duration?: number;
  isEncrypted?: boolean;
  keyUri?: string;
  iv?: string;
}

export interface RecordingSession {
  recording: Recording;
  state: RecordingState;
  segmentBuffer?: SegmentBuffer;
  errors: string[];
  downloadedBytes: number;
}

export interface StreamManagerOptions {
  maxConcurrentDownloads: number;
  manifestPollIntervalMs: number;
  maxMemorySegments: number;
  onSessionUpdate: (session: RecordingSession) => void;
  onError: (recordingId: string, error: string) => void;
}

// ─── Stream Manager ───────────────────────────────────────────────────────────

/**
 * Central stream management service. Handles lifecycle of stream detection,
 * manifest polling, segment fetching/decryption, and recording state.
 */
export class StreamManager {
  private static readonly MAX_STORED_ERRORS = 20;
  private static readonly MAX_CONSECUTIVE_ERRORS = 10;

  private sessions = new Map<string, RecordingSession>();
  private keyCache = new KeyCache(64);
  private downloadManager: DownloadManager;
  private options: StreamManagerOptions;
  private abortControllers = new Map<string, AbortController>();

  constructor(options: Partial<StreamManagerOptions> = {}) {
    this.options = {
      maxConcurrentDownloads: 6,
      manifestPollIntervalMs: 2000,
      maxMemorySegments: 100,
      onSessionUpdate: () => {},
      onError: () => {},
      ...options,
    };

    this.downloadManager = new DownloadManager(
      this.options.maxConcurrentDownloads,
      0, // no rate limit
      3  // retry count
    );
  }

  /**
   * Begin recording a stream. Fetches the initial manifest and starts polling.
   */
  async startRecording(stream: StreamInfo, quality: string): Promise<Recording> {
    const id = crypto.randomUUID();
    const recording: Recording = {
      id,
      url: stream.url,
      startTime: new Date(),
      status: 'recording',
      segments: [],
      streamType: stream.type,
      pageTitle: stream.pageTitle,
      pageUrl: stream.pageUrl,
      totalBytes: 0,
    };

    const session: RecordingSession = {
      recording,
      state: 'fetching_manifest',
      errors: [],
      downloadedBytes: 0,
    };

    this.sessions.set(id, session);
    this.options.onSessionUpdate(session);

    const abortController = new AbortController();
    this.abortControllers.set(id, abortController);

    // Start the capture loop (fire and forget)
    this.captureLoop(id, stream, quality, abortController);

    return recording;
  }

  /**
   * Pause a recording. Stops fetching but preserves state.
   */
  pauseRecording(recordingId: string): void {
    const session = this.sessions.get(recordingId);
    if (!session) return;

    session.recording.status = 'paused';
    session.state = 'paused';
    this.options.onSessionUpdate(session);
  }

  /**
   * Resume a paused recording.
   */
  resumeRecording(recordingId: string): void {
    const session = this.sessions.get(recordingId);
    if (!session) return;

    session.recording.status = 'recording';
    session.state = 'fetching_manifest';
    this.options.onSessionUpdate(session);
  }

  /**
   * Stop a recording. Cleans up resources.
   */
  stopRecording(recordingId: string): Recording | undefined {
    const session = this.sessions.get(recordingId);
    if (!session) return undefined;

    // Abort any pending downloads
    const controller = this.abortControllers.get(recordingId);
    if (controller) controller.abort();

    // Flush remaining segments
    if (session.segmentBuffer && session.segmentBuffer.size > 0) {
      session.segmentBuffer.flush().catch((err: Error) => {
        console.error('[StreamManager] Failed to flush segments on stop:', err);
      });
    }

    session.recording.status = 'completed';
    session.state = 'completed';
    this.options.onSessionUpdate(session);

    this.sessions.delete(recordingId);
    this.abortControllers.delete(recordingId);

    return session.recording;
  }

  /**
   * Get all active sessions.
   */
  getActiveSessions(): RecordingSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get a specific session by recording ID.
   */
  getSession(recordingId: string): RecordingSession | undefined {
    return this.sessions.get(recordingId);
  }

  // ─── Private Capture Loop ────────────────────────────────────────────────

  private async captureLoop(
    recordingId: string,
    stream: StreamInfo,
    quality: string,
    abortController: AbortController
  ): Promise<void> {
    const session = this.sessions.get(recordingId);
    if (!session) return;

    // Create segment buffer for batching writes
    const segmentBuffer = new SegmentBuffer(
      this.options.maxMemorySegments,
      async (segments) => {
        try {
          await storeSegmentsBatch(recordingId, segments);
          console.log(`[StreamManager] Flushed ${segments.length} segments to storage`);
        } catch (err) {
          console.error('[SegmentBuffer] Flush error:', err);
        }
      }
    );
    session.segmentBuffer = segmentBuffer;

    let sequenceOffset = 0;
    let consecutiveErrors = 0;

    while (!abortController.signal.aborted) {
      try {
        if (session.state === 'paused') {
          await this.sleep(1000, abortController.signal);
          continue;
        }

        session.state = 'fetching_manifest';
        this.options.onSessionUpdate(session);

        const segments: RecordedSegment[] = [];

        if (stream.type === 'hls') {
          const result = await this.captureHLSSegments(stream, quality, sequenceOffset);
          segments.push(...result.segments);
          sequenceOffset = result.nextOffset;
        } else if (stream.type === 'dash') {
          const result = await this.captureDASHSegments(stream, sequenceOffset);
          segments.push(...result.segments);
          sequenceOffset = result.nextOffset;
        }

        if (segments.length > 0) {
          session.state = 'downloading';
          this.options.onSessionUpdate(session);

          // Process all new segments (decrypt if needed)
          for (const segment of segments) {
            segmentBuffer.add({
              url: segment.url,
              data: segment.data,
              timestamp: segment.timestamp,
              duration: segment.duration,
              isEncrypted: segment.isEncrypted,
              keyUri: segment.keyUri,
              iv: segment.iv,
            });
            session.downloadedBytes += segment.data.byteLength;
            session.recording.totalBytes = session.downloadedBytes;
          }

          // Also push to recording.segments for metadata tracking
          session.recording.segments.push(...segments);
        }

        session.state = 'fetching_manifest';
        this.options.onSessionUpdate(session);
        consecutiveErrors = 0;

        // Poll interval
        await this.sleep(this.options.manifestPollIntervalMs, abortController.signal);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          break; // normal cancellation
        }

        const message = err instanceof Error ? err.message : String(err);
        console.error('[StreamManager] Capture error:', message);
        session.errors.push(message);
        if (session.errors.length > StreamManager.MAX_STORED_ERRORS) {
          session.errors.splice(0, session.errors.length - StreamManager.MAX_STORED_ERRORS);
        }
        this.options.onError(recordingId, message);

        consecutiveErrors++;
        if (consecutiveErrors >= StreamManager.MAX_CONSECUTIVE_ERRORS) {
          session.state = 'error';
          this.options.onSessionUpdate(session);
          break;
        }

        // Back off on error
        await this.sleep(5000, abortController.signal);
      }
    }
  }

  // ─── HLS Capture ─────────────────────────────────────────────────────────

  private async captureHLSSegments(
    stream: StreamInfo,
    quality: string,
    sequenceOffset: number
  ): Promise<{ segments: RecordedSegment[]; nextOffset: number }> {
    // Fetch manifest
    const response = await fetch(stream.url);
    if (!response.ok) {
      throw new Error(`Manifest fetch failed: ${response.status}`);
    }
    const manifestText = await response.text();

    // Parse
    const parsed = parseHLSManifest(manifestText, stream.url);

    // If master playlist, select the right variant first
    if (parsed.isMasterPlaylist && parsed.variants.length > 0) {
      const variant = selectVariant(parsed.variants, quality);
      if (variant) {
        return this.captureHLSSegments({ ...stream, url: variant.url }, quality, sequenceOffset);
      }
    }

    if (parsed.segments.length === 0) {
      return { segments: [], nextOffset: sequenceOffset };
    }

    // Determine which segments are new (not yet downloaded)
    const existingCount = sequenceOffset;
    const newSegments = parsed.segments.slice(existingCount);

    // Download segments
    const segments: RecordedSegment[] = [];
    for (const seg of newSegments) {
      try {
        const data = await this.downloadManager.fetch(seg.url);
        segments.push({
          url: seg.url,
          data,
          timestamp: Date.now(),
          duration: seg.duration,
          isEncrypted: seg.isEncrypted,
          keyUri: seg.keyUri,
          iv: seg.iv,
        });
      } catch (err) {
        console.warn(`[HLS] Segment fetch failed ${seg.url}: ${err}`);
      }
    }

    return { segments, nextOffset: parsed.segments.length };
  }

  // ─── DASH Capture ────────────────────────────────────────────────────────

  private async captureDASHSegments(
    stream: StreamInfo,
    sequenceOffset: number
  ): Promise<{ segments: RecordedSegment[]; nextOffset: number }> {
    const response = await fetch(stream.url);
    if (!response.ok) {
      throw new Error(`MPD fetch failed: ${response.status}`);
    }
    const mpdText = await response.text();

    const parsed = parseDASHManifest(mpdText, stream.url);
    if (parsed.representations.length === 0) {
      return { segments: [], nextOffset: sequenceOffset };
    }

    // Select highest bandwidth video representation
    const videoReprs = parsed.representations
      .filter((r) => (r.mimeType || '').startsWith('video/'))
      .sort((a, b) => b.bandwidth - a.bandwidth);

    const selected = videoReprs[0];
    if (!selected?.segmentTemplate) {
      return { segments: [], nextOffset: sequenceOffset };
    }

    // Compute next segment number based on template
    const startNum = sequenceOffset + selected.segmentTemplate.startNumber;
    const numSegments = 2; // fetch at a time for live edge
    const segments: RecordedSegment[] = [];

    for (let i = 0; i < numSegments; i++) {
      const segmentNumber = startNum + i;
      const url = computeDASHSegmentUrl(
        selected.baseUrl!,
        selected.segmentTemplate,
        selected.id,
        segmentNumber
      );

      try {
        const data = await this.downloadManager.fetch(url);
        segments.push({
          url,
          data,
          timestamp: Date.now(),
          duration: selected.segmentTemplate.duration / selected.segmentTemplate.timescale,
        });
      } catch (err) {
        // Segment may not be available yet (live edge)
        console.warn(`[DASH] Segment fetch failed: ${err}`);
        break;
      }
    }

    return { segments, nextOffset: sequenceOffset + segments.length };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  }

  /**
   * Clean up all sessions and resources.
   */
  dispose(): void {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.sessions.clear();
    this.keyCache.clear();
    this.downloadManager.cancelAll();
  }
}
