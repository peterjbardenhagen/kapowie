export type StreamType = 'hls' | 'dash' | 'direct' | 'unknown';

export interface StreamMetadata {
  videoId?: string;
  platform?: string;
  playerUrl?: string;
}

export interface StreamInfo {
  id?: string;
  url: string;
  type: StreamType;
  quality?: string;
  title?: string;
  qualities?: QualityLevel[];
  selectedQuality?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  pageUrl?: string;
  pageTitle?: string;
  detectedAt?: number;
  isLive?: boolean;
  metadata?: StreamMetadata;
}

export interface QualityLevel {
  label: string;
  bandwidth: number;
  width?: number;
  height?: number;
  url: string;
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
