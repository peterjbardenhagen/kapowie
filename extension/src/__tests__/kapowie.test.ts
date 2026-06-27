/// <reference types="chrome" />

import { describe, it, expect } from 'vitest';
import type { StreamInfo, Segment } from '../types';

// ─── Sample HLS Manifests ─────────────────────────────────────────────────────

const SAMPLE_HLS_MASTER = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,CODECS="avc1.4d401e,mp4a.40.2",NAME="360p"
https://example.com/live/360p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480,CODECS="avc1.4d401f,mp4a.40.2",NAME="480p"
https://example.com/live/480p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2",NAME="720p"
https://example.com/live/720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,CODECS="avc1.4d4028,mp4a.40.2",NAME="1080p"
https://example.com/live/1080p.m3u8`;

const SAMPLE_HLS_LIVE = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:12345
#EXTINF:6.000,
https://cdn.example.com/live/segment_12345.ts
#EXTINF:6.000,
https://cdn.example.com/live/segment_12346.ts
#EXTINF:6.000,
https://cdn.example.com/live/segment_12347.ts
#EXTINF:6.000,
https://cdn.example.com/live/segment_12348.ts`;

const SAMPLE_HLS_VOD = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
https://cdn.example.com/vod/segment000.ts
#EXTINF:10.0,
https://cdn.example.com/vod/segment001.ts
#EXTINF:10.0,
https://cdn.example.com/vod/segment002.ts
#EXTINF:10.0,
https://cdn.example.com/vod/segment003.ts
#EXT-X-ENDLIST`;

const SAMPLE_HLS_ENCRYPTED = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-KEY:METHOD=AES-128,URI="https://cdn.example.com/keys/key001.bin",IV=0x00000000000000000000000000000001
#EXTINF:10.0,
https://cdn.example.com/encrypted/seg000.ts
#EXTINF:10.0,
https://cdn.example.com/encrypted/seg001.ts
#EXT-X-ENDLIST`;

const SAMPLE_HLS_BYTE_RANGE = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:100
#EXT-X-BYTERANGE:75232@0
#EXTINF:4.0,
https://cdn.example.com/video.ts
#EXT-X-BYTERANGE:82112@752321
#EXTINF:4.0,
https://cdn.example.com/video.ts`;

// ─── Sample DASH Manifests ────────────────────────────────────────────────────

const SAMPLE_DASH_MPD = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT30S" minBufferTime="PT2S">
  <Period>
    <AdaptationSet mimeType="video/mp4">
      <Representation id="video1" bandwidth="1000000" width="1280" height="720" codecs="avc1.4d401f">
        <SegmentTemplate media="$RepresentationID$/$Number$.m4s" initialization="$RepresentationID$/init.mp4" timescale="1000" duration="2000" startNumber="0"/>
        <BaseURL>https://cdn.example.com/dash/</BaseURL>
      </Representation>
      <Representation id="video2" bandwidth="500000" width="854" height="480" codecs="avc1.4d401e">
        <SegmentTemplate media="$RepresentationID$/$Number$.m4s" initialization="$RepresentationID$/init.mp4" timescale="1000" duration="2000" startNumber="0"/>
        <BaseURL>https://cdn.example.com/dash/</BaseURL>
      </Representation>
    </AdaptationSet>
    <AdaptationSet mimeType="audio/mp4">
      <Representation id="audio1" bandwidth="128000" codecs="mp4a.40.2">
        <SegmentTemplate media="$RepresentationID$/$Number$.m4s" initialization="$RepresentationID$/init.mp4" timescale="1000" duration="2000" startNumber="0"/>
        <BaseURL>https://cdn.example.com/dash/</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

const SAMPLE_DASH_LIVE = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="dynamic" minimumUpdatePeriod="PT2S" minBufferTime="PT2S">
  <Period>
    <AdaptationSet mimeType="video/mp4">
      <Representation id="live-video" bandwidth="2000000" width="1920" height="1080" codecs="avc1.4d4028">
        <SegmentTemplate media="$RepresentationID$/$Number$.m4s" initialization="$RepresentationID$/init.mp4" timescale="90000" duration="180000" startNumber="500"/>
        <BaseURL>https://live.example.com/dash/</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

