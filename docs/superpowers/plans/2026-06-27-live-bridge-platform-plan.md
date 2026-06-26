# Live Stream Recorder & Re-streamer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the spec’s live stream recording and re-streaming platform end-to-end across the Chrome extension and Windows desktop app, then harden it with tests and operational safeguards.

**Architecture:** Start with the extension’s capture pipeline because it has the widest reach and proves the browser-first flow. Add a shared recording model and persistence layer, then implement muxing, local serving, and desktop-native equivalents using the same interfaces so the UI and tests stay aligned.

**Tech Stack:** TypeScript, WXT, Svelte, IndexedDB via `idb`, FFmpeg.wasm, Vite, Rust, Tauri, `reqwest`, `tokio`, ffmpeg, mediamtx/RTSP, Vitest, Svelte check, TypeScript strict mode.

## Global Constraints

- Chrome extension is the primary product.
- Windows desktop app is the secondary product.
- DRM-protected streams are not supported.
- Browser mode has an approximate ~2GB output limit.
- Local processing only unless an explicit cloud upload feature is being implemented.
- Recording and re-streaming flows must preserve local-only security expectations.
- Code should remain TypeScript strict where already enforced.
- UI should stay aligned to the Kapowie dark navy / purple / blue brand system.

---

### Task 1: Normalize Shared Stream and Recording Contracts

**Files:**
- Create: `shared/types/stream.ts`
- Create: `shared/types/recording.ts`
- Modify: `shared/types/index.ts`
- Modify: `extension/src/types/index.ts`
- Modify: `desktop/src/stores/app.ts`
- Modify: `extension/src/entrypoints/background/index.ts`

**Interfaces:**
- Consumes: current `StreamInfo`, `Recording`, `Segment`, `RecordingSettings` shapes
- Produces: shared TypeScript contracts used by both apps for stream detection, recording lifecycle, and re-stream status

- [ ] **Step 1: Write the failing type imports**

```ts
import type { StreamInfo, Recording, Segment } from 'shared/types';

const stream: StreamInfo = {
  url: 'https://example.com/live.m3u8',
  type: 'hls',
  quality: 'auto',
};
```

- [ ] **Step 2: Run type check**

Run: `cd extension && npm run type-check`
Expected: fail because the shared contract exports do not exist yet.

- [ ] **Step 3: Implement the shared contracts**

```ts
export interface StreamInfo {
  url: string;
  type: 'hls' | 'dash' | 'direct';
  quality: string;
  pageUrl?: string;
  pageTitle?: string;
  detectedAt?: number;
  metadata?: {
    videoId?: string;
    platform?: string;
    playerUrl?: string;
  };
}

export interface Segment {
  url: string;
  data: Uint8Array;
  timestamp: number;
  duration?: number;
  isEncrypted?: boolean;
  keyUri?: string;
  iv?: string;
}

export interface Recording {
  id: string;
  url: string;
  startTime: Date;
  status: 'recording' | 'paused' | 'completed';
  segments: Segment[];
  streamType: 'hls' | 'dash' | 'direct';
  pageTitle?: string;
  pageUrl?: string;
  totalBytes?: number;
}
```

- [ ] **Step 4: Run type check again**

Run: `cd extension && npm run type-check`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add shared/types extension/src/types desktop/src/stores/app.ts extension/src/entrypoints/background/index.ts
git commit -m "feat: centralize shared stream contracts"
```

### Task 2: Harden Extension Stream Detection

**Files:**
- Modify: `extension/src/entrypoints/content/index.ts`
- Modify: `extension/src/entrypoints/background/index.ts`
- Modify: `extension/src/core/parsers/castr.ts`
- Modify: `extension/src/utils/parsers.ts`
- Create: `extension/src/core/parsers/hls.ts`
- Create: `extension/src/core/parsers/dash.ts`
- Create: `extension/src/__tests__/parsers.test.ts`

**Interfaces:**
- Consumes: shared stream types and `chrome.runtime` messaging
- Produces: normalized stream detection for HLS/DASH/direct URLs with Castr support

- [ ] **Step 1: Write the failing parser tests**

```ts
import { describe, it, expect } from 'vitest';
import { parseHLSMaster, parseHLSMedia } from '../core/parsers/hls';

