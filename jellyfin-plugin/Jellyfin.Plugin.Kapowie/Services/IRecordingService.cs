using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Jellyfin.Plugin.Kapowie.Models;

namespace Jellyfin.Plugin.Kapowie.Services;

/// <summary>
/// Manages the lifecycle of Kapowie recording jobs.
/// </summary>
public interface IRecordingService
{
    /// <summary>
    /// Gets all known recording jobs, newest first.
    /// </summary>
    /// <returns>The recording jobs.</returns>
    IReadOnlyList<RecordingJob> GetJobs();

    /// <summary>
    /// Gets a single recording job by id.
    /// </summary>
    /// <param name="id">The job id.</param>
    /// <returns>The job, or <c>null</c> if not found.</returns>
    RecordingJob? GetJob(Guid id);

    /// <summary>
    /// Creates a new recording job. On-demand jobs start capturing immediately;
    /// scheduled jobs are started later by <see cref="ProcessDueJobsAsync"/>.
    /// </summary>
    /// <param name="request">The job parameters.</param>
    /// <returns>The created job.</returns>
    RecordingJob CreateJob(CreateRecordingRequest request);

    /// <summary>
    /// Stops an in-progress recording, finalizing the output file.
    /// </summary>
    /// <param name="id">The job id.</param>
    /// <returns><c>true</c> if a running job was found and stopped.</returns>
    Task<bool> StopJobAsync(Guid id);

    /// <summary>
    /// Deletes a job's metadata. Running jobs are stopped first.
    /// </summary>
    /// <param name="id">The job id.</param>
    /// <returns><c>true</c> if the job existed.</returns>
    bool DeleteJob(Guid id);

    /// <summary>
    /// Starts any scheduled jobs whose start time has arrived.
    /// Invoked periodically by <see cref="ScheduledTasks.RecordingSchedulerTask"/>.
    /// </summary>
    /// <returns>A task that completes once due jobs have been started.</returns>
    Task ProcessDueJobsAsync();
}
