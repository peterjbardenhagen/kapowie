namespace Jellyfin.Plugin.Kapowie.Models;

/// <summary>
/// Lifecycle state of a recording job.
/// </summary>
public enum RecordingStatus
{
    /// <summary>
    /// Waiting for its scheduled start time.
    /// </summary>
    Pending,

    /// <summary>
    /// Actively capturing the source stream.
    /// </summary>
    Recording,

    /// <summary>
    /// Finished successfully.
    /// </summary>
    Completed,

    /// <summary>
    /// Ffmpeg exited with an error.
    /// </summary>
    Failed,

    /// <summary>
    /// Stopped by the user before completion.
    /// </summary>
    Cancelled
}
