<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import StreamCapture from './components/StreamCapture.svelte';
  import RecordingManager from './components/RecordingManager.svelte';
  import ReStreamUI from './components/ReStreamUI.svelte';
  import Settings from './components/Settings.svelte';
  import { currentPage } from './stores/app';

  let pages = ['capture', 'recordings', 'restream', 'settings'];

  function navigate(page: string) {
    currentPage.set(page);
  }
</script>

<div class="app">
  <header class="app-header">
    <h1>Kapowie</h1>
    <nav class="nav-tabs">
      {#each pages as page}
        <button
          class:active={$currentPage === page}
          on:click={() => navigate(page)}
        >
          {page.charAt(0).toUpperCase() + page.slice(1)}
        </button>
      {/each}
    </nav>
  </header>

  <main class="app-content">
    {#if $currentPage === 'capture'}
      <StreamCapture />
    {:else if $currentPage === 'recordings'}
      <RecordingManager />
    {:else if $currentPage === 'restream'}
      <ReStreamUI />
    {:else if $currentPage === 'settings'}
      <Settings />
    {/if}
  </main>

  <footer class="app-footer">
    <span>Kapowie v0.1.0 &mdash; Stream Recorder &amp; Re-streamer</span>
  </footer>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .app-header {
    background: #1a1a2e;
    color: #eee;
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #e94560;
  }

  .app-header h1 {
    margin: 0;
    font-size: 1.4rem;
    color: #e94560;
  }

  .nav-tabs {
    display: flex;
    gap: 0.5rem;
  }

  .nav-tabs button {
    background: transparent;
    border: 1px solid #444;
    color: #ccc;
    padding: 0.4rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .nav-tabs button:hover {
    border-color: #e94560;
    color: #fff;
  }

  .nav-tabs button.active {
    background: #e94560;
    border-color: #e94560;
    color: #fff;
  }

  .app-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    background: #16213e;
    color: #eee;
  }

  .app-footer {
    background: #1a1a2e;
    color: #888;
    padding: 0.5rem 1.5rem;
    font-size: 0.8rem;
    text-align: center;
    border-top: 1px solid #333;
  }
</style>
