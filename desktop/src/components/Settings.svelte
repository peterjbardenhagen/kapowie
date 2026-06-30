<script lang="ts">
  import { onMount } from 'svelte';

  let outputDirectory = '/tmp/recordings';
  let quality = 'best';
  let maxConcurrent = 3;
  let segmentDuration = 10;
  let autoReconnect = true;
  let reconnectAttempts = 5;
  let error = '';
  let saved = false;

  const qualities = ['best', 'worst', '1080p', '720p', '480p', '360p'];

  onMount(async () => {
    // Load saved settings from local storage
    const saved = localStorage.getItem('kapowie-settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        outputDirectory = settings.outputDirectory || outputDirectory;
        quality = settings.quality || quality;
        maxConcurrent = settings.maxConcurrent || maxConcurrent;
        segmentDuration = settings.segmentDuration || segmentDuration;
        autoReconnect = settings.autoReconnect ?? autoReconnect;
        reconnectAttempts = settings.reconnectAttempts || reconnectAttempts;
      } catch {
        // Use defaults
      }
    }
  });

  function saveSettings() {
    const settings = {
      outputDirectory,
      quality,
      maxConcurrent,
      segmentDuration,
      autoReconnect,
      reconnectAttempts,
    };
    localStorage.setItem('kapowie-settings', JSON.stringify(settings));
    saved = true;
    setTimeout(() => (saved = false), 2000);
  }
</script>

<div class="settings">
  <h2>Settings</h2>

  <form on:submit|preventDefault={saveSettings}>
    <div class="setting-group">
      <label for="output-dir">Output Directory</label>
      <div class="input-with-button">
        <input
          id="output-dir"
          type="text"
          bind:value={outputDirectory}
          placeholder="Directory to save recordings"
        />
        <button type="button" on:click={() => outputDirectory = '/tmp/recordings'}>
          Default
        </button>
      </div>
    </div>

    <div class="setting-group">
      <label for="quality">Recording Quality</label>
      <select id="quality" bind:value={quality}>
        {#each qualities as q}
          <option value={q}>{q}</option>
        {/each}
      </select>
    </div>

    <div class="setting-group">
      <label for="max-concurrent">Max Concurrent Downloads</label>
      <input
        id="max-concurrent"
        type="number"
        bind:value={maxConcurrent}
        min="1"
        max="10"
      />
    </div>

    <div class="setting-group">
      <label for="segment-duration">Segment Duration (seconds)</label>
      <input
        id="segment-duration"
        type="number"
        bind:value={segmentDuration}
        min="1"
        max="3600"
        step="1"
      />
    </div>

    <div class="setting-group checkbox">
      <label>
        <input type="checkbox" bind:checked={autoReconnect} />
        Auto-reconnect on stream loss
      </label>
    </div>

    {#if autoReconnect}
      <div class="setting-group">
        <label for="reconnect-attempts">Max Reconnect Attempts</label>
        <input
          id="reconnect-attempts"
          type="number"
          bind:value={reconnectAttempts}
          min="1"
          max="20"
        />
      </div>
    {/if}

    <button type="submit">Save Settings</button>

    {#if saved}
      <span class="success">Settings saved!</span>
    {/if}
    {#if error}
      <div class="error">{error}</div>
    {/if}
  </form>
</div>

<style>
  .settings {
    max-width: 600px;
    margin: 0 auto;
  }

  h2 {
    color: var(--kapowie-purple);
    margin-bottom: 1.5rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  label {
    font-size: 0.9rem;
    color: var(--kapowie-muted);
    font-weight: 500;
  }

  input[type="text"],
  input[type="number"],
  select {
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--kapowie-border);
    border-radius: 6px;
    background: var(--kapowie-surface);
    color: var(--kapowie-text);
    font-size: 0.9rem;
  }

  input:focus, select:focus {
    outline: none;
    border-color: var(--kapowie-purple);
  }

  .input-with-button {
    display: flex;
    gap: 0.5rem;
  }

  .input-with-button input {
    flex: 1;
  }

  .checkbox label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .checkbox input[type="checkbox"] {
    width: 1.1rem;
    height: 1.1rem;
    accent-color: var(--kapowie-purple);
  }

  button[type="submit"] {
    background: linear-gradient(135deg, var(--kapowie-purple) 0%, var(--kapowie-blue) 100%);
    color: var(--kapowie-text);
    border: none;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 0.5rem;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  button[type="submit"]:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(122, 44, 255, 0.4);
  }

  button[type="button"] {
    background: var(--kapowie-surface);
    color: var(--kapowie-text);
    border: 1px solid var(--kapowie-border);
    padding: 0.6rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  button[type="button"]:hover {
    border-color: var(--kapowie-blue);
  }

  .success {
    color: #2ee66b;
    font-size: 0.9rem;
  }

  .error {
    background: rgba(232, 59, 255, 0.1);
    color: #ff6b6b;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid #ff6b6b;
  }
</style>
