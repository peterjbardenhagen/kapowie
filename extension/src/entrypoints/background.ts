import type { ExtensionMessage, StreamInfo, Recording, RecordingSettings } from '../types';

// ─── State ───────────────────────────────────────────────────────────────────

const detectedStreams = new Map<string, StreamInfo>();
const activeRecordings = new Map<string, Recording>();
let restreamActive = false;
let restreamPort = 8124;

const defaultSettings: RecordingSettings = {
  maxQuality: 'best',
  autoDetect: true,
  downloadPath: 'kapowie-recordings',
  restreamPort: 8124,
  restreamEnabled: false,
  segmentLimit: 10000,
  transcodeOutput: false,
};

// ─── Message Router ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ type: 'ERROR', payload: { message: err.message } }));
  return true; // async response
});

async function handleMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender) {
  switch (message.type) {
    case 'STREAM_DETECTED': {
      const payload = message.payload as { streams: StreamInfo[] };
      for (const stream of payload.streams) {
        if (!detectedStreams.has(stream.url)) {
          detectedStreams.set(stream.url, { ...stream, detectedAt: Date.now() });
          console.log('[Kapowie] New stream detected:', stream.url, stream.type);
        }
      }
      // Notify popup if open
      chrome.runtime.sendMessage({
        type: 'STREAM_DETECTED',
        payload: { streams: Array.from(detectedStreams.values()) },
      }).catch(() => {});
      return { success: true };
    }

    case 'GET_STREAMS':
      return { streams: Array.from(detectedStreams.values()) };

    case 'START_RECORDING': {
      const payload = message.payload as { stream: StreamInfo; quality: string };
      const recording = await startRecording(payload.stream, payload.quality);
      return { recording };
    }

    case 'STOP_RECORDING': {
      const payload = message.payload as { id: string };
      const recording = await stopRecording(payload.id);
      return { recording };
    }

    case 'PAUSE_RECORDING': {
      const payload = message.payload as { id: string };
      const recording = activeRecordings.get(payload.id);
      if (recording) {
        recording.status = 'paused';
        return { recording };
      }
      return { error: 'Recording not found' };
    }

    case 'RESUME_RECORDING': {
      const payload = message.payload as { id: string };
      const recording = activeRecordings.get(payload.id);
      if (recording) {
        recording.status = 'recording';
        return { recording };
      }
      return { error: 'Recording not found' };
    }

    case 'GET_RECORDINGS':
      return { recordings: Array.from(activeRecordings.values()) };

    case 'DELETE_RECORDING': {
      const payload = message.payload as { id: string };
      activeRecordings.delete(payload.id);
      return { success: true };
    }

    case 'DOWNLOAD_SEGMENTS': {
      const payload = message.payload as { id: string };
      const recording = activeRecordings.get(payload.id);
      if (recording) {
        await downloadRecording(recording);
        return { success: true };
      }
      return { error: 'Recording not found' };
    }

    case 'START_RESTREAM': {
      const result = await startRestream();
      return result;
    }

    case 'STOP_RESTREAM': {
      await stopRestream();
      return { success: true };
    }

    case 'RECORDING_STATUS': {
      const payload = message.payload as { id: string };
      const recording = activeRecordings.get(payload.id);
      return { recording };
    }

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}

// ─── Stream Detection via webRequest ─────────────────────────────────────────
// Guard: chrome.webRequest may not exist in WXT prepare / test environments
// WXT fake-browser has chrome.webRequest but not the actual methods

if (typeof chrome !== 'undefined' && typeof (chrome as any).webRequest?.onBeforeRequest === 'function') {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.type !== 'main_frame' && details.type !== 'media') return;
      const url = details.url;
      if (isHLSStream(url)) {
        const stream: StreamInfo = {
          url,
          type: 'hls',
          quality: 'auto',
          pageUrl: details.initiator,
          detectedAt: Date.now(),
        };
        detectedStreams.set(url, stream);
        chrome.runtime.sendMessage({
          type: 'STREAM_DETECTED',
          payload: { streams: [stream] },
        }).catch(() => {});
      } else if (isDASHStream(url)) {
        const stream: StreamInfo = {
          url,
          type: 'dash',
          quality: 'auto',
          pageUrl: details.initiator,
          detectedAt: Date.now(),
        };
        detectedStreams.set(url, stream);
        chrome.runtime.sendMessage({
          type: 'STREAM_DETECTED',
          payload: { streams: [stream] },
        }).catch(() => {});
      }
    },
    { urls: ['http://*/*', 'https://*/*'] },
    ['requestBody']
  );

  chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      if (details.type !== 'media' && details.type !== 'xmlhttprequest') return;
      const contentType = details.responseHeaders?.find(
        (h) => h.name.toLowerCase() === 'content-type'
      )?.value || '';
      const url = details.url;
      if (
        contentType.includes('application/vnd.apple.mpegurl') ||
        contentType.includes('application/x-mpegurl') ||
        url.includes('.m3u8')
      ) {
        const stream: StreamInfo = {
          url,
          type: 'hls',
          quality: 'auto',
          pageUrl: details.initiator,
          detectedAt: Date.now(),
        };
        detectedStreams.set(url, stream);
        chrome.runtime.sendMessage({
          type: 'STREAM_DETECTED',
          payload: { streams: [stream] },
        }).catch(() => {});
      }
    },
    { urls: ['http://*/*', 'https://*/*'] },
    ['responseHeaders']
  );
}

