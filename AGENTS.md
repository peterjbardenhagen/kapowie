# AGENTS.md — AI Agent Contribution Guidelines

## Welcome

This is the **kapowie** project — an AI-powered live stream recorder & re-streamer. This document provides guidelines for AI coding agents (Claude Code, Codex, Copilot, OpenClaw, etc.) contributing to this repository.

## Project Context

**What is Kapowie?** A free tool that lets users record live streams from any website and re-stream them to another device (TV, phone, computer) in near real-time.

**Target users:** Sports fans, news viewers, cord-cutters, content curators — anyone who wants to capture or redirect free live video.

**Key differentiator:** Existing tools (Video DownloadHelper, media-bridge) only download. Kapowie adds re-streaming — turn any website stream into a local HLS/RTSP feed for any device on your network.

## Repository Structure

```
kapowie/
├── extension/          # Chrome MV3 Extension — PRIMARY PRODUCT
├── desktop/            # Windows Desktop App (Tauri) — SECONDARY
├── shared/             # Cross-platform shared types/utils
├── scripts/            # Build & publish scripts
├── docs/               # Deployment, security, and setup notes
├── AGENTS.md           # This file
├── README.md
└── LICENSE             # MIT
```

## Development Environments

### Primary: Chrome Extension (`extension/`)

**Stack:** WXT + TypeScript + Svelte + FFmpeg.wasm

```bash
cd extension
npm install
npm run dev          # Dev mode with HMR
npm run build        # Production build → .output/chrome-mv3/
npm run test         # Unit tests (vitest)
npm run lint         # ESLint
```

**Key entry points:**
- `src/entrypoints/background.ts` — Service worker, stream management
- `src/entrypoints/content.ts` — Content script, video detection
- `src/entrypoints/popup/` — Extension popup UI (Svelte)
- `src/entrypoints/offscreen/` — FFmpeg.wasm processing

**Build output:** `.output/chrome-mv3/` — load unpacked in Chrome for testing.

### Secondary: Desktop App (`desktop/`)

**Stack:** Tauri 2 + Rust + Svelte + Vite

```bash
cd desktop
npm install
npm run dev          # Frontend dev (Vite HMR)
npm run tauri dev    # Full desktop app dev
npm run tauri build  # Production MSI installer
```

**Frontend:** `src/` (Svelte)
**Backend:** `src-tauri/` (Rust)
**Tauri config:** `src-tauri/tauri.conf.json`

## Code Standards

### TypeScript

- Strict mode enabled (`tsconfig.json`)
- No `any` unless absolutely necessary — use `unknown` for external data
- Explicit return types on exported functions
- Use discriminated unions for state: `{ status: 'recording' } | { status: 'completed' }`

### Svelte

- Use the existing Svelte 4 component patterns in this repo
- Components are single-responsibility
- Props via `$props()` rune
- No global CSS — use CSS modules or scoped styles

### Rust (Desktop)

- Follow Rust API guidelines
- Use `thiserror` for custom errors
- Use `tracing` for logging
- All Tauri commands return `Result<T, String>` for error handling
- Use `serde` for serialization

### General

- All files need license header (MIT)
- Commit messages: conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`)
- Tests for core logic (parsers, downloader, crypto)
- Documentation for public APIs

## Architecture Decisions

### Why WXT for the extension?
- Auto-generates manifest.json from config
- Auto-imports reduce boilerplate
- Built-in HMR for development
- First-class MV3 support
- Used by Video-Downloader-Unshackle (proven for stream recording)

### Why Tauri for the desktop app?
- Smaller binary than Electron (~5MB vs ~150MB)
- Native performance
- Rust backend for segment processing
- No browser memory limits
- Can bundle ffmpeg and mediamtx

### Why FFmpeg.wasm for muxing?
- Runs entirely in browser (no native code needed)
- Can mux HLS/DASH segments into MP4
- Handles AES-128 decryption
- Limitation: ~2GB max output (browser memory)

### Why local HLS for re-streaming?
- Universal client support (VLC, Smart TVs, phones, browsers)
- No special encoding needed — just serve segments
- Sub-second latency achievable
- Desktop app adds RTSP for IP camera compatibility

## Testing Strategy

### Unit Tests
- HLS/DASH parsers: test with real manifests from major platforms
- Crypto (AES-128): test with known encrypted segments
- Download manager: test concurrent download limits
- Storage: test IndexedDB CRUD operations

### Integration Tests
- Extension: test stream detection on 5+ major sites
- Desktop: test full capture → mux → save pipeline
- Re-stream: test HLS server serves valid playlist

### Manual Testing Checklist
- [ ] Detect HLS stream on a news website
- [ ] Record 30-second clip, verify MP4 plays
- [ ] Pause/resume recording
- [ ] Re-stream to VLC on same network
- [ ] Re-stream to VLC on different device (phone)
- [ ] Quality selection works
- [ ] AES-128 encrypted stream decrypts correctly

## Security Considerations

- **No data leaves the browser** — all processing is local
- **No analytics or telemetry** — Kapowie doesn't phone home
- **No DRM circumvention** — don't attempt to break Widevine/FairPlay
- **Permissions are minimal** — only request what's needed
- **Native messaging** (if used) should validate all inputs
- **Segment URLs** may contain tokens — don't log or transmit them

## Performance Targets

| Metric | Target |
|--------|--------|
| Stream detection | < 1 second from page load |
| Recording start | < 500ms from REC click |
| Memory usage (extension) | < 500MB for 1-hour recording |
| Re-stream latency | < 2 seconds |
| Desktop app startup | < 3 seconds |
| Desktop app binary size | < 15MB |

## Release Process

### Chrome Extension
1. Bump version in `extension/package.json`
2. Run `npm run build`
3. Run `scripts/package-extension.sh` → creates `.zip`
4. Upload to Chrome Developer Dashboard
5. Submit for review

### Desktop App
1. Bump version in `desktop/src-tauri/tauri.conf.json` and `Cargo.toml`
2. Run `npm run tauri build` → creates `.msi` installer
3. Test installer on clean Windows machine
4. Create GitHub Release with MSI attached

## AI Agent Collaboration

When working on this codebase:

1. **Read the relevant `README.md`** in each sub-project first
2. **Check the most relevant docs under `docs/`** for deployment, security, or setup context
3. **Follow existing patterns** — match the code style you find
4. **Write tests** for any new functionality
5. **Update docs** when adding features
6. **Run the build** before claiming work is done
7. **Test manually** when possible — automated tests don't catch everything

## Questions?

- Check `docs/` for detailed specifications
- Check `docs/` for deployment, security, and setup notes
- Open an issue for feature requests
