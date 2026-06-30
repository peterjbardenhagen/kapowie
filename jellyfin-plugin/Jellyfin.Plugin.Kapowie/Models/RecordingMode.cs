namespace Jellyfin.Plugin.Kapowie.Models;

/// <summary>
/// Determines when a recording job starts capturing.
/// </summary>
public enum RecordingMode
{
    /// <summary>
    /// The recording starts immediately when the job is created.
    /// </summary>
    OnDemand,

    /// <summary>
    /// The recording starts at a future <see cref="RecordingJob.ScheduledStartUtc"/>.
    /// </summary>
    Scheduled
}