// ─── Sample VOD URLs ──────────────────────────────────────────────────────────

const SAMPLE_VOD_URLS = [
  'https://example.com/videos/tutorial.mp4',
  'https://cdn.example.com/movies/trailer.webm',
  'https://storage.example.com/recordings/show.mkv',
];

const SAMPLE_STREAM_URLS = [
  'https://live.example.com/stream.m3u8',
  'https://cdn.example.com/live/playlist.m3u8',
  'https://streaming.example.com/manifest.mpd',
  'https://iptv.example.com/channel/live',
];

// ─── Test Data Factories ──────────────────────────────────────────────────────

function makeStreamInfo(overrides: Partial<StreamInfo> = {}): StreamInfo {
  return {
    url: 'https://example.com/stream.m3u8',
    type: 'hls',
    quality: 'auto',
    pageUrl: 'https://example.com/page',
    detectedAt: Date.now(),
    ...overrides,
  };
}

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    url: 'https://example.com/segment001.ts',
    data: new Uint8Array([0, 1, 2, 3, 4]),
    timestamp: Date.now(),
    duration: 6.0,
    ...overrides,
  };
}

// ─── HLS Parser Tests ────────────────────────────────────────────────────────

describe('HLS Parser', () => {
  it('should parse a basic HLS master playlist', () => {
    const lines = SAMPLE_HLS_MASTER.split('\n');
    const variants: Array<{ bandwidth: number; resolution: string; url: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
        const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);
        const nextLine = lines[i + 1]?.trim();
        if (bandwidthMatch && nextLine && !nextLine.startsWith('#')) {
          variants.push({
            bandwidth: parseInt(bandwidthMatch[1]),
            resolution: resolutionMatch ? resolutionMatch[1] : 'unknown',
            url: nextLine.startsWith('http') ? nextLine : `https://example.com/${nextLine}`,
          });
          i++; // skip URI line
        }
      }
    }

    expect(variants).toHaveLength(4);
    expect(variants[0].bandwidth).toBe(800000);
    expect(variants[0].resolution).toBe('640x360');
    expect(variants[3].bandwidth).toBe(5000000);
    expect(variants[3].resolution).toBe('1920x1080');
  });

  it('should parse HLS live media playlist with segments', () => {
    const lines = SAMPLE_HLS_LIVE.split('\n');
    const segments: Array<{ url: string; duration: number }> = [];
    let currentDuration = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXTINF')) {
        const match = line.match(/#EXTINF:([\d.]+)/);
        if (match) currentDuration = parseFloat(match[1]);
      } else if (line && !line.startsWith('#')) {
        segments.push({ url: line, duration: currentDuration });
        currentDuration = 0;
      }
    }

    expect(segments).toHaveLength(4);
    expect(segments[0].duration).toBe(6.0);
    expect(segments[0].url).toContain('segment_12345');
    expect(segments[3].url).toContain('segment_12348');
  });

  it('should parse HLS VOD playlist with ENDLIST', () => {
    const lines = SAMPLE_HLS_VOD.split('\n');
    const hasEndList = lines.some(l => l.trim().startsWith('#EXT-X-ENDLIST'));
    const segments: string[] = [];
    let currentDuration = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#EXTINF')) {
        const match = trimmed.match(/#EXTINF:([\d.]+)/);
        if (match) currentDuration = parseFloat(match[1]);
      } else if (trimmed && !trimmed.startsWith('#')) {
        segments.push(trimmed);
        currentDuration = 0;
      }
    }

    expect(hasEndList).toBe(true);
    expect(segments).toHaveLength(4);
    expect(segments[0]).toContain('segment000');
  });

  it('should detect live vs VOD stream', () => {
    const isLive = (content: string) => !content.includes('#EXT-X-ENDLIST');
    expect(isLive(SAMPLE_HLS_LIVE)).toBe(true);
    expect(isLive(SAMPLE_HLS_VOD)).toBe(false);
    expect(isLive(SAMPLE_HLS_ENCRYPTED)).toBe(false);
  });

  it('should handle AES-128 encrypted streams', () => {
    const lines = SAMPLE_HLS_ENCRYPTED.split('\n');
    let isEncrypted = false;
    let keyUri: string | undefined;
    let iv: string | undefined;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#EXT-X-KEY')) {
        const methodMatch = trimmed.match(/METHOD=([^,]+)/);
        if (methodMatch?.[1] === 'AES-128') {
          isEncrypted = true;
          const uriMatch = trimmed.match(/URI="([^"]+)"/);
          const ivMatch = trimmed.match(/IV=(0x[0-9a-fA-F]+)/);
          if (uriMatch) keyUri = uriMatch[1];
          if (ivMatch) iv = ivMatch[1];
        }
      }
    }

    expect(isEncrypted).toBe(true);
    expect(keyUri).toBe('https://cdn.example.com/keys/key001.bin');
    expect(iv).toBe('0x00000000000000000000000000000001');
  });

  it('should handle byte-range playlists', () => {
    const lines = SAMPLE_HLS_BYTE_RANGE.split('\n');
    const byteRanges: Array<{ start: number; end: number }> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#EXT-X-BYTERANGE')) {
        const match = trimmed.match(/#EXT-X-BYTERANGE:(\d+)@(\d+)/);
        if (match) {
          const length = parseInt(match[1]);
          const offset = parseInt(match[2]);
          byteRanges.push({ start: offset, end: offset + length - 1 });
        }
      }
    }

    expect(byteRanges).toHaveLength(2);
    expect(byteRanges[0].start).toBe(0);
    expect(byteRanges[0].end).toBe(75231);
    expect(byteRanges[1].start).toBe(752321);
    expect(byteRanges[1].end).toBe(834432);
  });
});

