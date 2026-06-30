# Kapowie Recorder — Jellyfin Plugin

A Jellyfin server plugin that records shows and live TV either **on demand**
("record now for N minutes") or **on a schedule** (a future start time plus a
duration in minutes/hours). It captures the source stream directly with
`ffmpeg`, the same approach Kapowie's extension and desktop app use, so it
works with any stream URL Jellyfin's server can reach — it does not require
the recording to come from a tuner or Live TV provider already configured in
Jellyfin.

## Why a standalone plugin instead of `ILiveTvService`?

Jellyfin's built-in Live TV/DVR subsystem (`ILiveTvService`) expects a tuner
or guide-data provider to supply channels and program metadata. Kapowie's
recordings are arbitrary stream URLs (HLS, RTMP, RTSP, MPEG-TS, etc.) without
an EPG behind them, so a standalone recording service with its own admin UI
and REST API is a better fit — it mirrors how Kapowie already captures
streams elsewhere in this repo.

## How it works

- **Create a recording** — either immediately ("on demand") or at a future
  UTC start time ("scheduled"), with an optional duration in minutes.
- A **scheduled task** (`Kapowie Recording Scheduler`, runs every 30s by
  default) starts any scheduled job whose start time has arrived.
- Each job spawns `ffmpeg -i <url> [-t <duration>] -c copy <output>`. Jobs
  with a duration stop themselves; on-demand jobs without a duration record
  until you stop them from the dashboard, which asks ffmpeg to finalize the
  file gracefully (`q`) before falling back to a hard kill.
- Job state is persisted as JSON in the plugin's data folder, so recordings
  in progress are not lost if you reload the configuration page.
- Output files are written to the configured **Output Directory** (defaults
  to a `recordings` folder inside the plugin's data directory). Point this
  at a Jellyfin library folder and run a library scan to make finished
  recordings show up as media.

## Project layout

```
jellyfin-plugin/
└── Jellyfin.Plugin.Kapowie/
    ├── Plugin.cs                      # Plugin entry point
    ├── PluginServiceRegistrator.cs    # Registers IRecordingService with DI
    ├── Configuration/
    │   ├── PluginConfiguration.cs     # Output dir, ffmpeg path, defaults
    │   └── configPage.html            # Kapowie-branded admin dashboard page
    ├── Models/                        # RecordingJob, RecordingMode/Status, DTOs
    ├── Services/                      # IRecordingService / RecordingService (ffmpeg + scheduling)
    ├── ScheduledTasks/                # RecordingSchedulerTask (IScheduledTask)
    └── Api/                           # RecordingsController (REST API)
```

## REST API

All endpoints require an elevated (admin) API key/session, same as other
Jellyfin admin-only plugin APIs.

| Method | Route                          | Description                          |
|--------|---------------------------------|---------------------------------------|
| GET    | `/Kapowie/Recordings`           | List all recording jobs               |
| GET    | `/Kapowie/Recordings/{id}`      | Get a single job                      |
| POST   | `/Kapowie/Recordings`           | Create an on-demand or scheduled job  |
| POST   | `/Kapowie/Recordings/{id}/Stop` | Stop an in-progress recording         |
| DELETE | `/Kapowie/Recordings/{id}`      | Delete a job's metadata               |

`POST /Kapowie/Recordings` body:

```json
{
  "name": "Evening News",
  "sourceUrl": "https://example.com/stream.m3u8",
  "mode": "Scheduled",
  "scheduledStartUtc": "2026-07-01T18:00:00Z",
  "durationMinutes": 90
}
```

Use `"mode": "OnDemand"` and omit `scheduledStartUtc` to start capturing
immediately; leave `durationMinutes` at `0` to record until you call the
`Stop` endpoint.

## Building

Requires the [.NET 9 SDK](https://dotnet.microsoft.com/download).

```bash
cd jellyfin-plugin
dotnet build Jellyfin.Plugin.Kapowie/Jellyfin.Plugin.Kapowie.csproj --configuration Release
```

The compiled plugin is at
`Jellyfin.Plugin.Kapowie/bin/Release/net9.0/Jellyfin.Plugin.Kapowie.dll`.

## Installing

1. Build the plugin (above), or download the DLL from CI.
2. Create a folder named `Kapowie Recorder` inside your Jellyfin server's
   plugin directory (e.g. `<jellyfin-data>/plugins/Kapowie Recorder`).
3. Copy `Jellyfin.Plugin.Kapowie.dll` into that folder.
4. Restart the Jellyfin server.
5. Open **Dashboard → Plugins → Kapowie Recorder** to configure the output
   directory, ffmpeg path, and manage recordings.

## Requirements

- Jellyfin Server 10.11.x
- `ffmpeg` available on the server (on `PATH`, or pointed to via the plugin
  configuration's FFmpeg Path setting)
