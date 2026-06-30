using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.Kapowie.Configuration;

/// <summary>
/// Configuration for the Kapowie recording plugin.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Initializes a new instance of the <see cref="PluginConfiguration"/> class.
    /// </summary>
    public PluginConfiguration()
    {
        OutputDirectory = string.Empty;
        FfmpegPath = "ffmpeg";
        DefaultDurationMinutes = 60;
        SchedulerIntervalSeconds = 30;
    }

    /// <summary>
    /// Gets or sets the directory recordings are written to. When empty, recordings are
    /// written under the plugin's data folder.
    /// </summary>
    public string OutputDirectory { get; set; }

    /// <summary>
    /// Gets or sets the path to the ffmpeg executable used to capture streams.
    /// </summary>
    public string FfmpegPath { get; set; }

    /// <summary>
    /// Gets or sets the default duration, in minutes, applied to new recording jobs
    /// that do not specify one explicitly.
    /// </summary>
    public int DefaultDurationMinutes { get; set; }

    /// <summary>
    /// Gets or sets how often, in seconds, the scheduler checks for due recordings.
    /// </summary>
    public int SchedulerIntervalSeconds { get; set; }
}
