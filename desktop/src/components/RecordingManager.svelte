<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';

  interface Recording {
    id: string;
    url: string;
    output_path: string;
    status: string;
    started_at: string;
    file_size: number;
    duration_secs: number;
  }

  let recordings: Recording[] = [];
  let loading = false;
  let error = '';

  async function loadRecordings() {
    loading = true;
    try {
      recordings = await invoke('list_recordings');
    } catch (e) {
      error = e as string;
    } finally {
      loading = false;
    }
  }

  async function stopRecording(id: string) {
    try {
      await invoke('stop_recording', { id });
      await loadRecordings();
    } catch (e) {
      error = e as string;
    }
  }

  async function deleteRecording(path: string) {
    try {
      await invoke('delete_recording', { path });
      await loadRecordings();
    } catch (e) {
      error = e as string;
    }
  }

  async function openFolder() {
    try {
      await invoke('open_recording_folder');
    } catch (e) {
      error = e as string;
    }
  }

  onMount(() => {
    loadRecordings();
  });

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
</script>

<div class="recording-manager">
  <div class="header">
    <h2>Recordings</h2>
    <div class="actions">
      <button on:click={loadRecordings} disabled={loading}>
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
      <button on:click={openFolder}>Open Folder</button>
    </div>
  </div>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  {#if recordings.length === 0 && !loading}
    <div class="empty">
      <p>No recordings yet. Start recording from the Capture tab.</p>
    </div>
  {:else}
    <div class="recordings-list">
      {#each recordings as rec (rec.id)}
        <div class="recording-card">
          <div class="recording-header">
            <span class="recording-id">ID: {rec.id.slice(0, 8)}</span>
            <span class="recording-status status-{rec.status}">
              {rec.status}
            </span>
          </div>
          <div class="recording-details">
            <p><strong>URL:</strong> {rec.url}</p>
            <p><strong>Started:</strong> {formatDate(rec.started_at)}</p>
            <p><strong>Size:</strong> {formatSize(rec.file_size)}</p>
            <p class="path"><strong>Path:</strong> {rec.output_path}</p>
          </div>
          <div class="recording-actions">
            {#if rec.status === 'recording'}
              <button class="btn-danger" on:click={() => stopRecording(rec.id)}>
                Stop
              </button>
            {/if}
            <button class="btn-danger" on:click={() => deleteRecording(rec.output_path)}>
              Delete
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .recording-manager {
    max-width: 900px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  h2 {
    color: var(--kapowie-purple);
    margin: 0;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .actions button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--kapowie-border);
    border-radius: 6px;
    background: var(--kapowie-surface);
    color: var(--kapowie-text);
    cursor: pointer;
    font-size: 0.85rem;
    transition: border-color 0.15s, background 0.15s;
  }

  .actions button:hover:not(:disabled) {
    border-color: var(--kapowie-blue);
    background: rgba(122, 44, 255, 0.12);
  }

  .error {
    background: rgba(232, 59, 255, 0.1);
    color: #ff6b6b;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid #ff6b6b;
    margin-bottom: 1rem;
  }

  .empty {
    text-align: center;
    padding: 3rem;
    color: var(--kapowie-muted);
    background: var(--kapowie-surface);
    border-radius: 8px;
  }

  .recordings-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .recording-card {
    background: var(--kapowie-surface);
    padding: 1.25rem;
    border-radius: 8px;
    border: 1px solid var(--kapowie-border);
  }

  .recording-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .recording-id {
    font-family: monospace;
    color: var(--kapowie-blue);
    font-weight: 600;
  }

  .recording-status {
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    font-size: 0.8rem;
    text-transform: uppercase;
    font-weight: 600;
  }

  .status-recording {
    background: var(--kapowie-pink);
    color: var(--kapowie-text);
  }

  .status-completed {
    background: #2ee66b;
    color: var(--kapowie-navy);
  }

  .status-failed {
    background: #e67e22;
    color: var(--kapowie-text);
  }

  .recording-details p {
    margin: 0.3rem 0;
    font-size: 0.9rem;
  }

  .path {
    font-size: 0.8rem;
    word-break: break-all;
    color: var(--kapowie-muted);
  }

  .recording-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .btn-danger {
    background: rgba(160, 168, 192, 0.18);
    padding: 0.4rem 1rem;
    border: 1px solid var(--kapowie-border);
    border-radius: 4px;
    color: var(--kapowie-text);
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.15s, border-color 0.15s;
  }

  .btn-danger:hover {
    background: rgba(232, 59, 255, 0.18);
    border-color: var(--kapowie-pink);
  }
</style>
