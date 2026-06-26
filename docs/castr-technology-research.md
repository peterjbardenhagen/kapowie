# Castr.io Technology Research

## What is Castr?

Castr is a **live streaming and video hosting platform** (SaaS) that provides:
- Live stream ingestion (RTMP/SRT)
- HLS/DASH transcoding and delivery
- Embeddable video player
- Pay-per-view (PPV) monetization
- Multistreaming to social platforms
- White-label OTT solutions

## Embed Technology

### Player URL Format
```
https://player.castr.com/<videoId>
```

### Example (from Live Combat Sports)
```
https://player.castr.com/37acc721-8fc9-4739-a16f-dde80cadb700
https://player.castr.com/0c58a1db-7a63-420d-0e35-772d86a95100
https://player.castr.com/53095c82-04db-46d1-5759-4062f26c6300
```

### Video IDs Found on ppv.livecombatsports.com.au
- `37acc721-8fc9-4739-a16f-dde80cadb700`
- `0c58a1db-7a63-420d-0e35-772d86a95100`
- `53095c82-04db-46d1-5759-4062f26c6300`
- `d0e65f40-075a-4c4f-a1a4-bd85d643a600`

## Player Parameters (URL Query String)

| Parameter | Values | Description |
|-----------|--------|-------------|
| `autoplay` | on / off | Auto-start playback |
| `muted` | on / off | Start muted |
| `controls` | on / off | Show player controls |
| `hideControlbarPlayButton` | true | Hide play/pause |
| `loop` | on / off | Loop playback |

Example:
```
https://player.castr.com/37acc721-8fc9-4739-a16f-dde80cadb700?autoplay=on&muted=on
```

## Streaming Protocols

| Protocol | Use Case | URL Pattern |
|----------|----------|-------------|
| **HLS** | Live & VOD (primary) | `https://<cdn>.castr.com/<stream>/index.m3u8` |
| **DASH** | Live & VOD (alternative) | `https://<cdn>.castr.com/<stream>/index.mpd` |
| **RTMP** | Ingest (encoder → Casts) | `rtmp://ingest.castr.com/live/<key>` |
| **SRT** | Low-latency ingest | `srt://ingest.castr.com:9000?<key>` |

## Infrastructure

| Component | Technology |
|-----------|-----------|
| **CDN** | Cloudflare (confirmed via cf-ray headers) |
| **Origin** | Deno Deploy (x-do-app-origin header) |
| **Streaming** | Castr's own CDN with edge transcoding |
| **Player** | Custom HTML5 player with HLS.js |
| **API** | RESTful JSON API at `api.castr.com` |
| **Auth** | API token from dashboard settings |

## API Endpoints

Base URL: `https://api.castr.com/v1/`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/streams` | GET | List all streams |
| `/streams/{id}` | GET | Get stream details |
| `/streams/{id}/pull` | GET | Get HLS/DASH pull URL |
| `/videos` | GET | List all videos |
| `/videos/{id}` | GET | Get video details |
| `/player/{id}` | GET | Get embed player config |

## Pull URL (Direct HLS)

Castr provides direct HLS URLs via the API:
```
GET /streams/{id}/pull
Response: { "url": "https://<edge>.castr.com/<stream>/index.m3u8" }
```

## ppv.livecombatsports.com.au Architecture

```
User → Cloudflare CDN → Next.js (Deno Deploy) → Castr Player (iframe/JS embed)
                                    ↓
                            Castr API (video metadata)
                                    ↓
                            Castr CDN (HLS streams)
```

### Page Structure
1. **Homepage** — Lists video categories (PPV, Boxing, Muay Thai, MMA, etc.)
2. **Category pages** — Filtered video grid with pagination (31 pages)
3. **Video detail page** — Loads Castr player embed when user clicks to watch
4. **Player** — Castr embed player with autoplay, PPV paywall integration

### How to Extract Streams

1. **Scrape video IDs** from page source (regex: `[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}`)
2. **Construct player URL:** `https://player.castr.com/<videoId>`
3. **Get HLS URL from player page:** Scrape the `.m3u8` URL from the player HTML
4. **Or use API:** `GET https://api.castr.com/v1/streams/<id>/pull` with auth token

## Security Considerations

| Risk | Status | Notes |
|------|--------|-------|
| **DRM** | AES-128 typical | Castr supports AES-128 encryption |
| **Token auth** | Required for API | API token from dashboard |
| **Referrer restriction** | Likely | Player may check referrer |
| **Signed URLs** | Possible | May need signed URLs for HLS |
| **CORS** | Check required | Cross-origin requests may be blocked |

## Kapowie Integration Plan

### Phase 1: Detection
- Regex: `[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}` for Castr video IDs
- Also detect `player.castr.com` iframes

### Phase 2: Extraction
- Fetch player page HTML
- Extract `.m3u8` URL from `<source>` tags or JS config
- Fallback: Use Castr API if token available

### Phase 3: Recording
- Download HLS segments via the `.m3u8` URL
- Mux to MP4 via FFmpeg.wasm

### Phase 4: Re-stream
- Serve local HLS feed on localhost:8080
- Accessible from any device on network
