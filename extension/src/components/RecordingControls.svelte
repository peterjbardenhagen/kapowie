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
          <div>
            <strong>{recording.status}</strong>
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
            <button on:click={() => dispatch('delete', recording.id)}>Delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
