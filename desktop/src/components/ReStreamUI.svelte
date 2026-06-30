<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';

  interface ReStreamStatus {
    id: string;
    url: string;
    protocol: string;
    port: number;
    path: string;
    status: string;
    started_at: string;
    viewer_count: number;
  }

  let activeRestreams: ReStreamStatus[] = [];
  let streamUrl = '';
  let protocol = 'HLS';
  let port = 8080;
  let path = '/stream';
  let error = '';
  let loading = false;

  const protocols = ['HLS', 'RTSP', 'MPEG-TS'];

  async function fetchStatus() {
    try {
      activeRestreams = await invoke('get_restream_status');
    } catch (e) {
      error = e as string;
    }
  }

  async function startReStream() {
    if (!streamUrl) {
      error = 'Please enter a stream URL to re-stream';
      return;
    }

    loading = true;
    error = '';

    try {
      await invoke('start_restream', {
        streamUrl,
        protocol,
        port,
        path,
      });
      resetForm();
      await fetchStatus();
    } catch (e) {
      error = e as string;
    } finally {
      loading = false;
    }
  }

  async function stopReStream(id: string) {
    try {
      await invoke('stop_restream', { id });
      await fetchStatus();
    } catch (e) {
      error = e as string;
    }
  }

  function resetForm() {
    streamUrl = '';
    protocol = 'HLS';
    port = 8080;
    path = '/stream';
  }

  onMount(() => {
    fetchStatus();
  });
</script>

<div class="restream-ui">
  <div class="configuration">
    <h2>Re-Stream Configuration</h2>

    <div class="config-grid">
      <div class="config-item">
        <label for="stream-url">Source Stream URL</label>
        <input
          id="stream-url"
          type="text"
          bind:value={streamUrl}
          placeholder="Enter stream URL to re-stream"
        />
      </div>

      <div class="config-item">
        <label for="protocol">Protocol</label>
        <select id="protocol" bind:value={protocol}>
          {#each protocols as p}
            <option value={p}>{p}</option>
          {/each}
        </select>
      </div>

      <div class="config-item">
        <label for="port">Port</label>
        <input
          id="port"
          type="number"
          bind:value={port}
          min="1024"
          max="65535"
        />
      </div>

      <div class="config-item">
        <label for="path">Mount Path</label>
        <input
          id="path"
          type="text"
          bind:value={path}
          placeholder="/stream"
        />
      </div>
    </div>

    <button class="btn-start" on:click={startReStream} disabled={loading}>
      {loading ? 'Starting...' : 'Start Re-Stream'}
    </button>

    {#if error}
      <div class="error">{error}</div>
    {/if}
  </div>

  <div class="active-restreams">
    <h3>Active Re-Streams</h3>
    {#if activeRestreams.length === 0}
      <p class="empty">No active re-streams</p>
    {:else}
      {#each activeRestreams as restream (restream.id)}
        <div class="restream-card">
          <div class="restream-info">
            <span class="restream-protocol">{restream.protocol}</span>
            <span class="restream-port">:{restream.port}{restream.path}</span>
          </div>
          <div class="restream-details">
            <p class="source-url">{restream.url}</p>
            {#if restream.started_at}
              <p class="started">Started: {restream.started_at}</p>
            {/if}
            <p class="viewers">Viewers: {restream.viewer_count}</p>
          </div>
          <button class="btn-danger" on:click={() => stopReStream(restream.id)}>
            Stop
          </button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .restream-ui {
    max-width: 800px;
    margin: 0 auto;
  }

  h2 {
    color: var(--kapowie-purple);
    margin-bottom: 1.5rem;
  }

  h3 {
    color: var(--kapowie-purple);
    margin-top: 2rem;
    margin-bottom: 1rem;
  }

  .configuration {
    background: var(--kapowie-surface);
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--kapowie-border);
    margin-bottom: 2rem;
  }

  .config-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .config-item {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  label {
    font-size: 0.85rem;
    color: var(--kapowie-muted);
    font-weight: 500;
  }

  input, select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--kapowie-border);
    border-radius: 6px;
    background: var(--kapowie-midnight);
    color: var(--kapowie-text);
    font-size: 0.9rem;
  }

  input:focus, select:focus {
    outline: none;
    border-color: var(--kapowie-purple);
  }

  .btn-start {
    background: linear-gradient(135deg, var(--kapowie-purple) 0%, var(--kapowie-blue) 100%);
    color: var(--kapowie-text);
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .btn-start:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(122, 44, 255, 0.4);
  }

  .btn-start:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error {
    background: rgba(232, 59, 255, 0.1);
    color: #ff6b6b;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid #ff6b6b;
    margin-top: 1rem;
  }

  .empty {
    color: var(--kapowie-muted);
    text-align: center;
    padding: 2rem;
  }

  .restream-card {
    background: var(--kapowie-surface);
    padding: 1rem 1.25rem;
    border-radius: 8px;
    border: 1px solid var(--kapowie-border);
    margin-bottom: 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .restream-info {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
  }

  .restream-protocol {
    background: linear-gradient(135deg, var(--kapowie-purple) 0%, var(--kapowie-blue) 100%);
    color: var(--kapowie-text);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .restream-port {
    font-family: monospace;
    color: var(--kapowie-muted);
    font-size: 0.9rem;
  }

  .restream-details {
    flex: 1;
    font-size: 0.85rem;
  }

  .restream-details p {
    margin: 0.15rem 0;
  }

  .source-url {
    color: var(--kapowie-muted);
    font-size: 0.8rem;
    word-break: break-all;
  }

  .viewers {
    color: #2ee66b;
  }

  .btn-danger {
    background: rgba(160, 168, 192, 0.18);
    border: 1px solid var(--kapowie-border);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    color: var(--kapowie-text);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .btn-danger:hover {
    background: rgba(232, 59, 255, 0.18);
    border-color: var(--kapowie-pink);
  }
</style>
