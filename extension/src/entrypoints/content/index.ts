/// <reference types="chrome" />

import { defineContentScript } from 'wxt/sandbox';
import type { StreamInfo } from '../../types';

// ─── Video Element Detection ──────────────────────────────────────────────────

function isStreamUrl(url: string): boolean {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return false;
  return (
    /\.m3u8(\?.*)?$/.test(url) ||
    /\.mpd(\?.*)?$/.test(url) ||
    /\/hls\//.test(url) ||
    /\/dash\//.test(url) ||
    url.includes('m3u8') ||
    url.includes('.mpd')
  );
}

function processVideoElement(video: HTMLVideoElement): StreamInfo | null {
  const src = video.src || video.currentSrc;
  if (src && isStreamUrl(src)) {
    return {
      url: src,
      type: /\.m3u8/.test(src) || src.includes('m3u8') ? 'hls' : 'dash',
      quality: `${video.videoWidth}x${video.videoHeight}`,
      pageUrl: window.location.href,
      pageTitle: document.title,
      detectedAt: Date.now(),
    };
  }
  return null;
}

function detectVideoStreams(): StreamInfo[] {
  const streams: StreamInfo[] = [];
  const videos = document.querySelectorAll('video');
  for (const video of videos) {
    const info = processVideoElement(video);
    if (info) streams.push(info);
  }
  return streams;
}

// ─── Castr Detection ─────────────────────────────────────────────────────────

const CASTR_VIDEO_ID_REGEX = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;

function detectCastrStreams(html: string): StreamInfo[] {
  const streams: StreamInfo[] = [];
  const seenIds = new Set<string>();
  const matches = html.match(CASTR_VIDEO_ID_REGEX) || [];
  for (const videoId of matches) {
    if (seenIds.has(videoId)) continue;
    seenIds.add(videoId);
    streams.push({
      url: `https://player.castr.com/${videoId}`,
      type: 'hls',
      quality: 'auto',
      pageUrl: window.location.href,
      detectedAt: Date.now(),
      metadata: { videoId, platform: 'castr' },
    });
  }
  return streams;
}

// ─── Network Interception ────────────────────────────────────────────────────

function interceptNetworkRequests(onStreamUrl: (url: string) => void): PerformanceObserver {
  const seen = new Set<string>();
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const url = entry.name;
      if ((isStreamUrl(url) || url.includes('castr.com')) && !seen.has(url)) {
        seen.add(url);
        onStreamUrl(url);
      }
    }
  });
  observer.observe({ entryTypes: ['resource'] });
  return observer;
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

export function main() {
  console.log('[Kapowie] Content script loaded');

  // Scan for video elements
  const videoStreams = detectVideoStreams();
  if (videoStreams.length > 0) {
    chrome.runtime.sendMessage({
      type: 'STREAM_DETECTED',
      payload: { streams: videoStreams },
    }).catch(() => {});
  }

  // Scan for Castr embeds in page source
  const html = document.documentElement.innerHTML;
  const castrStreams = detectCastrStreams(html);
  if (castrStreams.length > 0) {
    chrome.runtime.sendMessage({
      type: 'STREAM_DETECTED',
      payload: { streams: castrStreams },
    }).catch(() => {});
  }

  // Set up network interception
  const networkObserver = interceptNetworkRequests((url) => {
    chrome.runtime.sendMessage({
      type: 'STREAM_DETECTED',
      payload: {
        streams: [{
          url,
          type: /\.m3u8/.test(url) || url.includes('m3u8') ? 'hls' : 'dash',
          quality: 'auto',
          pageUrl: window.location.href,
          pageTitle: document.title,
          detectedAt: Date.now(),
        } satisfies StreamInfo],
      },
    }).catch(() => {});
  });

  // Observe DOM for dynamically added videos
  const domObserver = new MutationObserver(() => {
    const newStreams = detectVideoStreams();
    if (newStreams.length > 0) {
      chrome.runtime.sendMessage({
        type: 'STREAM_DETECTED',
        payload: { streams: newStreams },
      }).catch(() => {});
    }
  });

  domObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener('pagehide', () => {
    networkObserver.disconnect();
    domObserver.disconnect();
  }, { once: true });
}

// WXT content script default export
export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  main,
});
