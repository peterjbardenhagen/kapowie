/// <reference types="chrome" />

// ─── Core Domain Types ───────────────────────────────────────────────────────

export interface StreamInfo {
  url: string;
  type: 'hls' | 'dash' | 'direct';
  quality: string;
  pageUrl?: string;
  pageTitle?: string;
  detectedAt?: number;
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

export interface Segment {
  url: string;
  data: Uint8Array;
  timestamp: number;
  duration?: number;
  isEncrypted?: boolean;
  keyUri?: string;
  iv?: string;
}

export interface HLSVariant {
  url: string;
  bandwidth: number;
  resolution?: string;
  codecs?: string;
  name?: string;
}

export interface HLSSegment {
  url: string;
  duration: number;
  sequence: number;
  isEncrypted: boolean;
  keyUri?: string;
  iv?: string;
  byteRange?: { start: number; end: number };
}

export interface DASHRepresentation {
  id: string;
  bandwidth: number;
  width?: number;
  height?: number;
  codecs?: string;
  mimeType?: string;
  baseUrl: string;
  segmentTemplate?: DASHSegmentTemplate;
}

export interface DASHSegmentTemplate {
  media: string;
  initialization: string;
  timescale: number;
  duration: number;
  startNumber: number;
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

export type MessageType =
  | 'STREAM_DETECTED'
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'PAUSE_RECORDING'
  | 'RESUME_RECORDING'
  | 'GET_STREAMS'
  | 'GET_RECORDINGS'
  | 'DELETE_RECORDING'
  | 'DOWNLOAD_SEGMENTS'
  | 'START_RESTREAM'
  | 'STOP_RESTREAM'
  | 'RECORDING_STATUS'
  | 'ERROR';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
  requestId?: string;
}

export interface StreamDetectedPayload {
  streams: StreamInfo[];
}

export interface StartRecordingPayload {
  stream: StreamInfo;
  quality: string;
}

export interface RecordingStatusPayload {
  recording: Recording;
}

export interface RestreamStatusPayload {
  active: boolean;
  port: number;
  url: string;
}
