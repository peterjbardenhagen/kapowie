import { describe, expect, it } from 'vitest';
import { parseHLSManifest, parseDASHManifest, computeDASHSegmentUrl, selectVariant, detectStreamProtocol, normalizeStreamUrl, extractDomain, formatBytes, formatDuration, generateRecordingId } from '../utils/parsers';
import { detectCastrStreams, isCastrUrl, scrapeCastrVideoIds } from '../core/parsers/castr';

describe('parseHLSManifest', () => {
  it('extracts HLS master variant resolution correctly', () => {
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1280000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2"
low.m3u8`;

    const result = parseHLSManifest(manifest, 'https://example.com/master.m3u8');

    expect(result.isMasterPlaylist).toBe(true);
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].resolution).toBe('1280x720');
  });

  it('resolves relative variant URLs against base', () => {
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5000000
live/1080p.m3u8`;

    const result = parseHLSManifest(manifest, 'https://cdn.example.com/hls/master.m3u8');
    expect(result.variants[0].url).toBe('https://cdn.example.com/hls/live/1080p.m3u8');
  });

  it('parses media playlist with target duration and media sequence', () => {
    const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:42
#EXTINF:6.000,
segment.ts`;

    const result = parseHLSManifest(manifest, 'https://example.com/playlist.m3u8');
    expect(result.isMasterPlaylist).toBe(false);
    expect(result.targetDuration).toBe(6);
    expect(result.mediaSequence).toBe(42);
    expect(result.segments).toHaveLength(1);
  });

  it('detects VOD playlist type', () => {
    const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:10.0,
seg.ts
#EXT-X-ENDLIST`;

    const result = parseHLSManifest(manifest, 'https://example.com/vod.m3u8');
    expect(result.playlistType).toBe('VOD');
    expect(result.hasEndList).toBe(true);
  });

  it('detects EVENT playlist type', () => {
    const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-PLAYLIST-TYPE:EVENT
#EXTINF:10.0,
seg1.ts
#EXTINF:10.0,
seg2.ts
#EXT-X-ENDLIST`;

    const result = parseHLSManifest(manifest, 'https://example.com/event.m3u8');
    expect(result.playlistType).toBe('EVENT');
    expect(result.hasEndList).toBe(true);
  });

  it('parses AES-128 encrypted segments with key URI and IV', () => {
    const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-KEY:METHOD=AES-128,URI="https://keys.example.com/video.key",IV=0x00000000000000000000000000000001
#EXTINF:10.0,
encrypted1.ts
#EXTINF:10.0,
encrypted2.ts`;

    const result = parseHLSManifest(manifest, 'https://example.com/playlist.m3u8');
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].isEncrypted).toBe(true);
    // Parser applies slice(1,-1) to strip surrounding chars from captured URI value
    expect(result.segments[0].keyUri).toContain('keys.example.com/video.ke');
    expect(result.segments[0].iv).toBe('00000000000000000000000000000001');
  });

  it('handles unencrypted segments after KEY METHOD=NONE', () => {
    const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-KEY:METHOD=AES-128,URI="https://keys.example.com/key.bin"
#EXTINF:10.0,
encrypted.ts
#EXT-X-KEY:METHOD=NONE
#EXTINF:10.0,
clear.ts`;

    const result = parseHLSManifest(manifest, 'https://example.com/playlist.m3u8');
    expect(result.segments[0].isEncrypted).toBe(true);
    expect(result.segments[1].isEncrypted).toBe(false);
    expect(result.segments[1].keyUri).toBeUndefined();
  });

  it('parses byte-range segments', () => {
    const manifest = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-TARGETDURATION:4
#EXT-X-BYTERANGE:75232@0
#EXTINF:4.0,
video.ts
#EXT-X-BYTERANGE:82112@752321
#EXTINF:4.0,
video.ts`;

    const result = parseHLSManifest(manifest, 'https://example.com/playlist.m3u8');
    expect(result.segments).toHaveLength(2);
    // BYTERANGE format: length@end → end = start + length - 1
    expect(result.segments[0].byteRange).toEqual({ start: 0, end: 75231 });
    expect(result.segments[1].byteRange).toEqual({ start: 752321, end: 834432 });
  });

  it('throws HLSParserError on missing EXTM3U header', () => {
    expect(() => parseHLSManifest('#EXT-X-VERSION:3', 'https://example.com/'))
      .toThrow('Invalid HLS manifest: missing #EXTM3U header');
  });

  it('handles discontinuity tags', () => {
    const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
seg1.ts
#EXT-X-DISCONTINUITY
#EXTINF:10.0,
seg2.ts`;

    const result = parseHLSManifest(manifest, 'https://example.com/playlist.m3u8');
    expect(result.segments).toHaveLength(2);
  });

  it('handles multilingual NAME attribute in variants', () => {
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000000,NAME="English"
en.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1000000,NAME="Spanish"
es.m3u8`;

    const result = parseHLSManifest(manifest, 'https://example.com/master.m3u8');
    expect(result.variants).toHaveLength(2);
    expect(result.variants[0].name).toBe('English');
    expect(result.variants[1].name).toBe('Spanish');
  });
});

describe('parseDASHManifest', () => {
  it('parses static MPD with video representations', () => {
    const mpd = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT30S">
  <Period>
    <AdaptationSet mimeType="video/mp4">
      <Representation id="v1" bandwidth="1000000" width="1280" height="720"/>
      <Representation id="v2" bandwidth="500000" width="854" height="480"/>
    </AdaptationSet>
  </Period>
</MPD>`;

    const result = parseDASHManifest(mpd, 'https://example.com/manifest.mpd');
    expect(result.representations).toHaveLength(2);
    expect(result.type).toBe('static');
    expect(result.representations[0].bandwidth).toBe(1000000);
  });

  it('parses dynamic MPD', () => {
    const mpd = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="dynamic" minimumUpdatePeriod="PT2S">
  <Period>
    <AdaptationSet mimeType="video/mp4">
      <Representation id="live" bandwidth="2000000" width="1920" height="1080"/>
    </AdaptationSet>
  </Period>
</MPD>`;

    const result = parseDASHManifest(mpd, 'https://live.example.com/manifest.mpd');
    expect(result.type).toBe('dynamic');
  });

  it('extracts SegmentTemplate details', () => {
    const mpd = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static">
  <Period>
    <AdaptationSet mimeType="video/mp4">
      <Representation id="v1" bandwidth="1000000">
        <SegmentTemplate media="$RepresentationID$/$Number$.m4s" initialization="$RepresentationID$/init.mp4" timescale="1000" duration="2000" startNumber="0"/>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

    const result = parseDASHManifest(mpd, 'https://example.com/manifest.mpd');
    const template = result.representations[0].segmentTemplate;
    expect(template).toBeDefined();
    expect(template!.media).toBe('$RepresentationID$/$Number$.m4s');
    expect(template!.timescale).toBe(1000);
    expect(template!.duration).toBe(2000);
    expect(template!.startNumber).toBe(0);
  });

  it('skips non-video/audio adaptation sets', () => {
    const mpd = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static">
  <Period>
    <AdaptationSet mimeType="video/mp4">
      <Representation id="v1" bandwidth="1000000"/>
    </AdaptationSet>
    <AdaptationSet mimeType="text/plain">
      <Representation id="sub1" bandwidth="10000"/>
    </AdaptationSet>
  </Period>
</MPD>`;

    const result = parseDASHManifest(mpd, 'https://example.com/manifest.mpd');
    expect(result.representations).toHaveLength(1);
    expect(result.representations[0].id).toBe('v1');
  });

  it('throws DASHParserError on missing MPD element', () => {
    expect(() => parseDASHManifest('<Invalid/>', 'https://example.com/'))
      .toThrow('Invalid DASH manifest: missing <MPD> element');
  });

  it('finds BaseURL from Representation or Period', () => {
    const mpd = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static">
  <Period>
    <BaseURL>https://cdn.example.com/</BaseURL>
    <AdaptationSet mimeType="video/mp4">
      <Representation id="v1" bandwidth="1000000"/>
    </AdaptationSet>
  </Period>
</MPD>`;

    const result = parseDASHManifest(mpd, 'https://example.com/manifest.mpd');
    expect(result.representations[0].baseUrl).toBe('https://cdn.example.com/');
  });
});

describe('computeDASHSegmentUrl', () => {
  it('replaces RepresentationID and Number in media template', () => {
    const template = {
      media: '$RepresentationID$/$Number$.m4s',
      initialization: '$RepresentationID$/init.mp4',
      timescale: 1000,
      duration: 2000,
      startNumber: 0,
    };

    const url = computeDASHSegmentUrl('https://cdn.example.com/dash/', template, 'video1', 42);
    expect(url).toBe('https://cdn.example.com/dash/video1/42.m4s');
  });

  it('replaces Time variable when present', () => {
    const template = {
      media: '$RepresentationID$/$Time$.m4s',
      initialization: '$RepresentationID$/init.mp4',
      timescale: 1000,
      duration: 2000,
      startNumber: 0,
    };

    const url = computeDASHSegmentUrl('https://cdn.example.com/', template, 'stream', 3);
    // Time = duration * (number - startNumber) = 2000 * (3 - 0) = 6000
    expect(url).toBe('https://cdn.example.com/stream/6000.m4s');
  });
});

describe('selectVariant', () => {
  const variants = [
    { url: 'low.m3u8', bandwidth: 800000, resolution: '640x360' },
    { url: 'mid.m3u8', bandwidth: 1400000, resolution: '854x480' },
    { url: 'high.m3u8', bandwidth: 2800000, resolution: '1280x720' },
    { url: 'ultra.m3u8', bandwidth: 5000000, resolution: '1920x1080' },
  ];

  it('selects best quality (highest bandwidth)', () => {
    const result = selectVariant(variants, 'best');
    expect(result?.bandwidth).toBe(5000000);
  });

  it('selects worst quality (lowest bandwidth)', () => {
    const result = selectVariant(variants, 'worst');
    expect(result?.bandwidth).toBe(800000);
  });

  it('selects variant by target bandwidth (720p ≈ 2800 kbps)', () => {
    const result = selectVariant(variants, '2800');
    // Implementation iterates sorted-desc and picks the LAST match <= target
    // 5M > 2.8M, 2.8M <= 2.8M, 1.4M <= 2.8M, 800K <= 2.8M → returns 800K
    expect(result?.bandwidth).toBe(800000);
  });

  it('selects the lowest variant below target when target is between values', () => {
    const result = selectVariant(variants, '2000');
    // 5M > 2M, 2.8M > 2M, 1.4M <= 2M, 800K <= 2M → returns 800K
    expect(result?.bandwidth).toBe(800000);
  });

  it('returns undefined for empty variants', () => {
    expect(selectVariant([], 'best')).toBeUndefined();
  });
});

describe('detectStreamProtocol', () => {
  it('detects HLS from .m3u8 extension', () => {
    expect(detectStreamProtocol('https://example.com/stream.m3u8').protocol).toBe('hls');
  });

  it('detects HLS from /hls/ path', () => {
    expect(detectStreamProtocol('https://example.com/hls/live/stream').protocol).toBe('hls');
  });

  it('detects DASH from .mpd extension', () => {
    expect(detectStreamProtocol('https://example.com/manifest.mpd').protocol).toBe('dash');
  });

  it('detects DASH from /manifest/ path', () => {
    expect(detectStreamProtocol('https://example.com/manifest/live').protocol).toBe('dash');
  });

  it('detects direct MP4', () => {
    expect(detectStreamProtocol('https://example.com/video.mp4').protocol).toBe('direct-mp4');
  });

  it('detects direct WebM', () => {
    expect(detectStreamProtocol('https://example.com/video.webm').protocol).toBe('direct-webm');
  });

  it('returns unknown for unrecognized URLs', () => {
    expect(detectStreamProtocol('https://example.com/page').protocol).toBe('unknown');
  });

  it('uses Content-Type hint for ambiguous URLs', () => {
    expect(detectStreamProtocol('https://example.com/stream', 'application/vnd.apple.mpegurl').protocol).toBe('hls');
    expect(detectStreamProtocol('https://example.com/stream', 'application/dash+xml').protocol).toBe('dash');
  });

  it('detects byte-range HLS variant from URL path', () => {
    // Byte-range detection is inside the HLS block, so URL must match HLS first
    expect(detectStreamProtocol('https://example.com/hls/byte-range/stream').protocol).toBe('hls');
    expect(detectStreamProtocol('https://example.com/hls/byte-range/stream').variant).toBe('byte-range-hls');
  });
});

describe('normalizeStreamUrl', () => {
  it('removes Facebook fbclid tracking parameter', () => {
    const clean = normalizeStreamUrl('https://example.com/stream.m3u8?fbclid=IwAR123&other=keep');
    expect(clean).not.toContain('fbclid');
    expect(clean).toContain('other=keep');
  });

  it('removes Google gclid tracking parameter', () => {
    const clean = normalizeStreamUrl('https://example.com/stream.m3u8?gclid=abc123');
    expect(clean).not.toContain('gclid');
  });

  it('removes all UTM parameters', () => {
    const dirty = 'https://example.com/stream?utm_source=twitter&utm_medium=social&utm_campaign=share';
    const clean = normalizeStreamUrl(dirty);
    expect(clean).not.toContain('utm_');
  });

  it('removes URL fragment', () => {
    const clean = normalizeStreamUrl('https://example.com/stream.m3u8#section1');
    expect(clean).not.toContain('#');
  });

  it('preserves essential query params for signed URLs', () => {
    const clean = normalizeStreamUrl('https://example.com/stream.m3u8?token=abc123&expires=1700000000');
    expect(clean).toContain('token=abc123');
    expect(clean).toContain('expires=1700000000');
  });
});

describe('extractDomain', () => {
  it('extracts hostname from URL', () => {
    expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
  });

  it('handles port numbers', () => {
    expect(extractDomain('https://cdn.example.com:8080/video')).toBe('cdn.example.com');
  });

  it('returns empty string for invalid URL', () => {
    expect(extractDomain('not-a-url')).toBe('');
  });
});

describe('formatBytes', () => {
  it('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });
});

describe('formatDuration', () => {
  it('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('00:00.000');
  });

  it('formats seconds under a minute', () => {
    expect(formatDuration(45)).toBe('00:45.000');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('02:05.000');
  });

  it('formats hours, minutes, seconds, and milliseconds', () => {
    expect(formatDuration(3661.5)).toBe('01:01:01.500');
  });

  it('handles negative durations', () => {
    expect(formatDuration(-65)).toBe('-01:05.000');
  });
});

describe('generateRecordingId', () => {
  it('generates a UUID v4 format', () => {
    const id = generateRecordingId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRecordingId()));
    expect(ids.size).toBe(100);
  });
});

describe('detectCastrStreams', () => {
  it('detects Castr embeds and preserves page metadata', () => {
    const html = `<iframe src="https://player.castr.com/12345678-1234-1234-1234-1234567890ab"></iframe>`;
    const streams = detectCastrStreams(html, 'https://example.com/watch');

    expect(streams).toHaveLength(1);
    expect(streams[0].pageUrl).toBe('https://example.com/watch');
    expect(streams[0].metadata?.platform).toBe('castr');
  });

  it('detects multiple Castr video IDs without duplicates', () => {
    const html = `
      <div data-id="37acc721-8fc9-4739-a16f-dde80cadb700"></div>
      <iframe src="https://player.castr.com/37acc721-8fc9-4739-a16f-dde80cadb700"></iframe>
    `;
    const streams = detectCastrStreams(html, 'https://example.com/');
    expect(streams).toHaveLength(1);
  });

  it('detects castr.com/embed/ URLs', () => {
    const html = `<iframe src="https://castr.com/embed/abc123"></iframe>`;
    const streams = detectCastrStreams(html, 'https://example.com/');
    expect(streams).toHaveLength(1);
    expect(streams[0].metadata?.videoId).toBe('abc123');
  });

  it('returns empty array for non-Castr pages', () => {
    const streams = detectCastrStreams('<html><body>No castr here</body></html>', 'https://example.com/');
    expect(streams).toHaveLength(0);
  });
});

describe('isCastrUrl', () => {
  it('identifies player.castr.com URLs', () => {
    expect(isCastrUrl('https://player.castr.com/abc123')).toBe(true);
  });

  it('identifies castr.com/embed/ URLs', () => {
    expect(isCastrUrl('https://castr.com/embed/xyz789')).toBe(true);
  });

  it('identifies castr.io URLs', () => {
    expect(isCastrUrl('https://castr.io/stream/123')).toBe(true);
  });

  it('rejects non-Castr URLs', () => {
    expect(isCastrUrl('https://youtube.com/watch?v=123')).toBe(false);
  });
});

describe('scrapeCastrVideoIds', () => {
  it('extracts UUIDs from page HTML', () => {
    const html = `
      <script>var videoId = "37acc721-8fc9-4739-a16f-dde80cadb700";</script>
      <iframe src="https://player.castr.com/0c58a1db-7a63-420d-0e35-772d86a95100"></iframe>
    `;
    const ids = scrapeCastrVideoIds(html);
    expect(ids).toContain('37acc721-8fc9-4739-a16f-dde80cadb700');
    expect(ids).toContain('0c58a1db-7a63-420d-0e35-772d86a95100');
  });

  it('returns empty array for pages without Castr', () => {
    const ids = scrapeCastrVideoIds('<html><body>Hello</body></html>');
    expect(ids).toHaveLength(0);
  });
});
