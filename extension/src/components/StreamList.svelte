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
          <div class="stream-info">
            <strong>{stream.type.toUpperCase()}</strong>
            <span>{stream.url}</span>
          </div>
          <button class="record-btn" on:click={() => dispatch('record', stream)}>Record</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .stream-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .toolbar {
    display: flex;
    justify-content: flex-end;
  }

  .toolbar label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.78rem;
    color: #a0a8c0;
  }

  .toolbar select {
    background: rgba(7, 11, 42, 0.6);
    border: 1px solid rgba(160, 168, 192, 0.25);
    color: #f6f7fb;
    border-radius: 6px;
    padding: 0.3rem 0.5rem;
    font-family: inherit;
    font-size: 0.78rem;
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
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    background: rgba(16, 24, 62, 0.55);
    border: 1px solid rgba(160, 168, 192, 0.14);
    border-radius: 10px;
    padding: 0.6rem 0.75rem;
  }

  .stream-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .stream-info strong {
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    color: #45b0ff;
  }

  .stream-info span {
    font-size: 0.78rem;
    color: #c8d0e8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .record-btn {
    flex-shrink: 0;
    background: linear-gradient(135deg, #7a2cff 0%, #45b0ff 100%);
    color: #f6f7fb;
    border: none;
    border-radius: 6px;
    padding: 0.4rem 0.8rem;
    font-family: inherit;
    font-weight: 600;
    font-size: 0.78rem;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .record-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(122, 44, 255, 0.4);
  }
</style>

