<script lang="ts">
  import type { Recording } from '../types';
  import { createEventDispatcher } from 'svelte';

  export let recordings: Recording[] = [];
  export let activeRecordings: Recording[] = [];
  export let completedRecordings: Recording[] = [];

  const dispatch = createEventDispatcher<{
    stop: string;
    pause: string;
    resume: string;
    delete: string;
    download: string;
  }>();
</script>

<div class="recording-controls">
  <p class="summary">
    {activeRecordings.length} active, {completedRecordings.length} completed
  </p>
  {#if recordings.length === 0}
    <p class="empty">No recordings yet.</p>
  {:else}
    <ul>
      {#each recordings as recording (recording.id)}
        <li>
          <div class="recording-info">
            <strong class:is-recording={recording.status === 'recording'}>{recording.status}</strong>
            <span>{recording.url}</span>
          </div>
          <div class="actions">
            {#if recording.status === 'recording'}
              <button on:click={() => dispatch('pause', recording.id)}>Pause</button>
              <button on:click={() => dispatch('stop', recording.id)}>Stop</button>
            {:else}
              <button on:click={() => dispatch('resume', recording.id)}>Resume</button>
            {/if}
            <button on:click={() => dispatch('download', recording.id)}>Download</button>
            <button class="danger" on:click={() => dispatch('delete', recording.id)}>Delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .recording-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .summary {
    margin: 0;
    font-size: 0.78rem;
    color: #a0a8c0;
  }

  .empty {
    color: #a0a8c0;
    font-size: 0.85rem;
    text-align: center;
    padding: 1.5rem 0;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  li {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: rgba(16, 24, 62, 0.55);
    border: 1px solid rgba(160, 168, 192, 0.14);
    border-radius: 10px;
    padding: 0.6rem 0.75rem;
  }

  .recording-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .recording-info strong {
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #a0a8c0;
  }

  .recording-info strong.is-recording {
    color: #e83bff;
  }

  .recording-info span {
    font-size: 0.78rem;
    color: #c8d0e8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .actions button {
    background: rgba(122, 44, 255, 0.12);
    border: 1px solid rgba(122, 44, 255, 0.35);
    color: #c8d0e8;
    border-radius: 6px;
    padding: 0.3rem 0.65rem;
    font-family: inherit;
    font-weight: 500;
    font-size: 0.74rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .actions button:hover {
    background: rgba(122, 44, 255, 0.22);
    border-color: #45b0ff;
    color: #f6f7fb;
  }

  .actions button.danger {
    border-color: rgba(232, 59, 255, 0.35);
  }

  .actions button.danger:hover {
    background: rgba(232, 59, 255, 0.18);
    border-color: #e83bff;
  }
</style>
