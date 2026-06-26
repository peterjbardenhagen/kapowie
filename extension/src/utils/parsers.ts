/// <reference types="chrome" />

import type {
  HLSVariant,
  HLSSegment,
  DASHRepresentation,
  DASHSegmentTemplate,
} from '../types';

// ─── HLS Parsing ──────────────────────────────────────────────────────────────

const ATTR_PATTERN = /([A-Z0-9\-]+)=(?:"([^"]*)"|([^,]*))/g;

/**
 * Parse an HLS manifest (master or media playlist) into structured data.
 * Supports HLS version 3+ including multividel playlists, byte-range,
 * key segments, and discontinuity tags.
 */
export function parseHLSManifest(manifestText: string, baseUrl: string): {
  variants: HLSVariant[];
  segments: HLSSegment[];
  isMasterPlaylist: boolean;
  targetDuration?: number;
  mediaSequence?: number;
  playlistType?: 'EVENT' | 'VOD';
  hasEndList: boolean;
} {
  const lines = manifestText.split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length === 0 || !lines[0].startsWith('#EXTM3U')) {
    throw new HLSParserError('Invalid HLS manifest: missing #EXTM3U header');
  }

  const isMaster = lines.some((l) => l.startsWith('#EXT-X-STREAM-INF'));
  const hasEndList = lines.some((l) => l.startsWith('#EXT-X-ENDLIST'));

  if (isMaster) {
    return {
      variants: parseMasterPlaylist(lines, baseUrl),
      segments: [],
      isMasterPlaylist: true,
      hasEndList,
    };
  }

  return {
    variants: [],
    segments: parseMediaPlaylist(lines, baseUrl),
    isMasterPlaylist: false,
    targetDuration: parseTargetDuration(lines),
    mediaSequence: parseMediaSequence(lines),
    playlistType: parsePlaylistType(lines),
    hasEndList,
  };
}

function parseMasterPlaylist(
  lines: string[],
  baseUrl: string
): HLSVariant[] {
  const variants: HLSVariant[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const attrs = parseAttributes(line.slice('#EXT-X-STREAM-INF:'.length));
      const uri = lines[++i];
      if (!uri || uri.startsWith('#')) continue;

      const bandwidth = parseInt(attrs['BANDWIDTH'] || '0', 10);
      const resolution = attrs['RESOLUTIONS'];
      const codecs = attrs['CODECS'];
      const name = attrs['NAME'];

      variants.push({
        url: resolveUrl(baseUrl, uri),
        bandwidth,
        resolution: resolution || undefined,
        codecs: codecs || undefined,
        name: name || undefined,
      });
    }
  }

  return variants;
}

function parseMediaPlaylist(lines: string[], baseUrl: string): HLSSegment[] {
  const segments: HLSSegment[] = [];
  let currentDuration = 0;
  let sequence = 0;
  let currentKeyUri: string | undefined;
  let currentIv: string | undefined;
  let currentByteRange: { start: number; end: number } | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE')) {
      sequence = parseInt(line.split(':')[1], 10);
      continue;
    }

    if (line.startsWith('#EXT-X-KEY')) {
      const attrs = parseAttributes(line.slice('#EXT-X-KEY:'.length));
      const method = attrs['METHOD'];
      if (method === 'AES-128') {
        const keyUri = attrs['URI'];
        const iv = attrs['IV'];
        if (keyUri) currentKeyUri = resolveUrl(baseUrl, keyUri.slice(1, -1));
        if (iv) currentIv = iv.startsWith('0x') ? iv.slice(2) : iv;
      } else if (method === 'NONE') {
        currentKeyUri = undefined;
        currentIv = undefined;
      }
      continue;
    }

    if (line.startsWith('#EXT-X-BYTERANGE')) {
      const parts = line.split(':')[1];
      const [range, offsetStr] = parts.split('@');
      const start = parseInt(offsetStr || '0', 10);
      const end = start + parseInt(range, 10) - 1;
      currentByteRange = { start, end };
      continue;
    }

    if (line.startsWith('#EXTINF')) {
      const colonIdx = line.indexOf(':');
      const durationStr = line.slice(colonIdx + 1).split(',')[0];
      currentDuration = parseFloat(durationStr);
      continue;
    }

    if (line.startsWith('#EXT-X-DISCONTINUITY')) {
      // discontinuity marker — no segment action needed
      continue;
    }

    // Non-tag line is a segment URI
    if (!line.startsWith('#')) {
      const segmentUrl = resolveUrl(baseUrl, line);
      segments.push({
        url: segmentUrl,
        duration: currentDuration,
        sequence: sequence++,
        isEncrypted: currentKeyUri !== undefined,
        keyUri: currentKeyUri,
        iv: currentIv,
        byteRange: currentByteRange,
      });
      currentDuration = 0;
      currentByteRange = undefined;
    }
  }

  return segments;
}