function isHLSStream(url: string): boolean {
  return /\.m3u8(\?.*)?$/.test(url) || /\/hls\//.test(url);
}

function isDASHStream(url: string): boolean {
  return /\.mpd(\?.*)?$/.test(url) || /\/dash\//.test(url);
}

// ─── Recording Logic ─────────────────────────────────────────────────────────

async function startRecording(stream: StreamInfo, quality: string): Promise<Recording> {
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
  activeRecordings.set(id, recording);
  console.log('[Kapowie] Started recording:', id, stream.url);
  return recording;
}

async function stopRecording(id: string): Promise<Recording | undefined> {
  const recording = activeRecordings.get(id);
  if (recording) {
    recording.status = 'completed';
    console.log('[Kapowie] Stopped recording:', id);
  }
  return recording;
}

async function downloadRecording(recording: Recording): Promise<void> {
  if (recording.segments.length === 0) {
    console.warn('[Kapowie] No segments to download');
    return;
  }

  // Concatenate segments into a single blob
  const totalLength = recording.segments.reduce((sum, s) => sum + s.data.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const segment of recording.segments) {
    combined.set(segment.data, offset);
    offset += segment.data.byteLength;
  }

  const blob = new Blob([combined], { type: 'video/mp2t' });
  const url = URL.createObjectURL(blob);
  const filename = `kapowie-${recording.id.slice(0, 8)}-${Date.now()}.ts`;

  await chrome.downloads.download({
    url,
    filename: `kapowie-recordings/${filename}`,
    saveAs: false,
  });

  URL.revokeObjectURL(url);
  console.log('[Kapowie] Downloaded recording:', filename);
}

// ─── Re-stream Server Lifecycle ──────────────────────────────────────────────

async function startRestream(): Promise<{ active: boolean; port: number; url: string }> {
  if (restreamActive) {
    return { active: true, port: restreamPort, url: `http://localhost:${restreamPort}/live.m3u8` };
  }
  restreamActive = true;
  // The actual HLS server runs in the offscreen document
  // We just track state here
  return { active: true, port: restreamPort, url: `http://localhost:${restreamPort}/live.m3u8` };
}

async function stopRestream(): Promise<void> {
  restreamActive = false;
}

// ─── Settings Persistence ────────────────────────────────────────────────────

if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(async () => {
    const stored = await chrome.storage.local.get('settings');
    if (!stored.settings) {
      await chrome.storage.local.set({ settings: defaultSettings });
    }
  });
}

// ─── Cleanup on Suspend ─────────────────────────────────────────────────────

if (typeof chrome !== 'undefined' && chrome.runtime?.onSuspend) {
  chrome.runtime.onSuspend.addListener(() => {
    console.log('[Kapowie] Service worker suspending');
  });
}
