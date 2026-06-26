import { writable, derived } from 'svelte/store';
import type {
  AppSettings as SharedAppSettings,
  Recording as SharedRecording,
  ReStreamStatus as SharedReStreamStatus,
  StreamInfo as SharedStreamInfo,
} from '../../../shared/types';

export type StreamInfo = SharedStreamInfo & {
  format: string;
  bitrate?: number;
  duration?: number;
};

export type Recording = SharedRecording & {
  output_path: string;
  started_at: string;
  file_size: number;
  duration_secs: number;
  status: string;
};

export type ReStream = SharedReStreamStatus & {
  id: string;
  path: string;
  status: string;
  protocol: string;
};

export type AppSettings = SharedAppSettings & {
  defaultQuality: string;
  restreamDefaultPort: number;
  restreamDefaultProtocol: string;
  autoReconnect: boolean;
  reconnectAttempts: number;
  segmentDurationSecs: number;
};

export const currentPage = writable<string>('capture');
export const streamUrl = writable<string>('');
export const detectedStream = writable<StreamInfo | null>(null);
export const isRecording = writable<boolean>(false);
export const activeRecordingId = writable<string>('');
export const recordings = writable<Recording[]>([]);
export const activeRestreams = writable<ReStream[]>([]);

export const settings = writable<AppSettings>({
  outputDir: '',
  maxConcurrentDownloads: 3,
  defaultFormat: 'mp4',
  qualityPreference: 'highest',
  notificationsEnabled: true,
  autoOpenFile: false,
  restream: {
    enabled: true,
    protocol: 'hls',
    port: 8080,
    path: '/stream',
    authEnabled: false,
  },
  segmentTimeout: 30000,
  maxRetries: 3,
  headerInjection: true,
  defaultQuality: 'best',
  restreamDefaultPort: 8080,
  restreamDefaultProtocol: 'HLS',
  autoReconnect: true,
  reconnectAttempts: 5,
  segmentDurationSecs: 10,
});

export const hasActiveRestreams = derived(activeRestreams, (items) => items.length > 0);
