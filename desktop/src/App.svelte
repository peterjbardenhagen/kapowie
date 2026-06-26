<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import StreamCapture from './components/StreamCapture.svelte';
  import RecordingManager from './components/RecordingManager.svelte';
  import ReStreamUI from './components/ReStreamUI.svelte';
  import Settings from './components/Settings.svelte';
  import { currentPage } from './stores/app';
  import logoMark from '../../shared/assets/kapowie-mark.svg';

  let pages = ['capture', 'recordings', 'restream', 'settings'];

  function navigate(page: string) {
    currentPage.set(page);
  }
</script>

<div class="app">
  <header class="app-header">
    <div class="brand">
      <img class="brand-mark" src={logoMark} alt="Kapowie" />
      <div class="brand-copy">
        <h1>Kapowie</h1>
        <p>Capture. Re-stream. Anywhere.</p>
      </div>
    </div>
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
    font-family: Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }

  .app-header {
    background:
      radial-gradient(circle at top left, rgba(122, 44, 255, 0.2), transparent 35%),
      linear-gradient(135deg, #070b2a 0%, #10183e 55%, #0b1030 100%);
    color: #f6f7fb;
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(93, 123, 255, 0.28);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    min-width: 0;
  }

  .brand-mark {
    width: 3rem;
    height: 3rem;
    flex: 0 0 auto;
    filter: drop-shadow(0 0 10px rgba(122, 44, 255, 0.35));
  }

  .brand-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .app-header h1 {
    margin: 0;
    font-size: 1.25rem;
    color: #f6f7fb;
    letter-spacing: 0.01em;
  }

  .brand-copy p {
    margin: 0;
    font-size: 0.78rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #a0a8c0;
  }

  .nav-tabs {
    display: flex;
    gap: 0.5rem;
  }

  .nav-tabs button {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(160, 168, 192, 0.2);
    color: #c8d0e8;
    padding: 0.4rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .nav-tabs button:hover {
    border-color: rgba(69, 176, 255, 0.9);
    color: #fff;
  }

  .nav-tabs button.active {
    background: linear-gradient(135deg, #7a2cff 0%, #45b0ff 100%);
    border-color: transparent;
    color: #fff;
  }

  .app-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    background:
      radial-gradient(circle at top right, rgba(122, 44, 255, 0.16), transparent 25%),
      linear-gradient(180deg, #070b2a 0%, #10183e 100%);
    color: #f6f7fb;
  }

  .app-footer {
    background: rgba(7, 11, 42, 0.92);
    color: #8d96b8;
    padding: 0.5rem 1.5rem;
    font-size: 0.8rem;
    text-align: center;
    border-top: 1px solid rgba(160, 168, 192, 0.12);
  }
</style>
