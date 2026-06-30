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
  let showNetworkDropdown = false;

  let refreshInterval: number;

  const networkLinks = [
    { name: 'FreeLiveSports.ai', url: 'https://freelivesports.ai', icon: '🏆' },
    { name: 'FightStream.ai', url: 'https://fightstream.ai', icon: '🥊' },
    { name: 'ProStream.ai', url: 'https://prostream.ai', icon: '📡' },
  ];

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

    // Close dropdown on outside click
    document.addEventListener('click', closeNetworkDropdown);
  });

  onDestroy(() => {
    clearInterval(refreshInterval);
    chrome.runtime.onMessage.removeListener(handleMessage);
    document.removeEventListener('click', closeNetworkDropdown);
  });

  function handleMessage(message: { type: string; payload?: any }) {
    if (message.type === 'STREAM_DETECTED') {
      refreshStreams();
    }
  }

  function closeNetworkDropdown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.network-dropdown')) {
      showNetworkDropdown = false;
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

  function openNetworkUrl(url: string) {
    chrome.tabs.create({ url });
    showNetworkDropdown = false;
  }

  $: activeRecordings = recordings.filter((r) => r.status === 'recording');
  $: completedRecordings = recordings.filter((r) => r.status !== 'recording');
</script>

<div class="popup-container">
  <header class="popup-header">
    <img class="brand-mark" src={logoMark} alt="Kapowie" />
    <div class="header-title">
      <h1>Kapowie</h1>
      <p class="subtitle">Capture. Re-stream. Anywhere.</p>
    </div>
    <div class="network-dropdown">
      <button
        class="network-btn"
        on:click|stopPropagation={() => showNetworkDropdown = !showNetworkDropdown}
      >
        Our Network ▾
      </button>
      {#if showNetworkDropdown}
        <div class="network-menu">
          {#each networkLinks as link}
            <button
              class="network-item"
              on:click={() => openNetworkUrl(link.url)}
            >
              <span class="network-icon">{link.icon}</span>
              <span>{link.name}</span>
            </button>
          {/each}
        </div>
      {/if}
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

  .header-title {
    flex: 1;
    min-width: 0;
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

  /* Network Dropdown */
  .network-dropdown {
    position: relative;
  }

  .network-btn {
    background: linear-gradient(135deg, rgba(122, 44, 255, 0.2), rgba(69, 176, 255, 0.2));
    border: 1px solid rgba(122, 44, 255, 0.4);
    color: #c8d0e8;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 500;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .network-btn:hover {
    background: linear-gradient(135deg, rgba(122, 44, 255, 0.35), rgba(69, 176, 255, 0.35));
    border-color: rgba(122, 44, 255, 0.7);
    color: #fff;
  }

  .network-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: #10183e;
    border: 1px solid rgba(122, 44, 255, 0.3);
    border-radius: 8px;
    padding: 0.35rem 0;
    min-width: 180px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 100;
  }

  .network-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.55rem 0.9rem;
    background: none;
    border: none;
    color: #c8d0e8;
    font-size: 0.82rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .network-item:hover {
    background: rgba(122, 44, 255, 0.15);
    color: #fff;
  }

  .network-icon {
    font-size: 1rem;
  }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.6rem 1rem 0;
    border-bottom: 1px solid rgba(160, 168, 192, 0.14);
  }

  .tabs button {
    background: none;
    border: none;
    color: #a0a8c0;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 500;
    padding: 0.5rem 0.85rem;
    cursor: pointer;
    border-radius: 6px 6px 0 0;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }

  .tabs button:hover {
    color: #f6f7fb;
    background: rgba(122, 44, 255, 0.08);
  }

  .tabs button.active {
    color: #f6f7fb;
    border-bottom-color: #45b0ff;
    background: rgba(122, 44, 255, 0.12);
  }

  .popup-content {
    min-width: 320px;
    max-height: 420px;
    overflow-y: auto;
    padding: 1rem;
  }

  /* Settings */
  .settings {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .setting-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #c8d0e8;
  }

  .setting-group input[type='number'] {
    background: rgba(7, 11, 42, 0.6);
    border: 1px solid rgba(160, 168, 192, 0.25);
    color: #f6f7fb;
    border-radius: 6px;
    padding: 0.3rem 0.5rem;
    width: 6rem;
    font-family: inherit;
  }

  .setting-group input[type='checkbox'] {
    accent-color: #7a2cff;
  }

  :global(.btn-primary) {
    background: linear-gradient(135deg, #7a2cff 0%, #45b0ff 100%);
    color: #f6f7fb;
    border: none;
    border-radius: 8px;
    padding: 0.55rem 1.1rem;
    font-family: inherit;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  :global(.btn-primary:hover) {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(122, 44, 255, 0.4);
  }
</style>
