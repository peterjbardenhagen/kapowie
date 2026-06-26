<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { StreamInfo, Recording } from '../../types';
  import StreamList from '../../components/StreamList.svelte';
  import RecordingControls from '../../components/RecordingControls.svelte';

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
    <h1>🎬 Kapowie</h1>
    <p class="subtitle">Stream Recorder</p>
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
        on:qualityChange={(e) => selectedQuality = e.detail}
        on:record={async (e) => startRecording(e.detail)}
      />
    {:else if activeTab === 'recordings'}
      <RecordingControls
        recordings={recordings}
        activeRecordings={activeRecordings}
        completedRecordings={completedRecordings}
        on:stop={(e) => stopRecording(e.detail)}
        on:pause={(e) => pauseRecording(e.detail)}
        on:resume={(e) => resumeRecording(e.detail)}
        on:delete={(e) => deleteRecording(e.detail)}
        on:download={(e) => downloadRecording(e.detail)}
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
  /* Inline critical styles - full styles in global.css */
</style>