describe('parseHLSMedia', () => {
  it('detects encrypted segments and key URI', () => {
    const playlist = `#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="https://example.com/key.bin"
#EXTINF:10.0,
segment0.ts`;
    const segments = parseHLSMedia(playlist);
    expect(segments[0].isEncrypted).toBe(true);
    expect(segments[0].keyUri).toBe('https://example.com/key.bin');
  });
});
```

- [ ] **Step 2: Run the parser tests**

Run: `cd extension && npm run test -- --run src/__tests__/parsers.test.ts`
Expected: fail because the parser modules do not exist yet.

- [ ] **Step 3: Implement the parser modules**

```ts
export function parseHLSMedia(content: string): HLSSegment[] {
  // parse #EXTINF, #EXT-X-KEY, media sequence, and segment URLs
}
```

- [ ] **Step 4: Wire detection into the content script**

Use the parser outputs to normalize:
- content-script discovered `video` elements
- webRequest URLs
- Castr embeds

- [ ] **Step 5: Run extension tests and type check**

Run:
- `cd extension && npm run test -- --run`
- `cd extension && npm run type-check`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add extension/src/core/parsers extension/src/utils/parsers.ts extension/src/entrypoints/content/index.ts extension/src/entrypoints/background/index.ts extension/src/__tests__/parsers.test.ts
git commit -m "feat: improve stream detection and parsing"
```

### Task 3: Implement IndexedDB Recording Store

**Files:**
- Modify: `extension/src/utils/storage.ts`
- Create: `extension/src/core/recordings/store.ts`
- Create: `extension/src/core/recordings/history.ts`
- Create: `extension/src/__tests__/storage.test.ts`

**Interfaces:**
- Consumes: `Recording`, `Segment`
- Produces: durable recording persistence, lookup, update, and history APIs

- [ ] **Step 1: Write the failing storage tests**

```ts
import { describe, it, expect } from 'vitest';
import { createRecordingStore } from '../core/recordings/store';

describe('recording store', () => {
  it('persists and restores recordings', async () => {
    const store = createRecordingStore();
    await store.saveRecording(/* ... */);
    const items = await store.listRecordings();
    expect(items).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd extension && npm run test -- --run src/__tests__/storage.test.ts`
Expected: fail.

- [ ] **Step 3: Implement the store**

Provide:
- `saveRecording(recording)`
- `updateRecording(id, patch)`
- `getRecording(id)`
- `listRecordings()`
- `deleteRecording(id)`

- [ ] **Step 4: Run tests and type check**

