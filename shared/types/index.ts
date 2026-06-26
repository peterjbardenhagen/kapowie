/**
 * Shared types used across kapowie extension and desktop app
 */

// Stream detection and metadata
export type StreamType = 'hls' | 'dash' | 'direct' | 'unknown';

export interface StreamInfo {
  /** Unique identifier */
  id: string;
  /** Original URL */
  url: string;
  /** Stream type detected */
  type: StreamType;
  /** Human-readable name (extracted from page or manifest) */
  title?: string;
  /** Available qualities (for HLS variant playlists) */
  qualities: QualityLevel[];
  /** Currently selected quality */
  selectedQuality?: string;
  /** Source page URL */
  sourceUrl?: string;
  /** Source page title */
  sourceTitle?: string;
  /** Detected at timestamp */
  detectedAt: Date;
  /** Whether this is a live stream (vs VOD) */
  isLive: boolean;
}

export interface QualityLabel {
  /** Label like "1080p", "720p", "480p" */
  label: string;
  /** Bandwidth in bits per second */
  bandwidth: number;
  /** Resolution width */
  width?: number;
  /** Resolution height */
  height?: number;
  /** URL to this quality variant */
  url: string;
}

// Recording state
export type RecordingStatus = 
  | 'idle'           // Not recording
  | 'detecting'      // Detecting stream
  | 'recording'      // Actively recording
  | 'paused'         // User paused
  | 'stopping'       // Stop in progress
  | 'completed'      // Successfully completed
  | 'error'          // Error occurred
  | 'cancelled';     // User cancelled

export interface Recording {
  id: string;
  streamUrl: string;
  streamTitle?: string;
  outputFilename: string;
  status: RecordingStatus;
  startTime: Date;
  endTime?: Date;
  totalBytes: number;
  segments: SegmentInfo[];
  error?: string;
  /** Output format */
  format: 'mp4' | 'webm' | 'mkv';
  /** Quality being recorded */
  quality?: string;
}

export interface SegmentInfo {
  index: number;
  url: string;
  bytes: number;
  duration: number;  // seconds
  timestamp: Date;
}

// Re-stream configuration
export type ReStreamProtocol = 'hls' | 'rtsp';

export interface ReStreamConfig {
  enabled: boolean;
  protocol: ReStreamProtocol;
  port: number;
  /** Path prefix for HLS (e.g., /live) */
  path: string;
  /** Require password to access */
  authEnabled: boolean;
  /** Password (if auth enabled) */
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

// Settings
export interface AppSettings {
  /** Output directory for recordings */
  outputDir: string;
  /** Maximum concurrent segment downloads */
  maxConcurrentDownloads: number;
  /** Default output format */
  defaultFormat: 'mp4' | 'webm' | 'mkv';
  /** Default quality preference */
  qualityPreference: 'highest' | 'lowest' | 'ask' | '720p' | '1080p';
  /** Enable desktop notifications */
  notificationsEnabled: boolean;
  /** Auto-open file on completion */
  autoOpenFile: boolean;
  /** Re-stream config */
  restream: ReStreamConfig;
  /** Segment download timeout (ms) */
  segmentTimeout: number;
  /** Retry count for failed segments */
  maxRetries: number;
  /** Inject Origin/Referer headers */
  headerInjection: boolean;
}

// Default settings
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

// IPC message types (extension)
export type ExtensionMessage =
  | { type: 'STREAM_DETECTED'; payload: StreamInfo }
  | { type: 'STREAM_LOST'; payload: { id: string } }
  | { type: 'RECORDING_STARTED'; payload: Recording }
  | { type: 'RECORDING_PROGRESS'; payload: { id: string; bytes: number; segments: number } }
  | { type: 'RECORDING_COMPLETED'; payload: Recording }
  | { type: 'RECORDING_ERROR'; payload: { id: string; error: string } }
  | { type: 'RESTREAM_STATUS'; payload: ReStreamStatus }
  | { type: 'SETTINGS_UPDATE'; payload: Partial<AppSettings> };

// IPC message types (desktop <-> Tauri)
export type TauriCommand =
  | { cmd: 'get_stream_info'; url: string }
  | { cmd: 'start_recording'; url: string; output?: string; format?: string }
  | { cmd: 'stop_recording'; id: string }
  | { cmd: 'pause_recording'; id: string }
  | { cmd: 'resume_recording'; id: string }
  | { cmd: 'list_recordings' }
  | { cmd: 'delete_recording'; id: string }
  | { cmd: 'open_recording_folder'; id: string }
  | { cmd: 'start_restream'; protocol: 'hls' | 'rtsp'; port?: number }
  | { cmd: 'stop_restream' }
  | { cmd: 'get_restream_status' }
  | { cmd: 'get_settings' }
  | { cmd: 'update_settings'; settings: Partial<AppSettings> };

export type TauriResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
