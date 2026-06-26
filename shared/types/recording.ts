import type { StreamInfo } from './stream';

export type RecordingStatus =
  | 'idle'
  | 'detecting'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface Segment {
  url: string;
  data: Uint8Array;
  timestamp: number;
  duration?: number;
  isEncrypted?: boolean;
  keyUri?: string;
  iv?: string;
}

export interface SegmentInfo {
  index: number;
  url: string;
  bytes: number;
  duration: number;
  timestamp: Date;
}

export interface Recording {
  id: string;
  streamUrl?: string;
  url?: string;
  streamTitle?: string;
  outputFilename?: string;
  status: RecordingStatus | 'recording' | 'paused' | 'completed';
  startTime?: Date;
  endTime?: Date;
  totalBytes?: number;
  segments: Segment[];
  error?: string;
  format?: 'mp4' | 'webm' | 'mkv';
  quality?: string;
  stream?: StreamInfo;
  streamType?: 'hls' | 'dash' | 'direct' | 'unknown';
  pageTitle?: string;
  pageUrl?: string;
}

export interface RecordingSettings {
  maxQuality: string;
  autoDetect: boolean;
  downloadPath: string;
  restreamPort: number;
  restreamEnabled: boolean;
  segmentLimit: number;
  transcodeOutput: boolean;
}

export type ReStreamProtocol = 'hls' | 'rtsp';

export interface ReStreamConfig {
  enabled: boolean;
  protocol: ReStreamProtocol;
  port: number;
  path: string;
  authEnabled: boolean;
  password?: string;
}

export interface ReStreamStatus {
  active: boolean;
  protocol: ReStreamProtocol;
  url: string;
  startedAt?: Date;
  viewerCount: number;
  bytesServed: number;
}

export interface AppSettings {
  outputDir: string;
  maxConcurrentDownloads: number;
  defaultFormat: 'mp4' | 'webm' | 'mkv';
  qualityPreference: 'highest' | 'lowest' | 'ask' | '720p' | '1080p';
  notificationsEnabled: boolean;
  autoOpenFile: boolean;
  restream: ReStreamConfig;
  segmentTimeout: number;
  maxRetries: number;
  headerInjection: boolean;
}

export const DEFAULT_SETTINGS: Partial<AppSettings> = {
  maxConcurrentDownloads: 3,
  defaultFormat: 'mp4',
  qualityPreference: 'highest',
  notificationsEnabled: true,
  autoOpenFile: false,
  restream: {
    enabled: true,
    protocol: 'hls',
    port: 8080,
    path: '/live',
    authEnabled: false,
  },
  segmentTimeout: 30000,
  maxRetries: 3,
  headerInjection: true,
};
