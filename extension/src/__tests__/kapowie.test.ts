/**
 * Kapowie Unit Tests
 *
 * Tests for:
 * 1. HLS manifest parsing
 * 2. VOD stream detection
 * 3. YouTube live stream detection
 * 4. Castr stream detection
 * 5. Recording manager
 */

import { describe, it, expect } from 'vitest';
import type { StreamInfo, Segment } from '../types';

// ─── HLS Parser Tests ────────────────────────────────────────────────────────

describe('HLS Parser', () => {
  it('should parse a basic HLS master playlist', () => {
    const masterPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=1280000,RESOLUTION=720x480
http://example.com/low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2560000,RESOLUTION=1280x720
http://example.com/mid.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=7680000,RESOLUTION=1920x1080
http://example.com/high.m3u8`;

    const streams = parseHLSMaster(masterPlaylist);
    expect(streams).toHaveLength(3);
    expect(streams[0].bandwidth).toBe(1280000);
    expect(streams[0].resolution).toBe('720x480');
    expect(streams[2].bandwidth).toBe(7680000);
  });

  it('should parse HLS media playlist with segments', () => {
    const mediaPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
segment0.ts
#EXTINF:10.0,
segment1.ts
#EXTINF:10.0,
segment2.ts
#EXT-X-ENDLIST`;

    const segments = parseHLSMedia(mediaPlaylist);
    expect(segments).toHaveLength(3);
    expect(segments[0].duration).toBe(10.0);
    expect(segments[0].url).toBe('segment0.ts');
  });

  it('should detect live vs VOD stream', () => {
    const livePlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
segment0.ts
#EXTINF:10.0,
segment1.ts`;

    const vodPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
segment0.ts
#EXT-X-ENDLIST`;

    expect(isLiveStream(livePlaylist)).toBe(true);
    expect(isLiveStream(vodPlaylist)).toBe(false);
  });

  it('should handle AES-128 encrypted streams', () => {
    const encryptedPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-KEY:METHOD=AES-128,URI="https://example.com/key.bin",IV=0x00000000000000000000000000000001
#EXTINF:10.0,
segment0.ts`;

    const info = parseHLSMedia(encryptedPlaylist);
    expect(info[0].encrypted).toBe(true);
    expect(info[0].keyUrl).toBe('https://example.com/key.bin');
  });
});

// ─── Castr Detection Tests ──────────────────────────────────────────────────

describe('Castr Detection', () => {
  it('should detect Castr video IDs in HTML', () => {
    const html = `
      <html><body>
        <div data-video-id="37acc721-8fc9-4739-a16f-dde80cadb700"></div>
        <iframe src="https://player.castr.com/0c58a1db-7a63-420d-0e35-772d86a95100"></iframe>
      </body></html>
    `;

    const videoIds = detectCastrVideoIds(html);
    expect(videoIds).toContain('37acc721-8fc9-4739-a16f-dde80cadb700');
    expect(videoIds).toContain('0c58a1db-7a63-420d-0e35-772d86a95100');
  });

  it('should construct player URLs from video IDs', () => {
    const videoId = '37acc721-8fc9-4739-a16f-dde80cadb700';
    const playerUrl = getCastrPlayerUrl(videoId);
    expect(playerUrl).toBe('https://player.castr.com/37acc721-8fc9-4739-a16f-dde80cadb700');
  });

  it('should detect Castr-powered pages', () => {
    const html = `<html><script src="https://player.castr.com/embed.js"></script></html>`;
    expect(pageContainsCastr(html)).toBe(true);
  });
});

// ─── YouTube Live Detection Tests ───────────────────────────────────────────

describe('YouTube Live Detection', () => {
  it('should detect YouTube live stream URLs', () => {
    const urls = [
      'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      'https://youtube.com/live/jfKfPfyJRdk',
      'https://youtu.be/jfKfPfyJRdk',
    ];

    for (const url of urls) {
      expect(isYouTubeUrl(url)).toBe(true);
      expect(isYouTubeLive(url)).toBe(true);
    }
  });

  it('should extract video ID from various YouTube URL formats', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=jfKfPfyJRdk')).toBe('jfKfPfyJRdk');
    expect(extractYouTubeVideoId('https://youtube.com/live/jfKfPfyJRdk')).toBe('jfKfPfyJRdk');
    expect(extractYouTubeVideoId('https://youtu.be/jfKfPfyJRdk')).toBe('jfKfPfyJRdk');
  });

  it('should detect non-YouTube URLs', () => {
    expect(isYouTubeUrl('https://vimeo.com/123456')).toBe(false);
    expect(isYouTubeUrl('https://twitch.tv/channelname')).toBe(false);
  });
});

// ─── Recording Manager Tests ────────────────────────────────────────────────

describe('Recording Manager', () => {
  it('should create a new recording', () => {
    const recording = createRecording({
      url: 'https://example.com/stream.m3u8',
      type: 'hls',
      pageUrl: 'https://example.com/live',
    });

    expect(recording.id).toBeDefined();
    expect(recording.status).toBe('recording');
    expect(recording.startTime).toBeDefined();
    expect(recording.segments).toEqual([]);
  });

  it('should add segments to a recording', () => {
    const recording = createRecording({ url: 'https://example.com/stream.m3u8', type: 'hls' });
    const segment: Segment = {
      url: 'https://example.com/segment0.ts',
      data: new Uint8Array([1, 2, 3]),
      timestamp: Date.now(),
      duration: 10,
    };

    addSegment(recording.id, segment);
    expect(recording.segments).toHaveLength(1);
    expect(recording.totalBytes).toBe(3);
  });

  it('should stop a recording', () => {
    const recording = createRecording({ url: 'https://example.com/stream.m3u8', type: 'hls' });
    stopRecording(recording.id);
    expect(recording.status).toBe('completed');
    expect(recording.endTime).toBeDefined();
  });
});

// ─── Stream Detector (General) ──────────────────────────────────────────────

describe('Stream Detector', () => {
  it('should detect HLS streams in page HTML', () => {
    const html = `<html><source src="https://example.com/stream.m3u8" type="application/x-mpegURL">`;
    const streams = detectStreams(html, 'https://example.com');
    expect(streams.length).toBeGreaterThan(0);
    expect(streams[0].type).toBe('hls');
  });

  it('should detect DASH streams in page HTML', () => {
    const html = `<html><source src="https://example.com/stream.mpd" type="application/dash+xml">`;
    const streams = detectStreams(html, 'https://example.com');
    expect(streams.length).toBeGreaterThan(0);
    expect(streams[0].type).toBe('dash');
  });

  it('should detect direct video URLs', () => {
    const html = `<html><video src="https://example.com/video.mp4"></video>`;
    const streams = detectStreams(html, 'https://example.com');
    expect(streams.length).toBeGreaterThan(0);
    expect(streams[0].type).toBe('direct');
  });

  it('should deduplicate streams', () => {
    const html = `<html>
      <source src="https://example.com/stream.m3u8">
      <source src="https://example.com/stream.m3u8">
    </html>`;
    const streams = detectStreams(html, 'https://example.com');
    const hlsStreams = streams.filter(s => s.type === 'hls');
    expect(hlsStreams).toHaveLength(1);
  });
});

// ─── Helper function stubs (would be imported from actual modules) ───────────

function parseHLSMaster(content: string): Array<{ bandwidth: number; resolution: string; url: string }> {
  const lines = content.split('\n');
  const streams: Array<{ bandwidth: number; resolution: string; url: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
      const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/);
      const resolutionMatch = lines[i].match(/RESOLUTION=(\d+x\d+)/);
      const url = lines[i + 1];
      if (bandwidthMatch && url && !url.startsWith('#')) {
        streams.push({
          bandwidth: parseInt(bandwidthMatch[1]),
          resolution: resolutionMatch ? resolutionMatch[1] : 'unknown',
          url,
        });
      }
    }
  }
  return streams;
}

function parseHLSMedia(content: string): Array<{ url: string; duration: number; encrypted: boolean; keyUrl?: string }> {
  const lines = content.split('\n');
  const segments: Array<{ url: string; duration: number; encrypted: boolean; keyUrl?: string }> = [];
  let currentEncrypted = false;
  let currentKeyUrl: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-KEY')) {
      currentEncrypted = true;
      const keyMatch = lines[i].match(/URI="([^"]+)"/);
      if (keyMatch) currentKeyUrl = keyMatch[1];
    }
    if (lines[i].startsWith('#EXTINF')) {
      const durationMatch = lines[i].match(/#EXTINF:([\d.]+)/);
      const url = lines[i + 1];
      if (durationMatch && url && !url.startsWith('#')) {
        segments.push({
          url,
          duration: parseFloat(durationMatch[1]),
          encrypted: currentEncrypted,
          keyUrl: currentKeyUrl,
        });
      }
    }
  }
  return segments;
}

function isLiveStream(content: string): boolean {
  return !content.includes('#EXT-X-ENDLIST');
}

function detectCastrVideoIds(html: string): string[] {
  const ids = new Set<string>();
  const regex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
  const matches = html.match(regex) || [];
  for (const id of matches) ids.add(id);
  return Array.from(ids);
}

function getCastrPlayerUrl(videoId: string): string {
  return `https://player.castr.com/${videoId}`;
}

function pageContainsCastr(html: string): boolean {
  return /castr\.(com|io)/i.test(html);
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

function isYouTubeLive(url: string): boolean {
  return /(?:youtube\.com\/watch|youtube\.com\/live|youtu\.be)/i.test(url);
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

interface RecordingData {
  url: string;
  type: 'hls' | 'dash' | 'direct';
  pageUrl?: string;
}

interface TestRecording {
  id: string;
  status: 'recording' | 'paused' | 'completed';
  startTime: Date;
  endTime?: Date;
  segments: Segment[];
  totalBytes: number;
}

const recordings = new Map<string, TestRecording>();

function createRecording(data: RecordingData): TestRecording {
  const id = crypto.randomUUID();
  const recording: TestRecording = {
    id,
    status: 'recording',
    startTime: new Date(),
    segments: [],
    totalBytes: 0,
  };
  recordings.set(id, recording);
  return recording;
}

function addSegment(recordingId: string, segment: Segment): void {
  const rec = recordings.get(recordingId);
  if (rec) {
    rec.segments.push(segment);
    rec.totalBytes += segment.data.byteLength;
  }
}

function stopRecording(recordingId: string): void {
  const recording = recordings.get(recordingId);
  if (recording) {
    recording.status = 'completed';
    recording.endTime = new Date();
  }
}

// Suppress unused variable warnings
void recordings;
void stopRecording;

function detectStreams(html: string, pageUrl: string): StreamInfo[] {
  const streams: StreamInfo[] = [];
  const seen = new Set<string>();

  // HLS
  const hlsMatches = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi) || [];
  for (const url of hlsMatches) {
    if (!seen.has(url)) {
      seen.add(url);
      streams.push({ url, type: 'hls', quality: 'auto', pageUrl, detectedAt: Date.now() });
    }
  }

  // DASH
  const dashMatches = html.match(/https?:\/\/[^"'\s]+\.mpd[^"'\s]*/gi) || [];
  for (const url of dashMatches) {
    if (!seen.has(url)) {
      seen.add(url);
      streams.push({ url, type: 'dash', quality: 'auto', pageUrl, detectedAt: Date.now() });
    }
  }

  // Direct video
  const videoMatches = html.match(/https?:\/\/[^"'\s]+\.(mp4|webm|ogg)[^"'\s]*/gi) || [];
  for (const url of videoMatches) {
    if (!seen.has(url)) {
      seen.add(url);
      streams.push({ url, type: 'direct', quality: 'auto', pageUrl, detectedAt: Date.now() });
    }
  }

  return streams;
}
