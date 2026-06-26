import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  manifest: {
    name: 'Kapowie — Stream Recorder',
    description: 'Record and re-stream live video streams in your browser',
    version: '0.1.0',
    permissions: [
      'storage',
      'downloads',
      'activeTab',
      'scripting',
      'declarativeNetRequest',
      'tabs',
      'webRequest',
      'offscreen',
    ],
    host_permissions: ['http://*/*', 'https://*/*'],
  },
});