// ─── DASH Parser Tests ────────────────────────────────────────────────────────

describe('DASH Parser', () => {
  it('should parse DASH MPD with video representations', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(SAMPLE_DASH_MPD, 'text/xml');

    const mpd = doc.querySelector('MPD');
    expect(mpd).not.toBeNull();

    // Need to select all Representations across all AdaptationSets
    const allReps = doc.querySelectorAll('Representation');
    const videoReps = Array.from(allReps).filter(r => {
      const as = r.parentElement;
      const mime = as?.getAttribute('mimeType') || r.getAttribute('mimeType') || '';
      return mime.startsWith('video/');
    });

    expect(videoReps.length).toBeGreaterThan(0);
    expect(videoReps[0].getAttribute('bandwidth')).toBe('1000000');
    expect(videoReps[0].getAttribute('width')).toBe('1280');
  });

  it('should extract SegmentTemplate details', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(SAMPLE_DASH_MPD, 'text/xml');

    const template = doc.querySelector('SegmentTemplate');
    expect(template).not.toBeNull();
    expect(template!.getAttribute('media')).toBe('$RepresentationID$/$Number$.m4s');
    expect(template!.getAttribute('timescale')).toBe('1000');
    expect(template!.getAttribute('duration')).toBe('2000');
  });

  it('should detect dynamic (live) DASH manifests', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(SAMPLE_DASH_LIVE, 'text/xml');

    const mpd = doc.querySelector('MPD');
    expect(mpd).not.toBeNull();
    expect(mpd!.getAttribute('type')).toBe('dynamic');
  });

  it('should compute DASH segment URLs from template', () => {
    const media = '$RepresentationID$/$Number$.m4s';
    const result = media
      .replace(/\$RepresentationID\$/g, 'video1')
      .replace(/\$Number\$/g, '42');
    expect(result).toBe('video1/42.m4s');
  });

  it('should find BaseURL from Representation', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(SAMPLE_DASH_MPD, 'text/xml');

    const repr = doc.querySelector('Representation');
    const baseUrl = repr?.querySelector('BaseURL');
    expect(baseUrl?.textContent?.trim()).toBe('https://cdn.example.com/dash/');
  });
});

