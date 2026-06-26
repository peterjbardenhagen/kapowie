<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import type { StreamInfo } from '../stores/app';

  let streamUrl = '';
  let streamInfo: StreamInfo | null = null;
  let isLoading = false;
  let error = '';
  let recordingActive = false;
  let recordingId = '';

  async function detectStream() {
    if (!streamUrl.trim()) {
      error = 'Please enter a stream URL';
      return;
    }

    isLoading = true;
    error = '';

    try {
      streamInfo = await invoke('get_stream_info', { url: streamUrl });
      streamInfo.url = streamUrl;
    } catch (e) {
      error = e as string;
      streamInfo = null;
    } finally {
      isLoading = false;
    }
  }

  async function startRecording() {
    if (!streamUrl) {
      error = 'No stream URL provided';
      return;
    }

    try {
      const recording = await invoke('start_recording', {
        url: streamUrl,
        outputDir: '',
        quality: 'best',
      });
      recordingActive = true;
      recordingId = (recording as any).id;
      error = '';
    } catch (e) {
      error = e as string;
    }
  }

  async function stopRecording() {
    try {
      await invoke('stop_recording', { id: recordingId });
      recordingActive = false;
      recordingId = '';
    } catch (e) {
      error = e as string;
    }
  }
</script>

<div class="stream-capture">
  <h2>Stream Capture</h2>

  <div class="url-input">
    <input
      type="text"
      bind:value={streamUrl}
      placeholder="Enter stream URL (HLS, RTMP, RTSP, etc.)"
      on:keydown={(e) => e.key === 'Enter' && detectStream()}
    />
    <button on:click={detectStream} disabled={isLoading}>
      {isLoading ? 'Detecting...' : 'Detect'}
    </button>
  </div>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  {#if streamInfo}
    <div class="stream-info">
      <h3>Detected Stream</h3>
      <table>
        <tr><td><strong>URL:</strong></td><td>{streamInfo.url}</td></tr>
        <tr><td><strong>Format:</strong></td><td>{streamInfo.format}</td></tr>
        <tr><td><strong>Quality:</strong></td><td>{streamInfo.quality}</td></tr>
        {#if streamInfo.bitrate}
          <tr><td><strong>Bitrate:</strong></td><td>{(streamInfo.bitrate / 1_000_000).toFixed(1)} Mbps</td></tr>
        {/if}
      </table>

      <div class="controls">
        {#if !recordingActive}
          <button class="btn-record" on:click={startRecording}>
            Start Recording
          </button>
        {:else}
          <button class="btn-stop" on:click={stopRecording}>
            Stop Recording
          </button>
        {/if}
      </div>

      {#if recordingActive}
        <div class="recording-indicator">
          Recording active (ID: {recordingId})
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .stream-capture {
    max-width: 800px;
    margin: 0 auto;
  }

  h2 {
    color: #e94560;
    margin-bottom: 1.5rem;
  }

  .url-input {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .url-input input {
    flex: 1;
    padding: 0.6rem 1rem;
    border: 1px solid #333;
    border-radius: 6px;
    background: #0f3460;
    color: #eee;
    font-size: 0.95rem;
  }

  .url-input input:focus {
    outline: none;
    border-color: #e94560;
  }

  button {
    padding: 0.6rem 1.5rem;
    border: none;
    border-radius: 6px;
    background: #e94560;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
  }

  button:hover:not(:disabled) {
    background: #c73550;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error {
    background: #3d1212;
    color: #ff6b6b;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin: 1rem 0;
    border: 1px solid #ff6b6b;
  }

  .stream-info {
    background: #0f3460;
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid #333;
  }

  .stream-info h3 {
    margin-top: 0;
    color: #e94560;
  }

  .stream-info table {
    width: 100%;
    margin-bottom: 1rem;
  }

  .stream-info td {
    padding: 0.3rem 0;
  }

  .stream-info td:first-child {
    width: 120px;
    color: #aaa;
  }

  .controls {
    margin-top: 1rem;
  }

  .btn-record {
    background: #e94560;
    padding: 0.75rem 2rem;
    font-size: 1rem;
  }

  .btn-stop {
    background: #555;
    padding: 0.75rem 2rem;
    font-size: 1rem;
  }

  .recording-indicator {
    margin-top: 1rem;
    padding: 0.5rem;
    background: #2d1212;
    border-radius: 4px;
    color: #ff6b6b;
    font-size: 0.85rem;
  }
</style>
