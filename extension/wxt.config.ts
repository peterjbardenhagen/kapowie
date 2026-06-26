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
    host_permissions: ['http://*/*', 'https:///*'],
    background: {
      service_worker: 'background.js',
      type: 'module',
    },
    action: {
      default_popup: 'popup.html',
      default_title: 'Kapowie',
    },
    content_scripts: [
      {
        matches: ['http://*/*', 'https:///*'],
        js: ['content.js'],
      },
    ],
    web_accessible_resources: [
      {
        resources: ['offscreen.html'],
        matches: [],
      },
    ],
  },
});
