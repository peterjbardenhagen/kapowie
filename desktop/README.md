# Restreamer.ai Desktop

A native desktop application for recording and re-streaming live streams. Built with Tauri (Rust backend + Svelte frontend).

## Features

- **Stream Recording** - Record live streams (HLS, RTMP, RTSP, DASH) to disk
- **Re-streaming** - Re-stream content via HLS, RTSP, or MPEG-TS protocols
- **Multi-format Support** - Handles HLS (.m3u8), DASH (.mpd), RTMP, RTSP, and progressive streams
- **Concurrent Downloads** - Download multiple streams simultaneously
- **Native Performance** - No browser memory limits, full system access

## Tech Stack

- **Frontend**: Svelte 4 + TypeScript + Vite 5
- **Backend**: Rust + Tauri 2
- **HTTP Client**: Reqwest (Rust)
- **Async Runtime**: Tokio

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### Installation

```bash
cd desktop
npm install
```

### Development

```bash
npm run tauri dev
```

This starts the Vite dev server and launches the Tauri window.

### Building

```bash
npm run tauri build
```

This produces an MSI installer in `src-tauri/target/release/bundle/msi/`.

## Project Structure

```
desktop/
├── src/                    # Svelte frontend
│   ├── App.svelte          # Main app layout
│   ├── main.ts             # Entry point
│   ├── components/         # UI components
│   ├── stores/             # Svelte state management
│   └── styles/             # CSS styles
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Tauri entry point
│   │   ├── commands/       # Tauri IPC commands
│   │   ├── core/           # Core logic (stream detection, download, re-stream)
│   │   └── config.rs       # App configuration
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## License

MIT
