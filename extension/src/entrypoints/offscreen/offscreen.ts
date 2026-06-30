/// <reference types="chrome" />

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SegmentData {
  url: string;
  data: Uint8Array;
  timestamp: number;
  duration?: number;
}

interface MuxRequestPayload {
  recordingId: string;
  segments: SegmentData[];
  outputFormat: 'mp4' | 'mkv';
  codec?: string;
}

interface ProgressEvent {
  type: 'MUX_PROGRESS';
  recordingId: string;
  progress: number; // 0-1
  phase: 'loading_ffmpeg' | 'writing_input' | 'encoding' | 'finalizing';
}

interface CompletionEvent {
  type: 'MUX_COMPLETE';
  recordingId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  duration: number; // seconds
}

interface ErrorEvent {
  type: 'MUX_ERROR';
  recordingId: string;
  message: string;
}

// ─── FFmpeg Singleton ────────────────────────────────────────────────────────

let ffmpeg: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    const ff = new FFmpeg();

    // Listen for FFmpeg progress events and forward them
    ff.on('progress', ({ progress, time }) => {
      // progress is 0-1 from FFmpeg
      sendProgress({
        type: 'MUX_PROGRESS',
        recordingId: currentRecordingId,
        progress,
        phase: 'encoding',
      });
    });

    // Load FFmpeg core from files bundled inside the extension (not a remote
    // CDN) — the Chrome Web Store rejects extensions that fetch executable
    // code from outside the packaged extension.
    const baseURL = chrome.runtime.getURL('/ffmpeg');
    await ff.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpeg = ff;
    updateStatus('FFmpeg loaded and ready');
    return ff;
  })();

  return ffmpegLoadPromise;
}

// ─── State ───────────────────────────────────────────────────────────────────

let currentRecordingId = '';

function updateStatus(message: string): void {
  const el = document.getElementById('status');
  if (el) {
    el.textContent = message;
  }
  console.log(`[Kapowie Offscreen] ${message}`);
}

function sendProgress(event: ProgressEvent): void {
  chrome.runtime.sendMessage(event).catch((err) => {
    console.warn('[Kapowie Offscreen] Failed to send progress:', err);
  });
}

function sendCompletion(event: CompletionEvent): void {
  // We can't send Blob directly over chrome.runtime.sendMessage in all cases,
  // so we convert to ArrayBuffer for transfer, then reconstruct on the other side.
  event.blob.arrayBuffer().then((buffer) => {
    chrome.runtime.sendMessage({
      type: event.type,
      recordingId: event.recordingId,
      mimeType: event.mimeType,
      size: event.size,
      duration: event.duration,
      data: buffer,
    }).catch((err) => {
      console.warn('[Kapowie Offscreen] Failed to send completion:', err);
    });
  });
}

function sendError(event: ErrorEvent): void {
  chrome.runtime.sendMessage(event).catch((err) => {
    console.warn('[Kapowie Offscreen] Failed to send error:', err);
  });
}

// ─── Muxing ──────────────────────────────────────────────────────────────────

/**
 * Mux an array of TS segments into a single MP4 (or MKV) file using FFmpeg.
 *
 * @param payload - The mux request containing segments and output config
 * @returns Information about the produced file
 */
async function muxSegments(payload: MuxRequestPayload): Promise<CompletionEvent> {
  const { recordingId, segments, outputFormat } = payload;
  currentRecordingId = recordingId;

  updateStatus(`Loading FFmpeg… (${segments.length} segments)`);
  sendProgress({ type: 'MUX_PROGRESS', recordingId, progress: 0, phase: 'loading_ffmpeg' });

  const ff = await getFFmpeg();

  // Clean up any previous files
  try {
    await ff.deleteFile('input.ts');
  } catch {
    // file may not exist — ignore
  }
  try {
    await ff.deleteFile(`output.${outputFormat}`);
  } catch {
    // file may not exist — ignore
  }

  // Write all segments into a single concatenated input file
  updateStatus(`Writing ${segments.length} segments to FFmpeg virtual FS…`);
  sendProgress({ type: 'MUX_PROGRESS', recordingId, progress: 0.1, phase: 'writing_input' });

  // Concatenate segments into one buffer
  const totalLength = segments.reduce((sum, s) => sum + s.data.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const segment of segments) {
    combined.set(segment.data, offset);
    offset += segment.data.byteLength;
  }

  await ff.writeFile('input.ts', combined);

  updateStatus('Encoding to MP4…');
  sendProgress({ type: 'MUX_PROGRESS', recordingId, progress: 0.2, phase: 'encoding' });

  // Run FFmpeg: concat TS segments → MP4
  // -i input.ts: the concatenated transport stream
  // -c copy: stream copy (no re-encoding) — fast, preserves quality
  // -bsf:a aac_adtstoasc: fix AAC audio bitstream for MP4 container
  // -movflags +faststart: move moov atom to beginning for streaming
  const outputName = `output.${outputFormat}`;
  const ffmpegArgs = [
    '-i', 'input.ts',
    '-c', 'copy',
    '-bsf:a', 'aac_adtstoasc',
    '-movflags', '+faststart',
    outputName,
  ];

  await ff.exec(ffmpegArgs);

  updateStatus('Finalizing output…');
  sendProgress({ type: 'MUX_PROGRESS', recordingId, progress: 0.95, phase: 'finalizing' });

  // Read the output file
  const outputData = await ff.readFile(outputName) as Uint8Array;

  // Calculate approximate duration from segment metadata
  const totalDuration = segments.reduce((sum, s) => sum + (s.duration ?? 0), 0);

  // Clean up virtual FS
  try {
    await ff.deleteFile('input.ts');
    await ff.deleteFile(outputName);
  } catch {
    // ignore cleanup errors
  }

  // Copy into a fresh Uint8Array so the buffer has a concrete ArrayBuffer backing
  // (required by strict BlobPart typing in some TS versions).
  const outputBytes = outputData.slice();
  const mimeType = outputFormat === 'mp4' ? 'video/mp4' : 'video/x-matroska';

  updateStatus(`Mux complete — ${(outputBytes.byteLength / 1024 / 1024).toFixed(1)} MB`);

  return {
    type: 'MUX_COMPLETE',
    recordingId,
    blob: new Blob([outputBytes], { type: mimeType }),
    mimeType,
    size: outputBytes.byteLength,
    duration: totalDuration,
  };
}

// ─── Message Handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    case 'MUX_SEGMENTS': {
      const muxPayload = payload as MuxRequestPayload;
      muxSegments(muxPayload)
        .then((result) => {
          sendResponse({ success: true, result });
        })
        .catch((err: Error) => {
          console.error('[Kapowie Offscreen] Mux failed:', err);
          sendError({
            type: 'MUX_ERROR',
            recordingId: muxPayload.recordingId,
            message: err.message,
          });
          sendResponse({ success: false, error: err.message });
        });
      return true; // async response
    }

    case 'PING': {
      sendResponse({ success: true, status: 'ok' });
      break;
    }

    default:
      sendResponse({ success: false, error: `Unknown message type: ${type}` });
  }
});

// ─── Ready ───────────────────────────────────────────────────────────────────

updateStatus('Offscreen document ready — waiting for commands');
console.log('[Kapowie Offscreen] Offscreen document initialised');
