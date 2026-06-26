/// <reference types="chrome" />

import type { Recording, Segment, RecordingSettings } from '../types';

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const KEYS = {
  RECORDINGS: 'kapowie:recordings',
  SETTINGS: 'kapowie:settings',
  SEGMENTS_PREFIX: 'kapowie:segments:',
  META_PREFIX: 'kapowie:meta:',
} as const;

// ─── IndexedDB Segment Storage ────────────────────────────────────────────────

const DB_NAME = 'kapowie';
const DB_VERSION = 1;
const STORE_SEGMENTS = 'segments';
const STORE_META = 'metadata';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SEGMENTS)) {
        db.createObjectStore(STORE_SEGMENTS);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store segment data in IndexedDB. Uses a composite key of recordingId + segment index.
 */
export async function storeSegmentData(
  recordingId: string,
  segmentIndex: number,
  data: Uint8Array
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_SEGMENTS, 'readwrite');
  const store = tx.objectStore(STORE_SEGMENTS);

  return new Promise((resolve, reject) => {
    const request = store.put(data, `${recordingId}:${segmentIndex}`);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve segment data from IndexedDB.
 */
export async function getSegmentData(
  recordingId: string,
  segmentIndex: number
): Promise<Uint8Array | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_SEGMENTS, 'readonly');
  const store = tx.objectStore(STORE_SEGMENTS);

  return new Promise((resolve, reject) => {
    const request = store.get(`${recordingId}:${segmentIndex}`);
    request.onsuccess = () => resolve(request.result as Uint8Array | null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete all segment data for a recording.
 */
export async function deleteSegmentData(recordingId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_SEGMENTS, 'readwrite');
  const store = tx.objectStore(STORE_SEGMENTS);

  // Get all keys for this recording and delete them
  const range = IDBKeyRange.bound(
    `${recordingId}:0`,
    `${recordingId}:\uFFFF`,
    false,
    true
  );

  return new Promise((resolve, reject) => {
    const request = store.openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store the concatenated segment data in IndexedDB.
 * For recordings with many segments, we batch them across multiple records.
 */
export async function storeSegmentsBatch(
  recordingId: string,
  segments: Segment[],
  batchSizeBytes = 50 * 1024 * 1024 // 50MB per batch
): Promise<number> {
  let batchBuffer = new Uint8Array(0);
  let batchIndex = 0;

  for (const segment of segments) {
    // Concatenate segment data into batch buffer
    const newBuffer = new Uint8Array(batchBuffer.byteLength + segment.data.byteLength);
    newBuffer.set(batchBuffer);
    newBuffer.set(segment.data, batchBuffer.byteLength);
    batchBuffer = newBuffer;

    // Flush batch if it exceeds limit
    if (batchBuffer.byteLength >= batchSizeBytes) {
      await storeSegmentData(recordingId, batchIndex++, batchBuffer);
      batchBuffer = new Uint8Array(0);
    }
  }

  // Flush remaining
  if (batchBuffer.byteLength > 0) {
    await storeSegmentData(recordingId, batchIndex++, batchBuffer);
  }

  return batchIndex;
}

/**
 * Retrieve total estimated byte size of a recording's segments from IndexedDB.
 */
export async function getStoredSize(recordingId: string): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_SEGMENTS, 'readonly');
  const store = tx.objectStore(STORE_SEGMENTS);
  const range = IDBKeyRange.bound(
    `${recordingId}:0`,
    `${recordingId}:\uFFFF`,
    false,
    true
  );

  return new Promise((resolve, reject) => {
    let total = 0;
    const request = store.openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const data = cursor.value as Uint8Array;
        total += data.byteLength;
        cursor.continue();
      } else {
        resolve(total);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// ─── Chrome Storage: Settings ─────────────────────────────────────────────────

/**
 * Persist extension settings to chrome.storage.local.
 */
export async function saveSettings(settings: RecordingSettings): Promise<void> {
  await chrome.storage.local.set({ [KEYS.SETTINGS]: settings });
}

/**
 * Load extension settings from chrome.storage.local.
 * Returns defaults if not found.
 */
export async function loadSettings(defaults: RecordingSettings): Promise<RecordingSettings> {
  const result = await chrome.storage.local.get(KEYS.SETTINGS);
  return (result[KEYS.SETTINGS] as RecordingSettings) || defaults;
}

// ─── Chrome Storage: Recording Metadata ────────────────────────────────────────
// Note: Recording metadata (without segment blobs) is stored in chrome.storage.local
// or session storage. Segment blobs stay in IndexedDB.

/**
 * Save recording metadata to chrome.storage.session for fast access.
 * Falls back to chrome.storage.local if session storage is not available.
 */
export async function saveRecordingMeta(recording: Recording): Promise<void> {
  // Store only metadata, not segment data
  const meta = {
    id: recording.id,
    url: recording.url,
    startTime: recording.startTime instanceof Date
      ? recording.startTime.toISOString()
      : recording.startTime,
    status: recording.status,
    streamType: recording.streamType,
    pageTitle: recording.pageTitle,
    pageUrl: recording.pageUrl,
    totalBytes: recording.totalBytes,
    segmentUrlsCount: recording.segments.length,
  };

  await chrome.storage.session.set({ [KEYS.META_PREFIX + recording.id]: meta });
}

/**
 * Load recording metadata from storage.
 */
export async function loadRecordingMeta(recordingId: string): Promise<Record<string, unknown> | null> {
  const result = await chrome.storage.session.get(KEYS.META_PREFIX + recordingId);
  return result[KEYS.META_PREFIX + recordingId] as Record<string, unknown> | null;
}

/**
 * List all stored recording IDs.
 */
export async function listRecordingIds(): Promise<string[]> {
  const all = await chrome.storage.session.get(null);
  return Object.keys(all)
    .filter((k) => k.startsWith(KEYS.META_PREFIX))
    .map((k) => k.slice(KEYS.META_PREFIX.length));
}

/**
 * Delete all storage associated with a recording.
 */
export async function deleteRecordingStorage(recordingId: string): Promise<void> {
  await deleteSegmentData(recordingId);
  await chrome.storage.session.remove(KEYS.META_PREFIX + recordingId);
}

// ─── Storage Usage Estimation ─────────────────────────────────────────────────

/**
 * Estimate current storage usage.
 */
export async function estimateStorageUsage(): Promise<{
  used: number;
  quota: number;
  segmentStoreBytes: number;
}> {
  const segmentStoreBytes = await getTotalSegmentStoreSize();

  let used = 0;
  let quota = 0;

  if (navigator.storage && navigator.storage.estimate) {
    const est = await navigator.storage.estimate();
    used = est.usage || 0;
    quota = est.quota || 500 * 1024 * 1024; // default 500MB
  }

  return { used, quota, segmentStoreBytes };
}

async function getTotalSegmentStoreSize(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_SEGMENTS, 'readonly');
  const store = tx.objectStore(STORE_SEGMENTS);

  return new Promise((resolve, reject) => {
    let total = 0;
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const data = cursor.value as Uint8Array;
        total += data.byteLength;
        cursor.continue();
      } else {
        resolve(total);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// ─── In-Memory Segment Buffer (for active capture) ────────────────────────────

/**
 * Ring buffer of segments for active recording.
 * Limits memory usage by capping the number of segments held in memory
 * before flushing to IndexedDB.
 */
export class SegmentBuffer {
  private buffer: Segment[] = [];
  private maxSegments: number;
  private flushCallback: (segments: Segment[]) => Promise<void>;
  private currentBytes = 0;

  constructor(
    maxSegments: number,
    flushCallback: (segments: Segment[]) => Promise<void>
  ) {
    this.maxSegments = maxSegments;
    this.flushCallback = flushCallback;
  }

  add(segment: Segment): void {
    this.buffer.push(segment);
    this.currentBytes += segment.data.byteLength;

    if (this.buffer.length >= this.maxSegments) {
      this.flush().catch(console.error); // fire and forget
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const segments = this.buffer.splice(0);
    this.currentBytes = 0;
    await this.flushCallback(segments);
  }

  get size(): number {
    return this.buffer.length;
  }

  get byteSize(): number {
    return this.currentBytes;
  }

  clear(): void {
    this.buffer = [];
    this.currentBytes = 0;
  }

  peek(): readonly Segment[] {
    return this.buffer;
  }
}
