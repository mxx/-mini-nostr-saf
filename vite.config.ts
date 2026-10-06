import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nip5aManifest } from '@napplet/vite-plugin';

export default defineConfig({
  define: {
    __SITE_NAME__: JSON.stringify("mini-nostr-saf"),
    __APP_VERSION__: JSON.stringify("0.1.0-soy"),
  },
  build: {
    // Vite's module-preload polyfill calls `fetch`; one inlined entry needs no
    // preload graph, and NIP-5D napplet code has no ambient network authority.
    modulePreload: { polyfill: false },
    // Single-file artifact: inline every static asset (favicon, fonts, ...)
    // so the build emits exactly one dist/index.html.
    assetsInlineLimit: 100 * 1024 * 1024,
    chunkSizeWarningLimit: 100 * 1024 * 1024,
  },
  plugins: [
    react(),
    // Produce one self-contained `/index.html` for NIP-5D `srcdoc` loading,
    // soyLI publishes its raw HTML hash using standalone NIP-5D manifests.
    nip5aManifest({
      nappletType: 'mini-nostr-saf',
      artifactMode: 'single-file',
    }),
  ],
});
