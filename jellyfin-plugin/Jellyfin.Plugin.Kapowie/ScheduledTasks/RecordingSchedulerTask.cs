using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Plugin.Kapowie.Services;
using MediaBrowser.Model.Tasks;

namespace Jellyfin.Plugin.Kapowie.ScheduledTasks;

/// <summary>
/// Periodically starts scheduled recording jobs whose start time has arrived.
/// </summary>
public class RecordingSchedulerTask : IScheduledTask
{
    private readonly IRecordingService _recordingService;

    /// <summary>
    /// Initializes a new instance of the <see cref="RecordingSchedulerTask"/> class.
    /// </summary>
    /// <param name="recordingService">The recording service.</param>
    public RecordingSchedulerTask(IRecordingService recordingService)
    {
        _recordingService = recordingService;
    }

    /// <inheritdoc />
    public string Name => "Kapowie Recording Scheduler";

    /// <inheritdoc />
    public string Key => "KapowieRecordingScheduler";

    /// <inheritdoc />
    public string Description => "Starts Kapowie recordings whose scheduled start time has arrived.";

    /// <inheritdoc />
    public string Category => "Kapowie";

    /// <inheritdoc />
    public Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        progress.Report(0);
        var task = _recordingService.ProcessDueJobsAsync();
        progress.Report(100);
        return task;
    }

    /// <inheritdoc />
    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
    {
        return new[]
        {
            new TaskTriggerInfo
            {
                Type = TaskTriggerInfoType.IntervalTrigger,
                IntervalTicks = TimeSpan.FromSeconds(30).Ticks
            }
        };
    }
}
