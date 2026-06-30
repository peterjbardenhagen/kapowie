using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Plugin.Kapowie.Configuration;
using Jellyfin.Plugin.Kapowie.Models;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Kapowie.Services;

/// <summary>
/// Default <see cref="IRecordingService"/> implementation. Captures streams with ffmpeg,
/// persisting job metadata as JSON in the plugin's data folder.
/// </summary>
public class RecordingService : IRecordingService, IDisposable
{
    private static readonly Regex InvalidFileNameChars = new(@"[^a-zA-Z0-9 _\-\.]", RegexOptions.Compiled);

    private readonly ILogger<RecordingService> _logger;
    private readonly ConcurrentDictionary<Guid, RecordingJob> _jobs = new();
    private readonly ConcurrentDictionary<Guid, Process> _runningProcesses = new();
    private readonly object _persistLock = new();
    private readonly string _stateFilePath;
    private bool _disposed;

    /// <summary>
    /// Initializes a new instance of the <see cref="RecordingService"/> class.
    /// </summary>
    /// <param name="logger">Logger instance.</param>
    public RecordingService(ILogger<RecordingService> logger)
    {
        _logger = logger;

        var dataFolder = Plugin.Instance?.DataFolderPath
            ?? throw new InvalidOperationException("Plugin instance is not initialized.");
        Directory.CreateDirectory(dataFolder);
        _stateFilePath = Path.Combine(dataFolder, "recordings.json");

        LoadState();
    }

    private static PluginConfiguration Config =>
        Plugin.Instance?.Configuration ?? new PluginConfiguration();

    /// <inheritdoc />
    public IReadOnlyList<RecordingJob> GetJobs()
    {
        return _jobs.Values.OrderByDescending(j => j.CreatedUtc).ToList();
    }

    /// <inheritdoc />
    public RecordingJob? GetJob(Guid id)
    {
        return _jobs.TryGetValue(id, out var job) ? job : null;
    }

    /// <inheritdoc />
    public RecordingJob CreateJob(CreateRecordingRequest request)
    {
        var durationMinutes = request.DurationMinutes > 0
            ? request.DurationMinutes
            : (request.Mode == RecordingMode.Scheduled ? Config.DefaultDurationMinutes : 0);

        var job = new RecordingJob
        {
            Name = string.IsNullOrWhiteSpace(request.Name) ? $"Recording {DateTime.UtcNow:yyyy-MM-dd HH-mm-ss}" : request.Name,
            SourceUrl = request.SourceUrl,
            Mode = request.Mode,
            ScheduledStartUtc = request.Mode == RecordingMode.Scheduled ? request.ScheduledStartUtc : null,
            DurationMinutes = durationMinutes,
            Status = RecordingStatus.Pending
        };

        job.OutputPath = BuildOutputPath(job);
        _jobs[job.Id] = job;
        PersistState();

        if (job.Mode == RecordingMode.OnDemand)
        {
            StartJob(job);
        }

        return job;
    }

    /// <inheritdoc />
    public Task<bool> StopJobAsync(Guid id)
    {
        if (!_jobs.TryGetValue(id, out var job))
        {
            return Task.FromResult(false);
        }

        return StopRunningProcessAsync(job, RecordingStatus.Cancelled);
    }

    /// <inheritdoc />
    public bool DeleteJob(Guid id)
    {
        if (!_jobs.TryRemove(id, out var job))
        {
            return false;
        }

        if (_runningProcesses.ContainsKey(id))
        {
            _ = StopRunningProcessAsync(job, RecordingStatus.Cancelled);
        }

        PersistState();
        return true;
    }

    /// <inheritdoc />
    public Task ProcessDueJobsAsync()
    {
        var now = DateTime.UtcNow;
        var due = _jobs.Values
            .Where(j => j.Mode == RecordingMode.Scheduled
                && j.Status == RecordingStatus.Pending
                && j.ScheduledStartUtc.HasValue
                && j.ScheduledStartUtc.Value <= now)
            .ToList();

        foreach (var job in due)
        {
            StartJob(job);
        }

        return Task.CompletedTask;
    }