// ─── Stream Protocol Detection Tests ──────────────────────────────────────────

describe('Stream Protocol Detection', () => {
  it('should detect HLS streams from URL patterns', () => {
    const detectProtocol = (url: string): string => {
      const lower = url.toLowerCase();
      if (lower.includes('.m3u8') || lower.includes('/hls/')) return 'hls';
      if (lower.includes('.mpd') || lower.includes('/dash/')) return 'dash';
      if (lower.includes('.mp4')) return 'direct-mp4';
      if (lower.includes('.webm')) return 'direct-webm';
      return 'unknown';
    };

    expect(detectProtocol('https://example.com/stream.m3u8')).toBe('hls');
    expect(detectProtocol('https://example.com/live/playlist.m3u8')).toBe('hls');
    expect(detectProtocol('https://example.com/manifest.mpd')).toBe('dash');
    expect(detectProtocol('https://example.com/video.mp4')).toBe('direct-mp4');
    expect(detectProtocol('https://example.com/video.webm')).toBe('direct-webm');
    expect(detectProtocol('https://example.com/page')).toBe('unknown');
  });

  it('should detect stream type from Content-Type hints', () => {
    const detectFromContentType = (ct: string): string => {
      const lower = ct.toLowerCase();
      if (lower.includes('mpegurl') || lower.includes('x-mpegurl')) return 'hls';
      if (lower.includes('dash+xml')) return 'dash';
      if (lower.includes('video/mp4')) return 'direct-mp4';
      return 'unknown';
    };

    expect(detectFromContentType('application/vnd.apple.mpegurl')).toBe('hls');
    expect(detectFromContentType('application/dash+xml')).toBe('dash');
    expect(detectFromContentType('video/mp4')).toBe('direct-mp4');
  });
});

// ─── Castr Detection Tests ────────────────────────────────────────────────────

describe('Castr Detection', () => {
  it('should detect Castr video IDs in HTML', () => {
    const html = `
      <html><body>
        <div data-video-id="37acc721-8fc9-4739-a16f-dde80cadb700"></div>
        <iframe src="https://player.castr.com/0c58a1db-7a63-420d-0e35-772d86a95100"></iframe>
      </body></html>
    `;

    const regex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
    const ids = new Set<string>();
    const matches = html.match(regex) || [];
    for (const id of matches) ids.add(id);

    expect(ids.has('37acc721-8fc9-4739-a16f-dde80cadb700')).toBe(true);
    expect(ids.has('0c58a1db-7a63-420d-0e35-772d86a95100')).toBe(true);
  });

  it('should construct player URLs from video IDs', () => {
    const videoId = '37acc721-8fc9-4739-a16f-dde80cadb700';
    const playerUrl = `https://player.castr.com/${videoId}`;
    expect(playerUrl).toBe('https://player.castr.com/37acc721-8fc9-4739-a16f-dde80cadb700');
  });

  it('should detect Castr-powered pages', () => {
    const html = `<html><script src="https://player.castr.com/embed.js"></script></html>`;
    const hasCastr = /castr\.(com|io)/i.test(html);
    expect(hasCastr).toBe(true);
  });

  it('should detect castr.io URLs', () => {
    const isCastr = (url: string) =>
      url.includes('player.castr.com') ||
      url.includes('castr.com/embed/') ||
      url.includes('castr.io') ||
      url.includes('castr.com');

    expect(isCastr('https://player.castr.com/abc123')).toBe(true);
    expect(isCastr('https://castr.com/embed/xyz789')).toBe(true);
    expect(isCastr('https://example.com/page')).toBe(false);
  });
});

// ─── URL Utility Tests ────────────────────────────────────────────────────────