function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let match: RegExpExecArray | null;
  ATTR_PATTERN.lastIndex = 0;
  while ((match = ATTR_PATTERN.exec(attrStr)) !== null) {
    attrs[match[1]] = match[2] ?? match[3];
  }
  return attrs;
}

function parseTargetDuration(lines: string[]): number | undefined {
  for (const line of lines) {
    if (line.startsWith('#EXT-X-TARGETDURATION')) {
      return parseInt(line.split(':')[1], 10);
    }
  }
  return undefined;
}

function parseMediaSequence(lines: string[]): number | undefined {
  for (const line of lines) {
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE')) {
      return parseInt(line.split(':')[1], 10);
    }
  }
  return undefined;
}

function parsePlaylistType(lines: string[]): 'EVENT' | 'VOD' | undefined {
  for (const line of lines) {
    if (line.startsWith('#EXT-X-PLAYLIST-TYPE')) {
      const type = line.split(':')[1].trim();
      if (type === 'EVENT' || type === 'VOD') return type;
    }
  }
  return undefined;
}

// ─── DASH Parsing ─────────────────────────────────────────────────────────────

interface DASHManifest {
  representations: DASHRepresentation[];
  duration?: string;
  type: 'static' | 'dynamic';
  minBufferTime?: string;
}

/**
 * Parse a DASH MPD manifest into structured data.
 * Handles SegmentTemplate-based manifests (common for live streams)
 * as well as SegmentList-based ones.
 */
export function parseDASHManifest(mpdXml: string, manifestUrl: string): DASHManifest {
  const parser = new DOMParser();
  const doc = parser.parseFromString(mpdXml, 'text/xml');

  const mpd = doc.querySelector('MPD');
  if (!mpd) {
    throw new DASHParserError('Invalid DASH manifest: missing <MPD> element');
  }

  const type = (mpd.getAttribute('type') as 'static' | 'dynamic') || 'static';
  const duration = mpd.getAttribute('duration') || undefined;
  const minBufferTime = mpd.getAttribute('minBufferTime') || undefined;

  const representations: DASHRepresentation[] = [];
  const computedBaseUrl = computeMPDBaseUrl(manifestUrl);

  // Parse Period > AdaptationSet > Representation
  const periods = doc.querySelectorAll('Period');
  for (const period of periods) {
    const adaptationSets = period.querySelectorAll('AdaptationSet');
    for (const adaptation of adaptationSets) {
      // Only process video/audio representations, skip subtitles etc.
      const mimeType = adaptation.getAttribute('mimeType') || '';
      if (!mimeType.startsWith('video/') && !mimeType.startsWith('audio/')) {
        continue;
      }

      const reprs = adaptation.querySelectorAll('Representation');
      for (const repr of reprs) {
        const segmentTemplate = repr.querySelector('SegmentTemplate');
        const reprId = repr.getAttribute('id') || '';
        const bandwidth = parseInt(repr.getAttribute('bandwidth') || '0', 10);
        const width = parseInt(repr.getAttribute('width') || '0', 10) || undefined;
        const height = parseInt(repr.getAttribute('height') || '0', 10) || undefined;
        const codecs = repr.getAttribute('codecs') || undefined;
        const mime = repr.getAttribute('mimeType') || mimeType;

        const reprBaseUrl = findBaseUrl(repr) || findBaseUrl(adaptation) || computedBaseUrl;

        const template = segmentTemplate
          ? {
              media: segmentTemplate.getAttribute('media') || '',
              initialization: segmentTemplate.getAttribute('initialization') || '',
              timescale: parseInt(segmentTemplate.getAttribute('timescale') || '1', 10),
              duration: parseInt(segmentTemplate.getAttribute('duration') || '0', 10),
              startNumber: parseInt(segmentTemplate.getAttribute('startNumber') || '0', 10),
            }
          : undefined;

        representations.push({
          id: reprId,
          bandwidth,
          width,
          height,
          codecs,
          mimeType: mime,
          baseUrl: reprBaseUrl,
          segmentTemplate: template,
        });
      }
    }
  }

  return { representations, duration, type, minBufferTime };
}

