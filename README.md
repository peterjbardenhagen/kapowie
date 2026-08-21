# 🎬 Restreamer.ai

[![Deploy to Vercel](https://github.com/peterjbardenhagen/kapowie/actions/workflows/deploy-vercel.yml/badge.svg)](https://github.com/peterjbardenhagen/kapowie/actions/workflows/deploy-vercel.yml)

**AI-powered live stream recorder & re-streamer**

Record live streams from any website. Re-stream to your TV, phone, or any device in near real-time.

## Why Restreamer.ai?

You watch free live streams (news, sports, IPTV, events) on websites. You want to:

- 📺 **Record** for personal later viewing (catch-up / time-shift)
- 📡 **Re-stream** to another device (Smart TV, phone, computer) in near real-time
- ✂️ **Clip** specific segments without recording the entire stream

Restreamer.ai does all three — for free, with full control over your data.

## Products

| Product | Location | Description |
|---------|----------|-------------|
| **Chrome Extension** | [`extension/`](./extension/) | MV3 extension. Auto-detects HLS/DASH streams, records, re-streams via local HLS server |
| **Windows Desktop App** | [`desktop/`](./desktop/) | Tauri native app. No browser memory limits, RTSP re-streaming, scheduling |
| **Jellyfin Plugin** | [`jellyfin-plugin/`](./jellyfin-plugin/) | Records shows and live TV on demand or on a schedule (start time + duration) straight into your Jellyfin library |
| **Website** | [`Website/`](./Website/) | Marketing site for Restreamer.ai, deployed to [restreamer.ai](https://restreamer.ai) |
| **Shared Types** | [`shared/`](./shared/) | Common TypeScript types and interfaces used across all platforms |
| **Our Network** | FreeLiveSports.ai, FightStream.ai, ProStream.ai | Partner streaming platforms for live sports, fights, and professional broadcasts |

## Features

| Feature | Extension | Desktop |
|---------|-----------|---------|
| Auto-detect HLS/DASH streams on any page | ✅ | ✅ |
| One-click recording with REC button | ✅ | ✅ |
| Manual URL input (.m3u8, .mpd, .mp4) | ✅ | ✅ |
| Quality selection (1080p/720p/480p) | ✅ | ✅ |
| Pause/resume recording | ✅ | ✅ |
| Concurrent downloads (up to 10) | ✅ | ✅ |
| AES-128 decryption | ✅ | ✅ |
| CORS bypass via header injection | ✅ | ✅ |
| Re-stream via local HLS (port 8080) | ✅ | ✅ |
| Re-stream via RTSP (port 554) | ❌ | ✅ |
| Schedule recordings | ❌ | ✅ |
| Stream monitor (auto-detect when live) | ❌ | ✅ |
| Cloud upload (Google Drive, S3) | ❌ | Planned |
| DRM-protected content | ❌ | ❌ |

## Getting Started

### Chrome Extension

```bash
cd extension
npm install
npm run build
# Output: .output/chrome-mv3/
# Load in Chrome: chrome://extensions → Developer mode → Load unpacked → select .output/chrome-mv3/
```

### Desktop App

```bash
cd desktop
npm install
npm run tauri dev
# Or build for production:
npm run tauri build
# Output: src-tauri/target/release/bundle/msi/
```

## Project Structure

```
Restreamer.ai/
├── extension/              # Chrome MV3 Extension (WXT + Svelte + TypeScript)
│   ├── src/
│   │   ├── entrypoints/    # background, content, popup, offscreen
│   │   ├── core/           # parsers, downloader, recorder, restream
│   │   ├── components/     # Svelte UI components
│   │   ├── utils/          # crypto, fetch, storage
│   │   └── types/          # TypeScript interfaces
│   ├── package.json
│   ├── wxt.config.ts
│   └── README.md
├── desktop/                # Windows Desktop App (Tauri + Rust + Svelte)
│   ├── src/                # Svelte frontend
│   ├── src-tauri/          # Rust backend
│   │   └── src/commands/   # Tauri IPC commands
│   ├── package.json
│   ├── tauri.conf.json
│   └── README.md
├── jellyfin-plugin/         # Jellyfin server plugin (C# / .NET 9)
│   └── Jellyfin.Plugin.Kapowie/
│       ├── Services/        # ffmpeg-backed recording engine
│       ├── ScheduledTasks/  # Scheduled-recording trigger
│       ├── Api/             # REST API for recording jobs
│       └── Configuration/   # Admin dashboard config page
├── Website/                # Marketing site (static HTML/CSS/JS), deployed to Vercel
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   └── assets/
├── shared/                 # Shared types and utilities
│   └── types/
│       └── index.ts
├── scripts/
│   ├── build-extension.sh  # Build & package Chrome extension
│   └── publish-extension.sh # Publish to Chrome Web Store
├── docs/
│   ├── brand-guidelines.md # Logo, palette, and visual direction
│   ├── deployment-guide.md  # Release and deployment notes
│   ├── deployment-guide-research.md # Background research for deployment
│   ├── security/
│   │   └── Security Audit 2026-06-26.md # Security review notes
│   └── letsencrypt-setup.md # TLS setup notes
├── AGENTS.md               # AI agent contribution guidelines
├── README.md               # This file
└── LICENSE                 # MIT License
```

## Technical Architecture

### How It Works

```
User watches live stream on website
       ↓
Content script detects <video> or network request (.m3u8/.mpd)
       ↓
Service worker:
  ├── Parses HLS/DASH manifest
  ├── Downloads segments (concurrent, configurable)
  ├── Decrypts AES-128 segments (if needed)
  ├── Stores in IndexedDB
       ↓
On stop:
  ├── Offscreen document: FFmpeg.wasm muxes segments → MP4
  ├── chrome.downloads.download() → saves to disk
       ↓
For re-streaming:
  ├── Local HTTP server serves segments as they download
  ├── Desktop app can additionally spawn RTSP server (port 554)
  └── Accessible from any device on local network
```

### Key Technologies

| Component | Technology | Why |
|-----------|-----------|-----|
| **Extension framework** | WXT | Modern MV3 DX, auto-imports, HMR |
| **UI** | Svelte | Reactive, lightweight, fast |
| **Muxing** | FFmpeg.wasm | In-browser HLS/DASH → MP4 |
| **Transmuxing** | mux.js | HLS segments → MP4 (lower level) |
| **Storage** | IndexedDB (idb) | Large capacity, async, survives restarts |
| **Desktop shell** | Tauri 2 + Rust | Native performance, small binary (~5MB) |
| **RTSP server** | mediamtx (bundled) | Low-latency RTSP proxy |
| **Stream detection** | webRequest + DOM observation | Catches all stream types |

## Development

See [AGENTS.md](./AGENTS.md) for AI agent contribution guidelines.

### Prerequisites
- Node.js ≥ 20
- Rust ≥ 1.70 (for desktop app)
- Chrome/Edge/Brave

### Quick Start

```bash
# Clone
git clone git@github.com:peterjbardenhagen/Restreamer.ai.git
cd Restreamer.ai

# Extension
cd extension && npm install && npm run build

# Desktop (requires Rust)
cd ../desktop && npm install && npm run tauri dev
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

See [AGENTS.md](./AGENTS.md) for AI agent collaboration guidelines.

## License

MIT License — see [LICENSE](./LICENSE) for details.

## Acknowledgements

- [Video-Downloader-Unshackle](https://github.com/gecallidryas/Video-Downloader-Unshackle) — best MV3 extension architecture reference
- [Streamlink](https://github.com/streamlink/streamlink) — stream extraction pioneer
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — powerful downloader
- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) — in-browser video processing
- [WXT](https://wxt.dev) — modern MV3 extension framework
