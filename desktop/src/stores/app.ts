import { writable, derived } from 'svelte/store';

// Application pages
export const currentPage = writable<string>('capture');

// Stream capture state
export const streamUrl = writable<string>('');
export const detectedStream = writable<StreamInfo | null>(null);
export const isRecording = writable<boolean>(false);
export const activeRecordingId = writable<string>('');

// Recordings store
export const recordings = writable<Recording[]>([]);

// Re-stream store
export const activeRestreams = writable<ReStream[]>([]);

// Settings store
export const settings = writable<AppSettings>({
  outputDirectory: '',
  maxConcurrentDownloads: 3,
  defaultQuality: 'best',
  restreamDefaultPort: 8080,
  restreamDefaultProtocol: 'HLS',
  autoReconnect: true,
  reconnectAttempts: 5,
  segmentDurationSecs: 10.0,
});

// Types
export interface StreamInfo {
  url: string;
  format: string;
  quality: string;
  bitrate?: number;
  duration?: number;
}

export interface Recording {
  id: string;
  url: string;
  output_path: string;
  status: string;
  started_at: string;
  file_size: number;
  duration_secs: number;
}

export interface ReStream {
  id: string;
  url: string;
  protocol: string;
  port: number;
  path: string;
  status: string;
  viewer_count: number;
}

export interface AppSettings {
  outputDirectory: string;
  maxConcurrentDownloads: number;
  defaultQuality: string;
  restreamDefaultPort: number;
  restreamDefaultProtocol: string;
  autoReconnect: boolean;
  reconnectAttempts: number;
  segmentDurationSecs: number;
}
