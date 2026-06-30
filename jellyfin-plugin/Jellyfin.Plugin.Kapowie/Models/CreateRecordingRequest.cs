using System;

namespace Jellyfin.Plugin.Kapowie.Models;

/// <summary>
/// Request body for creating a new recording job.
/// </summary>
public class CreateRecordingRequest
{
    /// <summary>
    /// Gets or sets the friendly name for the recording.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the source stream URL to capture.
    /// </summary>
    public string SourceUrl { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets whether to start immediately or at <see cref="ScheduledStartUtc"/>.
    /// </summary>
    public RecordingMode Mode { get; set; } = RecordingMode.OnDemand;

    /// <summary>
    /// Gets or sets the UTC start time. Required when <see cref="Mode"/> is <see cref="RecordingMode.Scheduled"/>.
    /// </summary>
    public DateTime? ScheduledStartUtc { get; set; }

    /// <summary>
    /// Gets or sets the recording duration in minutes. Zero/negative means "record until stopped"
    /// (only valid for on-demand recordings).
    /// </summary>
    public int DurationMinutes { get; set; }
}