function findBaseUrl(element: Element): string | undefined {
  const baseUrlEl = element.querySelector('BaseURL');
  if (baseUrlEl?.textContent) return baseUrlEl.textContent.trim();

  // Check parent
  let parent: Element | null = element.parentElement;
  while (parent && parent.tagName !== 'MPD') {
    const bu = parent.querySelector(':scope > BaseURL');
    if (bu?.textContent) return bu.textContent.trim();
    parent = parent.parentElement;
  }
  return undefined;
}

function computeMPDBaseUrl(manifestUrl: string): string {
  // The MPD URL itself acts as the base — resolve segments relative to it
  const url = new URL(manifestUrl);
  return url.origin + url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
}

/**
 * Compute the segment URL for a DASH SegmentTemplate at a given number.
 * Replaces $RepresentationID$ and $Number$ in the media template.
 */
export function computeDASHSegmentUrl(
  baseUrl: string,
  segmentTemplate: DASHSegmentTemplate,
  representationId: string,
  segmentNumber: number
): string {
  const media = segmentTemplate.media
    .replace(/\$RepresentationID\$/g, representationId)
    .replace(/\$Number\$/g, String(segmentNumber))
    .replace(/\$Time\$/g, String(
      segmentTemplate.duration * (segmentNumber - segmentTemplate.startNumber)
    ));

  return resolveUrl(baseUrl, media);
}

// ─── Stream Type Detection ────────────────────────────────────────────────────

export type StreamProtocol = 'hls' | 'dash' | 'direct-hls' | 'direct-dash' | 'direct-mp4' | 'direct-webm' | 'unknown';

export interface DetectedProtocol {
  protocol: StreamProtocol;
  variant?: string; // e.g., 'byte-range-hls' for-byte-range playlists
}

/**
 * Detect the streaming protocol from a URL with high precision.
 * Checks both URL patterns and optional Content-Type hints.
 */