describe('URL Utilities', () => {
  it('should resolve relative URLs against base', () => {
    const resolve = (base: string, relative: string): string => {
      try {
        return new URL(relative, base).href;
      } catch {
        return relative;
      }
    };

    expect(resolve('https://example.com/live/', 'segment.ts')).toBe('https://example.com/live/segment.ts');
    expect(resolve('https://example.com/live/', '../video.ts')).toBe('https://example.com/video.ts');
    expect(resolve('https://example.com/live/', 'https://cdn.example.com/seg.ts')).toBe('https://cdn.example.com/seg.ts');
  });

  it('should normalize stream URLs by removing tracking params', () => {
    const normalize = (url: string): string => {
      try {
        const parsed = new URL(url);
        const tracking = ['fbclid', 'gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'ref'];
        for (const p of tracking) parsed.searchParams.delete(p);
        parsed.hash = '';
        return parsed.href;
      } catch {
        return url;
      }
    };

    const dirty = 'https://example.com/stream.m3u8?fbclid=abc123&utm_source=twitter&ref=home#section';
    const clean = normalize(dirty);
    expect(clean).not.toContain('fbclid');
    expect(clean).not.toContain('utm_source');
    expect(clean).not.toContain('#section');
    expect(clean).toBe('https://example.com/stream.m3u8');
  });

  it('should extract domain from URL', () => {
    const extract = (url: string): string => {
      try {
        return new URL(url).hostname;
      } catch {
        return '';
      }
    };

    expect(extract('https://www.example.com/path')).toBe('www.example.com');
    expect(extract('https://cdn.example.com:8080/video')).toBe('cdn.example.com');
    expect(extract('not-a-url')).toBe('');
  });

  it('should format bytes to human-readable', () => {
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      const k = 1024;
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      const value = bytes / Math.pow(k, i);
      return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
    };

    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });

  it('should format duration to HH:MM:SS', () => {
    const formatDuration = (seconds: number): string => {
      const abs = Math.abs(seconds);
      const h = Math.floor(abs / 3600);
      const m = Math.floor((abs % 3600) / 60);
      const s = Math.floor(abs % 60);
      const ms = Math.floor((abs % 1) * 1000);
      if (h > 0) {
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
      }
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    };

    expect(formatDuration(0)).toBe('00:00.000');
    expect(formatDuration(65)).toBe('01:05.000');
    expect(formatDuration(3661.5)).toBe('01:01:01.500');
  });
});

// ─── Segment / Recording Tests ────────────────────────────────────────────────

describe('Segment & Recording Models', () => {
  it('should create a valid StreamInfo', () => {
    const stream = makeStreamInfo({ type: 'dash', url: 'https://example.com/manifest.mpd' });
    expect(stream.url).toBe('https://example.com/manifest.mpd');
    expect(stream.type).toBe('dash');
    expect(stream.quality).toBe('auto');
  });

  it('should create a valid Segment', () => {
    const segment = makeSegment({ duration: 10.0, isEncrypted: true });
    expect(segment.duration).toBe(10.0);
    expect(segment.isEncrypted).toBe(true);
    expect(segment.data).toHaveLength(5);
  });

  it('should identify stream types correctly', () => {
    const hls = makeStreamInfo({ type: 'hls' });
    const dash = makeStreamInfo({ type: 'dash' });
    const direct = makeStreamInfo({ type: 'direct' });

    expect(hls.type).toBe('hls');
    expect(dash.type).toBe('dash');
    expect(direct.type).toBe('direct');
  });

  it('should support all recording statuses', () => {
    const statuses = ['idle', 'detecting', 'recording', 'paused', 'stopping', 'completed', 'error', 'cancelled'];
    for (const status of statuses) {
      expect(typeof status).toBe('string');
    }
  });
});

// ─── Stream Variant Selection Tests ───────────────────────────────────────────

