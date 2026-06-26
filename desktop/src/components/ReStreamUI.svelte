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
    color: #e94560;
    margin-bottom: 1.5rem;
  }

  h3 {
    color: #e94560;
    margin-top: 2rem;
    margin-bottom: 1rem;
  }

  .configuration {
    background: #0f3460;
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid #333;
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
    color: #aaa;
    font-weight: 500;
  }

  input, select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #333;
    border-radius: 6px;
    background: #16213e;
    color: #eee;
    font-size: 0.9rem;
  }

  input:focus, select:focus {
    outline: none;
    border-color: #e94560;
  }

  .btn-start {
    background: #e94560;
    color: #fff;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-start:hover:not(:disabled) {
    background: #c73550;
  }

  .btn-start:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error {
    background: #3d1212;
    color: #ff6b6b;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid #ff6b6b;
    margin-top: 1rem;
  }

  .empty {
    color: #888;
    text-align: center;
    padding: 2rem;
  }

  .restream-card {
    background: #0f3460;
    padding: 1rem 1.25rem;
    border-radius: 8px;
    border: 1px solid #333;
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
    background: #e94560;
    color: #fff;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .restream-port {
    font-family: monospace;
    color: #ccc;
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
    color: #888;
    font-size: 0.8rem;
    word-break: break-all;
  }

  .viewers {
    color: #2ecc71;
  }

  .btn-danger {
    background: #555;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    color: #eee;
    cursor: pointer;
  }

  .btn-danger:hover {
    background: #e94560;
  }
</style>