    private void StartJob(RecordingJob job)
    {
        var ffmpegPath = string.IsNullOrWhiteSpace(Config.FfmpegPath) ? "ffmpeg" : Config.FfmpegPath;
        var directory = Path.GetDirectoryName(job.OutputPath);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var psi = new ProcessStartInfo
        {
            FileName = ffmpegPath,
            RedirectStandardInput = true,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        psi.ArgumentList.Add("-y");
        psi.ArgumentList.Add("-i");
        psi.ArgumentList.Add(job.SourceUrl);
        if (job.DurationMinutes > 0)
        {
            psi.ArgumentList.Add("-t");
            psi.ArgumentList.Add((job.DurationMinutes * 60).ToString(CultureInfo.InvariantCulture));
        }

        psi.ArgumentList.Add("-c");
        psi.ArgumentList.Add("copy");
        psi.ArgumentList.Add(job.OutputPath);

        Process process;
        try
        {
            process = new Process { StartInfo = psi, EnableRaisingEvents = true };
            process.Exited += (_, _) => OnProcessExited(job, process);
            process.Start();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start ffmpeg for recording job {JobId}", job.Id);
            job.Status = RecordingStatus.Failed;
            job.ErrorMessage = ex.Message;
            job.CompletedUtc = DateTime.UtcNow;
            PersistState();
            return;
        }

        job.Status = RecordingStatus.Recording;
        job.StartedUtc = DateTime.UtcNow;
        _runningProcesses[job.Id] = process;
        PersistState();

        _ = DrainStreamAsync(process);
    }

    private async Task DrainStreamAsync(Process process)
    {
        try
        {
            await process.StandardError.ReadToEndAsync().ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Error draining ffmpeg stderr.");
        }
    }

    private void OnProcessExited(RecordingJob job, Process process)
    {
        _runningProcesses.TryRemove(job.Id, out _);

        // Cancellation already sets the final status before the process exits.
        if (job.Status != RecordingStatus.Cancelled)
        {
            job.Status = process.ExitCode == 0 ? RecordingStatus.Completed : RecordingStatus.Failed;
            if (process.ExitCode != 0)
            {
                job.ErrorMessage = $"ffmpeg exited with code {process.ExitCode}";
            }
        }

        job.CompletedUtc = DateTime.UtcNow;
        PersistState();
        process.Dispose();
    }

    private async Task<bool> StopRunningProcessAsync(RecordingJob job, RecordingStatus finalStatus)
    {
        if (!_runningProcesses.TryGetValue(job.Id, out var process))
        {
            if (job.Status == RecordingStatus.Pending)
            {
                job.Status = finalStatus;
                job.CompletedUtc = DateTime.UtcNow;
                PersistState();
                return true;
            }

            return false;
        }

        job.Status = finalStatus;
        job.CompletedUtc = DateTime.UtcNow;
        PersistState();

        try
        {
            if (!process.HasExited)
            {
                // Ask ffmpeg to finalize the output file gracefully before falling back to a hard kill.
                await process.StandardInput.WriteAsync('q').ConfigureAwait(false);
                process.StandardInput.Close();

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                try
                {
                    await process.WaitForExitAsync(cts.Token).ConfigureAwait(false);
                }
                catch (OperationCanceledException)
                {
                    if (!process.HasExited)
                    {
                        process.Kill(true);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error stopping ffmpeg for recording job {JobId}", job.Id);
        }

        return true;
    }

    private string BuildOutputPath(RecordingJob job)
    {
        var outputDir = string.IsNullOrWhiteSpace(Config.OutputDirectory)
            ? Path.Combine(Plugin.Instance!.DataFolderPath, "recordings")
            : Config.OutputDirectory;

        var safeName = InvalidFileNameChars.Replace(job.Name, "_");
        var fileName = $"{safeName}_{job.Id:N}.mp4";
        return Path.Combine(outputDir, fileName);
    }

    private void PersistState()
    {
        lock (_persistLock)
        {
            try
            {
                var snapshot = _jobs.Values.ToList();
                var json = JsonSerializer.Serialize(snapshot, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_stateFilePath, json);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to persist Kapowie recording state.");
            }
        }
    }

    private void LoadState()
    {
        if (!File.Exists(_stateFilePath))
        {
            return;
        }

        try
        {
            var json = File.ReadAllText(_stateFilePath);
            var jobs = JsonSerializer.Deserialize<List<RecordingJob>>(json) ?? new List<RecordingJob>();
            foreach (var job in jobs)
            {
                // Recordings that were in-flight when the server stopped did not exit cleanly.
                if (job.Status == RecordingStatus.Recording)
                {
                    job.Status = RecordingStatus.Failed;
                    job.ErrorMessage = "Recording interrupted by server restart.";
                    job.CompletedUtc ??= DateTime.UtcNow;
                }

                _jobs[job.Id] = job;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load Kapowie recording state.");
        }
    }

    /// <inheritdoc />
    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        foreach (var process in _runningProcesses.Values)
        {
            try
            {
                if (!process.HasExited)
                {
                    process.Kill(true);
                }

                process.Dispose();
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Error disposing ffmpeg process.");
            }
        }

        _disposed = true;
        GC.SuppressFinalize(this);
    }
}
