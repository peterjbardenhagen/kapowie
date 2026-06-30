using System;
using System.Collections.Generic;
using System.Net.Mime;
using System.Threading.Tasks;
using Jellyfin.Plugin.Kapowie.Models;
using Jellyfin.Plugin.Kapowie.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.Kapowie.Api;

/// <summary>
/// REST API for managing Kapowie recording jobs.
/// </summary>
[ApiController]
[Authorize(Policy = "RequiresElevation")]
[Route("Kapowie/Recordings")]
[Produces(MediaTypeNames.Application.Json)]
public class RecordingsController : ControllerBase
{
    private readonly IRecordingService _recordingService;

    /// <summary>
    /// Initializes a new instance of the <see cref="RecordingsController"/> class.
    /// </summary>
    /// <param name="recordingService">The recording service.</param>
    public RecordingsController(IRecordingService recordingService)
    {
        _recordingService = recordingService;
    }

    /// <summary>
    /// Lists all recording jobs.
    /// </summary>
    /// <returns>All known recording jobs, newest first.</returns>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<RecordingJob>> GetRecordings()
    {
        return Ok(_recordingService.GetJobs());
    }

    /// <summary>
    /// Gets a single recording job.
    /// </summary>
    /// <param name="id">The job id.</param>
    /// <returns>The job.</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<RecordingJob> GetRecording([FromRoute] Guid id)
    {
        var job = _recordingService.GetJob(id);
        return job is null ? NotFound() : Ok(job);
    }

    /// <summary>
    /// Creates a new on-demand or scheduled recording job.
    /// </summary>
    /// <param name="request">The recording parameters.</param>
    /// <returns>The created job.</returns>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public ActionResult<RecordingJob> CreateRecording([FromBody] CreateRecordingRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SourceUrl))
        {
            return BadRequest("sourceUrl is required.");
        }

        if (request.Mode == RecordingMode.Scheduled && request.ScheduledStartUtc is null)
        {
            return BadRequest("scheduledStartUtc is required for scheduled recordings.");
        }

        var job = _recordingService.CreateJob(request);
        return CreatedAtAction(nameof(GetRecording), new { id = job.Id }, job);
    }

    /// <summary>
    /// Stops an in-progress recording.
    /// </summary>
    /// <param name="id">The job id.</param>
    /// <returns>No content on success.</returns>
    [HttpPost("{id}/Stop")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> StopRecording([FromRoute] Guid id)
    {
        var stopped = await _recordingService.StopJobAsync(id).ConfigureAwait(false);
        return stopped ? NoContent() : NotFound();
    }

    /// <summary>
    /// Deletes a recording job's metadata, stopping it first if still running.
    /// </summary>
    /// <param name="id">The job id.</param>
    /// <returns>No content on success.</returns>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult DeleteRecording([FromRoute] Guid id)
    {
        var deleted = _recordingService.DeleteJob(id);
        return deleted ? NoContent() : NotFound();
    }
}
