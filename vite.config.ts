import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { nip5aManifest } from '@napplet/vite-plugin';

// 标题栏版本号：与 MiniNostrApp 一致，由 `git describe` 生成。
// 非 git 环境（如解压的源码包）回退为 "dev"，与 App.tsx 的占位符逻辑一致。
function getAppVersion(): string {
  try {
    return execSync('git describe --tags --always --dirty', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  define: {
    __SITE_NAME__: JSON.stringify("mini-nostr-saf"),
    __APP_VERSION__: JSON.stringify(getAppVersion()),
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
