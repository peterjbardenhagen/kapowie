<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { StreamInfo, Recording } from '../../types';
  import StreamList from '../../components/StreamList.svelte';
  import RecordingControls from '../../components/RecordingControls.svelte';
  import logoMark from '../../../../shared/assets/kapowie-mark.svg';

  let streams: StreamInfo[] = [];
  let recordings: Recording[] = [];
  let activeTab: 'streams' | 'recordings' | 'settings' = 'streams';
  let selectedQuality = 'best';
  let autoDetect = true;
  let restreamEnabled = false;
  let restreamPort = 8124;

  let refreshInterval: number;

  onMount(async () => {
    await refreshStreams();
    await refreshRecordings();
    // Refresh every 2 seconds
    refreshInterval = window.setInterval(async () => {
      await refreshStreams();
      await refreshRecordings();
    }, 2000);

    // Listen for real-time stream detection
    chrome.runtime.onMessage.addListener(handleMessage);
  });

  onDestroy(() => {
    clearInterval(refreshInterval);
    chrome.runtime.onMessage.removeListener(handleMessage);
  });

  function handleMessage(message: { type: string; payload?: any }) {
    if (message.type === 'STREAM_DETECTED') {
      refreshStreams();
    }
  }

  async function refreshStreams() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STREAMS' });
      if (response?.streams) {
        streams = response.streams;
      }
    } catch {
      // Background may not be ready
    }

    // Also query active tab for video streams
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_VIDEO_STREAMS' });
        if (response?.streams) {
          for (const stream of response.streams) {
            if (!streams.some((s) => s.url === stream.url)) {
              streams = [...streams, stream];
            }
          }
        }
      }
    } catch {
      // Content script may not be loaded on this page
    }
  }

  async function refreshRecordings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDINGS' });
      if (response?.recordings) {
        recordings = response.recordings;
      }
    } catch {
      // Background may not be ready
    }
  }

  async function startRecording(stream: StreamInfo) {
    await chrome.runtime.sendMessage({
      type: 'START_RECORDING',
      payload: { stream, quality: selectedQuality },
    });
    await refreshRecordings();
  }

  async function stopRecording(id: string) {
    await chrome.runtime.sendMessage({
      type: 'STOP_RECORDING',
      payload: { id },
    });
    await refreshRecordings();
  }

  async function pauseRecording(id: string) {
    await chrome.runtime.sendMessage({
      type: 'PAUSE_RECORDING',
      payload: { id },
    });
    await refreshRecordings();
  }

  async function resumeRecording(id: string) {
    await chrome.runtime.sendMessage({
      type: 'RESUME_RECORDING',
      payload: { id },
    });
    await refreshRecordings();
  }

  async function deleteRecording(id: string) {
    await chrome.runtime.sendMessage({
      type: 'DELETE_RECORDING',
      payload: { id },
    });
    recordings = recordings.filter((r) => r.id !== id);
  }

  async function downloadRecording(id: string) {
    await chrome.runtime.sendMessage({
      type: 'DOWNLOAD_SEGMENTS',
      payload: { id },
    });
  }

  function handleQualityChange(event: CustomEvent<string>) {
    selectedQuality = event.detail;
  }

  function handleRecord(event: CustomEvent<StreamInfo>) {
    return startRecording(event.detail);
  }

  function handleStop(event: CustomEvent<string>) {
    return stopRecording(event.detail);
  }

  function handlePause(event: CustomEvent<string>) {
    return pauseRecording(event.detail);
  }

  function handleResume(event: CustomEvent<string>) {
    return resumeRecording(event.detail);
  }

  function handleDelete(event: CustomEvent<string>) {
    return deleteRecording(event.detail);
  }

  function handleDownload(event: CustomEvent<string>) {
    return downloadRecording(event.detail);
  }

  async function toggleRestream() {
    if (restreamEnabled) {
      await chrome.runtime.sendMessage({ type: 'START_RESTREAM' });
    } else {
      await chrome.runtime.sendMessage({ type: 'STOP_RESTREAM' });
    }
  }

  async function saveSettings() {
    await chrome.storage.local.set({
      settings: {
        maxQuality: selectedQuality,
        autoDetect,
        restreamEnabled,
        restreamPort,
      },
    });
  }

  $: activeRecordings = recordings.filter((r) => r.status === 'recording');
  $: completedRecordings = recordings.filter((r) => r.status !== 'recording');
</script>

<div class="popup-container">
  <header class="popup-header">
    <img class="brand-mark" src={logoMark} alt="Kapowie" />
    <div>
      <h1>Kapowie</h1>
      <p class="subtitle">Capture. Re-stream. Anywhere.</p>
    </div>
  </header>

  <nav class="tabs">
    <button
      class:active={activeTab === 'streams'}
      on:click={() => activeTab = 'streams'}
    >
      Streams
    </button>
    <button
      class:active={activeTab === 'recordings'}
      on:click={() => activeTab = 'recordings'}
    >
      Recordings
    </button>
    <button
      class:active={activeTab === 'settings'}
      on:click={() => activeTab = 'settings'}
    >
      Settings
    </button>
  </nav>

  <main class="popup-content">
    {#if activeTab === 'streams'}
      <StreamList
        {streams}
        {selectedQuality}
        on:qualityChange={handleQualityChange}
        on:record={handleRecord}
      />
    {:else if activeTab === 'recordings'}
      <RecordingControls
        recordings={recordings}
        activeRecordings={activeRecordings}
        completedRecordings={completedRecordings}
        on:stop={handleStop}
        on:pause={handlePause}
        on:resume={handleResume}
        on:delete={handleDelete}
        on:download={handleDownload}
      />
    {:else if activeTab === 'settings'}
      <div class="settings">
        <div class="setting-group">
          <label>
            <input type="checkbox" bind:checked={autoDetect} on:change={saveSettings} />
            Auto-detect streams on page load
          </label>
        </div>
        <div class="setting-group">
          <label>
            <input type="checkbox" bind:checked={restreamEnabled} on:change={toggleRestream} />
            Enable local re-stream server
          </label>
        </div>
        <div class="setting-group">
          <label>
            Re-stream Port:
            <input
              type="number"
              bind:value={restreamPort}
              min="1024"
              max="65535"
              on:change={saveSettings}
            />
          </label>
        </div>
        <div class="setting-group">
          <button class="btn-primary" on:click={saveSettings}>Save Settings</button>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  .popup-container {
    min-height: 100vh;
    background:
      radial-gradient(circle at top left, rgba(122, 44, 255, 0.18), transparent 30%),
      linear-gradient(180deg, #070b2a 0%, #10183e 100%);
    color: #f6f7fb;
  }

  .popup-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border-bottom: 1px solid rgba(160, 168, 192, 0.14);
    background: rgba(7, 11, 42, 0.92);
  }

  .brand-mark {
    width: 2.4rem;
    height: 2.4rem;
    filter: drop-shadow(0 0 8px rgba(122, 44, 255, 0.4));
  }

  .popup-header h1 {
    font-size: 1rem;
    letter-spacing: 0.01em;
    margin: 0;
  }

  .subtitle {
    margin: 0.15rem 0 0;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #a0a8c0;
  }
</style>