Run:
- `cd extension && npm run test -- --run src/__tests__/storage.test.ts`
- `cd extension && npm run type-check`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add extension/src/utils/storage.ts extension/src/core/recordings extension/src/__tests__/storage.test.ts
git commit -m "feat: add persistent recording storage"
```

### Task 4: Build the Extension Recording Pipeline

**Files:**
- Modify: `extension/src/entrypoints/background/index.ts`
- Modify: `extension/src/entrypoints/offscreen/offscreen.ts`
- Modify: `extension/src/entrypoints/popup/App.svelte`
- Create: `extension/src/core/downloader/segment-downloader.ts`
- Create: `extension/src/core/recordings/manager.ts`
- Create: `extension/src/core/mux/muxer.ts`
- Create: `extension/src/__tests__/recording-manager.test.ts`

**Interfaces:**
- Consumes: shared recording contracts, parser outputs, storage store
- Produces: complete record/start/pause/resume/stop/download flow in the browser extension

- [ ] **Step 1: Write the failing recording-manager tests**

```ts
describe('recording manager', () => {
  it('creates recording sessions and tracks bytes', () => {
    // create, add segment, pause, resume, stop
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd extension && npm run test -- --run src/__tests__/recording-manager.test.ts`
Expected: fail.

- [ ] **Step 3: Implement the minimal manager and downloader**

```ts
export async function startRecording(stream: StreamInfo): Promise<Recording> { /* ... */ }
export async function stopRecording(id: string): Promise<void> { /* ... */ }
```

- [ ] **Step 4: Add FFmpeg.wasm muxing in the offscreen document**

Mux segment blobs into MP4 and return a blob URL to the service worker.

- [ ] **Step 5: Run extension build and tests**

Run:
- `cd extension && npm run test -- --run`
- `cd extension && npm run build`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add extension/src/entrypoints/background/index.ts extension/src/entrypoints/offscreen extension/src/entrypoints/popup/App.svelte extension/src/core/downloader extension/src/core/recordings extension/src/core/mux extension/src/__tests__/recording-manager.test.ts
git commit -m "feat: implement browser recording pipeline"
```

### Task 5: Add Local Re-streaming in the Extension

**Files:**
- Modify: `extension/src/entrypoints/background/index.ts`
- Create: `extension/src/core/restream/http-server.ts`
- Create: `extension/src/core/restream/hls-manifest.ts`
- Create: `extension/src/core/restream/websocket-proxy.ts`
- Create: `extension/src/__tests__/restream.test.ts`

**Interfaces:**
- Consumes: active recording segments
- Produces: local HLS playback URL and HTTP/WebSocket serving of live segments

- [ ] **Step 1: Write the failing restream tests**
- [ ] **Step 2: Implement the local HLS serving layer**
- [ ] **Step 3: Wire the popup to show the local URL and QR-ready copy**
- [ ] **Step 4: Run tests and build**
- [ ] **Step 5: Commit**

### Task 6: Implement Desktop Native Recording and Serving

**Files:**
- Modify: `desktop/src-tauri/src/main.rs`
- Modify: `desktop/src-tauri/src/commands/*.rs`
- Create: `desktop/src-tauri/src/core/manifest.rs`
- Create: `desktop/src-tauri/src/core/downloader.rs`
- Create: `desktop/src-tauri/src/core/mux.rs`
- Create: `desktop/src-tauri/src/core/restream_server.rs`
- Create: `desktop/src-tauri/src/core/scheduler.rs`
- Create: `desktop/src-tauri/src/core/history.rs`
- Create: `desktop/src-tauri/src/core/mod.rs`
- Create: `desktop/src-tauri/src/commands/recording.rs`
- Create: `desktop/src-tauri/src/commands/restream.rs`
- Create: `desktop/src-tauri/src/commands/capture.rs`
- Create: `desktop/src-tauri/src/commands/mod.rs`

**Interfaces:**
- Consumes: stream URLs, recording settings, history
- Produces: Rust backend for manifest parsing, downloads, muxing, recording history, and local RTSP/HLS serving

- [ ] **Step 1: Add failing Rust unit tests for manifest parsing and session lifecycle**
- [ ] **Step 2: Implement the manifest/download/mux modules**
- [ ] **Step 3: Expose Tauri commands to the Svelte frontend**
- [ ] **Step 4: Run desktop build and Rust tests**
- [ ] **Step 5: Commit**

### Task 7: Add Desktop RTSP, Scheduling, and Monitoring

**Files:**
- Modify: `desktop/src/components/StreamCapture.svelte`
- Modify: `desktop/src/components/ReStreamUI.svelte`
- Modify: `desktop/src/components/RecordingManager.svelte`
- Modify: `desktop/src/components/Settings.svelte`
- Create: `desktop/src-tauri/src/core/monitor.rs`
- Create: `desktop/src-tauri/src/core/auth.rs`

**Interfaces:**
- Consumes: backend recording/restream services
- Produces: scheduling, stream monitor, password protection, and local playback status

- [ ] **Step 1: Add tests for scheduler and monitor behavior**
- [ ] **Step 2: Implement auto-record triggers**
- [ ] **Step 3: Add password protection for local servers**
- [ ] **Step 4: Run build and tests**
- [ ] **Step 5: Commit**

### Task 8: Add Cloud Upload and Metadata Extraction

**Files:**
- Create: `extension/src/core/cloud/google-drive.ts`
- Create: `extension/src/core/cloud/s3.ts`
- Create: `desktop/src-tauri/src/core/cloud.rs`
- Create: `desktop/src-tauri/src/core/metadata.rs`

**Interfaces:**
- Consumes: completed recordings
- Produces: optional upload and metadata capture pipelines

- [ ] **Step 1: Add tests for upload request construction and metadata extraction**
- [ ] **Step 2: Implement providers**
- [ ] **Step 3: Add settings UI toggles**
- [ ] **Step 4: Run tests**
- [ ] **Step 5: Commit**

### Task 9: Raise Test Coverage and Reliability

**Files:**
- Modify: `extension/src/__tests__/*.ts`
- Modify: `desktop/src-tauri/src/**/*.rs`
- Modify: `desktop/src/**/*.svelte`
- Create: coverage config if needed

**Interfaces:**
- Consumes: all implemented core modules
- Produces: coverage-targeted unit and integration tests with stable CI gates

- [ ] **Step 1: Identify coverage gaps by file**
- [ ] **Step 2: Add focused tests for parser, store, manager, mux, restream, scheduler**
- [ ] **Step 3: Add CI coverage reporting**
- [ ] **Step 4: Run the full test suite**
- [ ] **Step 5: Commit**

### Task 10: Polish and Brand Consistency Pass

**Files:**
- Modify: extension and desktop UI files
- Modify: shared brand assets if needed

**Interfaces:**
- Consumes: fully functional platform
- Produces: final UI and brand tuning across all screens

- [ ] **Step 1: Harmonize typography, spacing, and surfaces**
- [ ] **Step 2: Refine state colors and iconography**
- [ ] **Step 3: Run visual smoke tests and final build**
- [ ] **Step 4: Commit**

## Spec Coverage Check

- Chrome extension recording flow: Task 1, 2, 3, 4
- Extension re-streaming: Task 5
- Desktop recording and RTSP serving: Task 6, 7
- Schedule recording and monitoring: Task 7
- Metadata extraction: Task 8
- Cloud upload: Task 8
- Download history and search/filter: Task 3, 6, 9
- Notifications: Task 7 or follow-on if needed
- Quality and coverage target: Task 9
- Visual polish: Task 10

