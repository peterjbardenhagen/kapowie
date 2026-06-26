<script lang="ts">
  import type { StreamInfo } from '../types';
  import { createEventDispatcher } from 'svelte';

  export let streams: StreamInfo[] = [];
  export let selectedQuality = 'best';

  const dispatch = createEventDispatcher<{
    qualityChange: string;
    record: StreamInfo;
  }>();

  function selectQuality(event: Event) {
    const target = event.currentTarget as HTMLSelectElement;
    dispatch('qualityChange', target.value);
  }
</script>

<div class="stream-list">
  <div class="toolbar">
    <label>
      Quality
      <select bind:value={selectedQuality} on:change={selectQuality}>
        <option value="best">Best</option>
        <option value="1080p">1080p</option>
        <option value="720p">720p</option>
        <option value="480p">480p</option>
      </select>
    </label>
  </div>

  {#if streams.length === 0}
    <p class="empty">No streams detected on this page yet.</p>
  {:else}
    <ul>
      {#each streams as stream (stream.url)}
        <li>
          <div>
            <strong>{stream.type.toUpperCase()}</strong>
            <span>{stream.url}</span>
          </div>
          <button on:click={() => dispatch('record', stream)}>Record</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

