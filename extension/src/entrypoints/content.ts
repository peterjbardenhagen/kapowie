/// <reference types="chrome" />

import type { StreamInfo } from '../types';

// ─── Guard: skip entire module in non-browser context (WXT prepare, vitest) ──
const isBrowser = typeof document !== 'undefined' && typeof MutationObserver !== 'undefined';

if (isBrowser) {
  initContentScript();
}

function initContentScript() {
  // ─── Video Element Detection ────────────────────────────────────────────────

  const detectedStreams = new Map<string, StreamInfo>();
  const observedVideos = new WeakSet<HTMLVideoElement>();

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

  function processVideoElement(video: HTMLVideoElement) {
    if (observedVideos.has(video)) return;
    observedVideos.add(video);

    const src = video.src || video.currentSrc;
    if (src && isStreamUrl(src)) {
      reportStream(src, video);
    }

    video.addEventListener('loadedmetadata', () => {
      const currentSrc = video.src || video.currentSrc || '';
      if (isStreamUrl(currentSrc)) {
        reportStream(currentSrc, video);
      }
    });

    video.querySelectorAll('source').forEach((source) => {
      const src = source.src;
      if (isStreamUrl(src)) {
        reportStream(src, video);
      }
    });
  }

  function observeVideoElements() {
    document.querySelectorAll('video').forEach(processVideoElement);

    const observer = new MutationObserver((mutations) => {
        for (let m = 0; m < mutations.length; m++) {
          const nodes = mutations[m].addedNodes;
          for (let n = 0; n < nodes.length; n++) {
            const node = nodes[n];
            if (node instanceof HTMLVideoElement) {
              processVideoElement(node);
            } else if (node instanceof HTMLElement) {
              const videos = node.querySelectorAll('video');
              for (let v = 0; v < videos.length; v++) {
                processVideoElement(videos[v]);
              }
            }
          }
        }
      });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // ─── Visual Indicator (REC badge) ───────────────────────────────────────────

  function addVideoIndicator(video: HTMLVideoElement, stream: StreamInfo) {
    const container = video.parentElement;
    if (!container) return;

    const style = getComputedStyle(container);
    if (style.position === 'static') {
      (container as HTMLElement).style.position = 'relative';
    }

    const badge = document.createElement('div');
    badge.id = 'kapowie-indicator';
    badge.dataset.kapowie = 'true';
    badge.style.cssText = 'position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.75);color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;font-family:system-ui,sans-serif;z-index:2147483647;pointer-events:auto;display:flex;align-items:center;gap:6px;';

    const dot = document.createElement('span');
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#ff4444;animation:kapowie-pulse 2s infinite;';

    const text = document.createElement('span');
    text.textContent = `KAPOWIE ${stream.type.toUpperCase()}`;

    const btn = document.createElement('button');
    btn.textContent = 'REC';
    btn.style.cssText = 'background:#ff4444;color:white;border:none;border-radius:3px;padding:2px 6px;font-size:11px;font-weight:bold;cursor:pointer;font-family:system-ui,sans-serif;';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({
        type: 'START_RECORDING',
        payload: { stream, quality: 'best' },
      });
      btn.textContent = '\u25CF REC';
      btn.style.background = '#cc0000';
    });

    badge.appendChild(dot);
    badge.appendChild(text);
    badge.appendChild(btn);
    container.appendChild(badge);

    if (!document.getElementById('kapowie-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'kapowie-styles';
      styleEl.textContent = '@keyframes kapowie-pulse{0%,100%{opacity:1}50%{opacity:0.5}}';
      document.head.appendChild(styleEl);
    }
  }

  // ─── Report Stream to Background ────────────────────────────────────────────

  function reportStream(url: string, video?: HTMLVideoElement) {
    const type = /\.m3u8/.test(url) || url.includes('m3u8') ? 'hls' :
                 /\.mpd/.test(url) || url.includes('.mpd') ? 'dash' : 'direct';

    const stream: StreamInfo = {
      url,
      type: type as StreamInfo['type'],
      quality: 'auto',
      pageUrl: window.location.href,
      pageTitle: document.title,
      detectedAt: Date.now(),
    };

    if (detectedStreams.has(url)) return;
    detectedStreams.set(url, stream);

    chrome.runtime.sendMessage({
      type: 'STREAM_DETECTED',
      payload: { streams: [stream] },
    }).catch(() => {});

    if (video) {
      addVideoIndicator(video, stream);
    }
  }

  // ─── Message Listener ───────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_VIDEO_STREAMS') {
      const videos = document.querySelectorAll('video');
      const streams: StreamInfo[] = [];
      videos.forEach((v) => {
        const src = v.src || v.currentSrc;
        if (src) {
          streams.push({
            url: src,
            type: /\.m3u8/.test(src) || src.includes('m3u8') ? 'hls' : /\.mpd/.test(src) || src.includes('.mpd') ? 'dash' : 'direct',
            quality: `${v.videoWidth}x${v.videoHeight}`,
            pageUrl: window.location.href,
            pageTitle: document.title,
          });
        }
      });
      sendResponse({ streams });
    }
    return true;
  });

  // ─── SPA Navigation Observer ────────────────────────────────────────────────

  let lastUrl = typeof location !== 'undefined' ? location.href : '';
  new MutationObserver(() => {
    const url = typeof location !== 'undefined' ? location.href : '';
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(() => {
        document.querySelectorAll('video').forEach(processVideoElement);
      }, 1000);
    }
  }).observe(document, { subtree: true, childList: true });

  // ─── Initialize ────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeVideoElements);
  } else {
    observeVideoElements();
  }
}

// Content script: WXT auto-loads this based on manifest content_scripts config.
// No default export needed — the init code at the bottom runs on import.
