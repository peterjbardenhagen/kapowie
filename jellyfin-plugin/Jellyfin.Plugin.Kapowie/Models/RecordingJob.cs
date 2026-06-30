using System;

namespace Jellyfin.Plugin.Kapowie.Models;

/// <summary>
/// A single on-demand or scheduled recording job.
/// </summary>
public class RecordingJob
{
    /// <summary>
    /// Gets or sets the unique job id.
    /// </summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Gets or sets the friendly name for the recording (used to derive the output file name).
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the source stream URL (HLS, RTMP, RTSP, MPEG-TS, etc.) to capture.
    /// </summary>
    public string SourceUrl { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets whether this job starts immediately or at a scheduled time.
    /// </summary>
    public RecordingMode Mode { get; set; }

    /// <summary>
    /// Gets or sets the current lifecycle state.
    /// </summary>
    public RecordingStatus Status { get; set; } = RecordingStatus.Pending;

    /// <summary>
    /// Gets or sets the UTC time the recording should start. Required for <see cref="RecordingMode.Scheduled"/>.
    /// </summary>
    public DateTime? ScheduledStartUtc { get; set; }

    /// <summary>
    /// Gets or sets how long to record, in minutes. Zero/negative means "record until stopped"
    /// (only valid for <see cref="RecordingMode.OnDemand"/>).
    /// </summary>
    public int DurationMinutes { get; set; }

    /// <summary>
    /// Gets or sets the absolute path the recording is/was written to.
    /// </summary>
    public string OutputPath { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets when the job was created.
    /// </summary>
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Gets or sets when capture actually started.
    /// </summary>
    public DateTime? StartedUtc { get; set; }

    /// <summary>
    /// Gets or sets when the job finished, failed, or was cancelled.
    /// </summary>
    public DateTime? CompletedUtc { get; set; }

    /// <summary>
    /// Gets or sets the error message if the job failed.
    /// </summary>
    public string? ErrorMessage { get; set; }
}
