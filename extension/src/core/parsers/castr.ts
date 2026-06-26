/**
 * Castr.io Stream Detector & Extractor
 *
 * Detects Castr video embeds and extracts HLS stream URLs.
 *
 * Supported patterns:
 * - player.castr.com/<videoId>
 * - Video IDs in page source: [a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}
 * - Castr iframe embeds
 */

import type { StreamInfo } from '../../types';

// ─── Detection ──────────────────────────────────────────────────────────────

const CASTR_VIDEO_ID_REGEX = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
const CASTR_PLAYER_REGEX = /player\.castr\.com\/([a-zA-Z0-9_-]+)/gi;
const CASTR_EMBED_REGEX = /castr\.com\/embed\/([a-zA-Z0-9_-]+)/gi;

export function detectCastrStreams(html: string, pageUrl: string): StreamInfo[] {
  const streams: StreamInfo[] = [];
  const seenIds = new Set<string>();

  // Method 1: Find video IDs in page source
  const videoIdMatches = html.match(CASTR_VIDEO_ID_REGEX) || [];
  for (const videoId of videoIdMatches) {
    if (seenIds.has(videoId)) continue;
    seenIds.add(videoId);

    streams.push({
      url: `https://player.castr.com/${videoId}`,
      type: 'hls',
      quality: 'auto',
      pageUrl,
      detectedAt: Date.now(),
      metadata: {
        videoId,
        platform: 'castr',
        playerUrl: `https://player.castr.com/${videoId}`,
      },
    });
  }

  // Method 2: Find player.castr.com URLs
  const playerMatches = html.matchAll(CASTR_PLAYER_REGEX);
  for (const match of playerMatches) {
    const videoId = match[1];
    if (seenIds.has(videoId)) continue;
    seenIds.add(videoId);

    streams.push({
      url: `https://player.castr.com/${videoId}`,
      type: 'hls',
      quality: 'auto',
      pageUrl,
      detectedAt: Date.now(),
      metadata: {
        videoId,
        platform: 'castr',
        playerUrl: `https://player.castr.com/${videoId}`,
      },
    });
  }

  // Method 3: Find castr.com/embed/ URLs
  const embedMatches = html.matchAll(CASTR_EMBED_REGEX);
  for (const match of embedMatches) {
    const videoId = match[1];
    if (seenIds.has(videoId)) continue;
    seenIds.add(videoId);

    streams.push({
      url: `https://player.castr.com/${videoId}`,
      type: 'hls',
      quality: 'auto',
      pageUrl,
      detectedAt: Date.now(),
      metadata: {
        videoId,
        platform: 'castr',
        playerUrl: `https://player.castr.com/${videoId}`,
      },
    });
  }

  return streams;
}

// ─── HLS Extraction ─────────────────────────────────────────────────────────

/**
 * Fetch the Castr player page and extract the HLS manifest URL.
 *
 * The Castr player loads an HLS manifest from their CDN.
 * The URL is typically found in the player's JavaScript config.
 *
 * @param videoId - The Castr video ID
 * @returns The HLS manifest URL or null
 */
export async function extractCastrHLS(videoId: string): Promise<string | null> {
  const playerUrl = `https://player.castr.com/${videoId}`;

  try {
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    const html = await response.text();

    // Method 1: Look for .m3u8 URL in page source
    const m3u8Match = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
    if (m3u8Match) {
      return m3u8Match[0];
    }

    // Method 2: Look for HLS config in JavaScript
    const hlsConfigMatch = html.match(/hls[^}]*url[^}]*"([^"]+\.m3u8[^"]*)"/i);
    if (hlsConfigMatch) {
      return hlsConfigMatch[1];
    }

    // Method 3: Look for source elements with HLS
    const sourceMatch = html.match(/<source[^>]+src="([^"]+\.m3u8[^"]*)"[^>]*>/i);
    if (sourceMatch) {
      return sourceMatch[1];
    }

    // Method 4: Look for Castr CDN pattern
    const cdnMatch = html.match(/https?:\/\/[a-z0-9]+\.castr\.com\/[^"'\s]+\.m3u8[^"'\s]*/i);
    if (cdnMatch) {
      return cdnMatch[0];
    }

    return null;
  } catch (error) {
    console.error(`[Kapowie] Castr HLS extraction failed for ${videoId}:`, error);
    return null;
  }
}

// ─── Player Config ───────────────────────────────────────────────────────────

/**
 * Get Castr player configuration including autoplay, muted, etc.
 */
export function getCastrPlayerConfig(videoId: string, options: {
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
} = {}): string {
  const params = new URLSearchParams();

  if (options.autoplay !== undefined) {
    params.set('autoplay', options.autoplay ? 'on' : 'off');
  }
  if (options.muted !== undefined) {
    params.set('muted', options.muted ? 'on' : 'off');
  }
  if (options.controls !== undefined) {
    params.set('controls', options.controls ? 'on' : 'off');
  }
  if (options.loop !== undefined) {
    params.set('loop', options.loop ? 'on' : 'off');
  }

  const queryString = params.toString();
  return `https://player.castr.com/${videoId}${queryString ? '?' + queryString : ''}`;
}

// ─── Page Scraper ────────────────────────────────────────────────────────────

/**
 * Scrape a Castr-powered page for all video IDs.
 * Works with ppv.livecombatsports.com.au and other Castr customers.
 */
export function scrapeCastrVideoIds(html: string): string[] {
  const ids = new Set<string>();
  const matches = html.match(CASTR_VIDEO_ID_REGEX) || [];
  for (const id of matches) {
    ids.add(id);
  }
  return Array.from(ids);
}

// ─── Direct HLS URL Builder ─────────────────────────────────────────────────

/**
 * Attempt to construct the direct HLS URL from a Castr video ID.
 *
 * Castr CDN URLs follow patterns like:
 * - https://<edge>.castr.com/<stream>/index.m3u8
 * - https://<channel>.castr.com/live/<id>/index.m3u8
 *
 * This is a best-effort guess. The actual URL requires API access or page scraping.
 */
export function guessCastrHLSUrl(videoId: string): string {
  // Castr uses a CDN edge server pattern
  // The actual URL requires fetching the player page
  return `https://player.castr.com/${videoId}`;
}

// ─── Detection Helper ───────────────────────────────────────────────────────

/**
 * Check if a URL is a Castr player or Castr-powered page.
 */
export function isCastrUrl(url: string): boolean {
  return (
    url.includes('player.castr.com') ||
    url.includes('castr.com/embed/') ||
    url.includes('castr.io') ||
    url.includes('castr.com')
  );
}

/**
 * Check if page HTML contains Castr embeds.
 */
export function pageContainsCastr(html: string): boolean {
  return CASTR_VIDEO_ID_REGEX.test(html) || CASTR_PLAYER_REGEX.test(html);
}