export function detectStreamProtocol(
  url: string,
  contentType?: string
): DetectedProtocol {
  if (!url) return { protocol: 'unknown' };

  const lowerUrl = url.toLowerCase();

  // Check content-type first for ambiguous URLs (e.g., URLs without extension)
  if (contentType) {
    const lowerCt = contentType.toLowerCase();
    if (lowerCt.includes('application/vnd.apple.mpegurl') || lowerCt.includes('application/x-mpegurl')) {
      return { protocol: 'hls' };
    }
    if (lowerCt.includes('application/dash+xml')) {
      return { protocol: 'dash' };
    }
    if (lowerCt.includes('video/mp4')) {
      return { protocol: 'direct-mp4' };
    }
    if (lowerCt.includes('video/webm')) {
      return { protocol: 'direct-webm' };
    }
  }

  // HLS detection
  if (lowerUrl.includes('.m3u8') || lowerUrl.includes('/hls/') || lowerUrl.includes('/live/playlist')) {
    if (lowerUrl.includes('byterange') || lowerUrl.includes('byte-range')) {
      return { protocol: 'hls', variant: 'byte-range-hls' };
    }
    return { protocol: 'hls' };
  }

  // DASH detection
  if (lowerUrl.includes('.mpd') || lowerUrl.includes('/dash/') || lowerUrl.includes('/manifest')) {
    return { protocol: 'dash' };
  }

  // Direct media detection
  if (lowerUrl.includes('.mp4') || lowerUrl.includes('/mp4/')) {
    return { protocol: 'direct-mp4' };
  }
  if (lowerUrl.includes('.webm')) {
    return { protocol: 'direct-webm' };
  }
  if (lowerUrl.includes('.flv') || lowerUrl.includes('/flv/')) {
    return { protocol: 'direct-hls' }; // FLV streams are sometimes HLS-flavored
  }

  // Fallback: detect from URL structure patterns
  if (lowerUrl.includes('live') && (lowerUrl.includes('playlist') || lowerUrl.includes('manifest'))) {
    return { protocol: 'hls' };
  }

  return { protocol: 'unknown' };
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Resolve a potentially relative URL against a base URL.
 */
export function resolveUrl(baseUrl: string, relativeUrl: string): string {
  if (!relativeUrl) return baseUrl;

  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    return relativeUrl;
  }
}

/**
 * Normalize a stream URL by removing tracking parameters and fragments.
 * Keeps essential query params for signed URLs.
 */
export function normalizeStreamUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove known tracking params
    const trackingParams = [
      'fbclid', 'gclid', 'utm_source', 'utm_medium', 'utm_campaign',
      'utm_term', 'utm_content', 'ref', 'referrer', 'spm', 'from',
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }

    // Remove fragment
    parsed.hash = '';

    return parsed.href;
  } catch {
    return url;
  }
}

/**
 * Extract the origin domain from a URL, useful for site identification.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Generate a unique identifier for a recording session.
 */
export function generateRecordingId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Not suitable for production — fallback only
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Set version 4 and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Format a byte count into a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Format a duration in seconds to HH:MM:SS.fff
 */
export function formatDuration(seconds: number): string {
  const sign = seconds < 0 ? '-' : '';
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = Math.floor(abs % 60);
  const ms = Math.floor((abs % 1) * 1000);

  if (h > 0) {
    return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
  return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Sort HLS variants from highest to lowest bandwidth.
 */
export function sortVariantsByBandwidth(variants: HLSVariant[]): HLSVariant[] {
  return [...variants].sort((a, b) => b.bandwidth - a.bandwidth);
}

/**
 * Select the best variant matching a quality preference.
 * quality: 'best' | 'worst' | number (target bandwidth in kbps)
 */
export function selectVariant(
  variants: HLSVariant[],
  quality: string
): HLSVariant | undefined {
  if (variants.length === 0) return undefined;

  const sorted = sortVariantsByBandwidth(variants);

  if (quality === 'best') return sorted[0];
  if (quality === 'worst') return sorted[sorted.length - 1];

  const targetBandwidth = parseInt(quality, 10) * 1000; // kbps to bps
  if (!isNaN(targetBandwidth)) {
    // Find closest match (prefer lower than target for stability)
    let best = sorted[sorted.length - 1];
    for (const v of sorted) {
      if (v.bandwidth <= targetBandwidth) {
        best = v;
      }
    }
    return best;
  }

  return sorted[0]; // default to best
}

// ─── Error Types ──────────────────────────────────────────────────────────────

export class HLSParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HLSParserError';
  }
}

export class DASHParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DASHParserError';
  }
}