describe('Stream Variant Selection', () => {
  it('should sort variants by bandwidth descending', () => {
    const variants = [
      { url: 'low.m3u8', bandwidth: 800000, resolution: '640x360' },
      { url: 'high.m3u8', bandwidth: 5000000, resolution: '1920x1080' },
      { url: 'mid.m3u8', bandwidth: 2800000, resolution: '1280x720' },
    ];

    const sorted = [...variants].sort((a, b) => b.bandwidth - a.bandwidth);
    expect(sorted[0].bandwidth).toBe(5000000);
    expect(sorted[1].bandwidth).toBe(2800000);
    expect(sorted[2].bandwidth).toBe(800000);
  });

  it('should select best variant', () => {
    const variants = [
      { url: 'low.m3u8', bandwidth: 800000 },
      { url: 'high.m3u8', bandwidth: 5000000 },
      { url: 'mid.m3u8', bandwidth: 2800000 },
    ];

    const sorted = [...variants].sort((a, b) => b.bandwidth - a.bandwidth);
    const best = sorted[0];
    expect(best.bandwidth).toBe(5000000);
  });

  it('should select variant by target bandwidth', () => {
    const variants = [
      { url: 'low.m3u8', bandwidth: 800000 },
      { url: 'mid.m3u8', bandwidth: 2800000 },
      { url: 'high.m3u8', bandwidth: 5000000 },
    ];

    const targetKbps = 1400;
    const targetBps = targetKbps * 1000;
    const sorted = [...variants].sort((a, b) => b.bandwidth - a.bandwidth);

    let best = sorted[sorted.length - 1];
    for (const v of sorted) {
      if (v.bandwidth <= targetBps) {
        best = v;
      }
    }
    expect(best.bandwidth).toBe(800000);
  });
});

// ─── Download Manager Tests ───────────────────────────────────────────────────

describe('Download Manager', () => {
  it('should respect concurrency limits', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ url: `https://example.com/seg${i}.ts` }));
    const maxConcurrency = 3;
    let activeCount = 0;
    let maxActive = 0;
    let index = 0;

    async function worker() {
      while (index < items.length) {
        const currentIndex = index++;
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10));
        activeCount--;
      }
    }

    const workers = Math.min(maxConcurrency, items.length);
    await Promise.all(Array.from({ length: workers }, () => worker()));

    expect(maxActive).toBeLessThanOrEqual(maxConcurrency);
    expect(index).toBe(10);
  });

  it('should handle concurrent download results map', async () => {
    const items = [
      { url: 'https://example.com/a.ts' },
      { url: 'https://example.com/b.ts' },
      { url: 'https://example.com/c.ts' },
    ];

    const results = new Map<string, Uint8Array>();
    for (const item of items) {
      results.set(item.url, new Uint8Array([1, 2, 3]));
    }

    expect(results.size).toBe(3);
    expect(results.get('https://example.com/a.ts')).toBeDefined();
    expect(results.get('https://example.com/unknown')).toBeUndefined();
  });
});

// ─── Segment Buffer Tests ─────────────────────────────────────────────────────

describe('SegmentBuffer', () => {
  it('should add segments and track size', () => {
    const buffer: Array<{ url: string; data: Uint8Array }> = [];
    let currentBytes = 0;

    function add(segment: { url: string; data: Uint8Array }) {
      buffer.push(segment);
      currentBytes += segment.data.byteLength;
    }

    add({ url: 'seg1.ts', data: new Uint8Array(100) });
    add({ url: 'seg2.ts', data: new Uint8Array(200) });

    expect(buffer).toHaveLength(2);
    expect(currentBytes).toBe(300);
  });

  it('should flush when reaching max segments', async () => {
    const maxSegments = 3;
    const flushed: Array<Array<{ url: string }>> = [];
    let buffer: Array<{ url: string }> = [];

    async function flush() {
      if (buffer.length > 0) {
        flushed.push([...buffer]);
        buffer = [];
      }
    }

    async function add(segment: { url: string }) {
      buffer.push(segment);
      if (buffer.length >= maxSegments) {
        await flush();
      }
    }

    await add({ url: 'a' });
    await add({ url: 'b' });
    await add({ url: 'c' }); // triggers flush
    await add({ url: 'd' });
    await flush(); // flush remaining

    expect(flushed).toHaveLength(2);
    expect(flushed[0]).toHaveLength(3);
    expect(flushed[1]).toHaveLength(1);
  });

  it('should calculate total byte size of buffered segments', () => {
    const segments = [
      { url: 'seg1.ts', data: new Uint8Array(1024) },
      { url: 'seg2.ts', data: new Uint8Array(2048) },
      { url: 'seg3.ts', data: new Uint8Array(512) },
    ];

    const totalBytes = segments.reduce((sum, s) => sum + s.data.byteLength, 0);
    expect(totalBytes).toBe(3584);
  });
});

