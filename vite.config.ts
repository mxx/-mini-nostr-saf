import { defineConfig } from 'vite';
import { nip5aManifest } from '@napplet/vite-plugin';

export default defineConfig({
  build: {
    // Vite's module-preload polyfill calls `fetch`; one inlined entry needs no
    // preload graph, and NIP-5D napplet code has no ambient network authority.
    modulePreload: { polyfill: false },
  },
  plugins: [
    // Produce one self-contained `/index.html` for NIP-5D `srcdoc` loading,
    // soyLI publishes its raw HTML hash using standalone NIP-5D manifests.
    nip5aManifest({
      nappletType: 'my-napplet',
      artifactMode: 'single-file',
    }),
  ],
});