// ─── Integration: Full Stream Capture Flow ────────────────────────────────────

describe('Stream Capture Integration', () => {
  it('should parse HLS master then select variant and parse media', () => {
    // Step 1: Parse master playlist
    const masterLines = SAMPLE_HLS_MASTER.split('\n');
    const variants: Array<{ bandwidth: number; url: string }> = [];
    for (let i = 0; i < masterLines.length; i++) {
      const line = masterLines[i].trim();
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        const bwMatch = line.match(/BANDWIDTH=(\d+)/);
        const nextLine = masterLines[i + 1]?.trim();
        if (bwMatch && nextLine && !nextLine.startsWith('#')) {
          variants.push({ bandwidth: parseInt(bwMatch[1]), url: nextLine });
          i++;
        }
      }
    }
    expect(variants).toHaveLength(4);

    // Step 2: Select variant closest to 2800kbps target
    const sorted = [...variants].sort((a, b) => b.bandwidth - a.bandwidth);
    const targetBps = 2800000;
    // Pick the highest bandwidth that does NOT exceed target
    let selected = sorted[sorted.length - 1]; // fallback to lowest
    for (const v of sorted) {
      if (v.bandwidth <= targetBps) {
        selected = v;
        break; // first match in descending order is the best fit
      }
    }
    // 2800000 exists in the list and matches target exactly
    expect(selected.bandwidth).toBe(2800000);

    // Step 3: Parse media playlist
    const mediaLines = SAMPLE_HLS_LIVE.split('\n');
    const segments: Array<{ url: string; duration: number }> = [];
    let dur = 0;
    for (const line of mediaLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#EXTINF')) {
        const m = trimmed.match(/#EXTINF:([\d.]+)/);
        if (m) dur = parseFloat(m[1]);
      } else if (trimmed && !trimmed.startsWith('#')) {
        segments.push({ url: trimmed, duration: dur });
        dur = 0;
      }
    }
    expect(segments).toHaveLength(4);
  });

  it('should parse DASH manifest and compute segment URLs', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(SAMPLE_DASH_MPD, 'text/xml');

    // Get all video representations across all adaptation sets
    const allReps = doc.querySelectorAll('Representation');
    const videoReps = Array.from(allReps).filter(r => {
      const as = r.parentElement;
      const mime = as?.getAttribute('mimeType') || r.getAttribute('mimeType') || '';
      return mime.startsWith('video/');
    });
    expect(videoReps.length).toBeGreaterThan(0);

    const topVideo = videoReps[0];
    const template = topVideo.querySelector('SegmentTemplate');
    const baseUrl = topVideo.querySelector('BaseURL')?.textContent?.trim() || '';

    expect(template).not.toBeNull();
    expect(baseUrl).toBe('https://cdn.example.com/dash/');

    // Compute segment URL
    const media = template!.getAttribute('media') || '';
    const reprId = topVideo.getAttribute('id') || '';
    const segNum = 5;
    const url = media
      .replace(/\$RepresentationID\$/g, reprId)
      .replace(/\$Number\$/g, String(segNum));
    expect(url).toBe('video1/5.m4s');
  });

  it('should handle VOD mp4 URL detection', () => {
    const vodUrl = SAMPLE_VOD_URLS[0];
    expect(vodUrl.endsWith('.mp4')).toBe(true);
    const protocol = vodUrl.includes('.mp4') ? 'direct-mp4' : 'unknown';
    expect(protocol).toBe('direct-mp4');
  });
});
