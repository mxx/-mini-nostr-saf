---
name: napplet-build
description: Implement a napplet-design spec in an existing soyLI project, preserving its build and host boundaries. Use for application code, backend modules, tests, build checks and hosted preview. Pair with napplet-ui and napplet-sdk.
---

# Building a Napplet

Implements a `napplet-design` spec. A napplet is one self-contained `/index.html` loaded into a `sandbox="allow-scripts"` iframe; all host access is proxied over postMessage per NIP-5D (<https://github.com/nostr-protocol/nips/pull/2303>) and the NAPs (<https://github.com/napplet/naps>). Never invent wire surface; flag gaps. Before writing any markup or CSS, load `napplet-ui`; while calling shell capabilities, use `napplet-sdk`; for cross-napplet features, `napplet-interop`.

## Pre-code gate: sandbox authority

Rewrite the plan before coding if it needs any of these in napplet code: `fetch`, `XMLHttpRequest`, `WebSocket`, `localStorage`, `sessionStorage`, IndexedDB, `document.cookie`, `window.nostr`, relay pools, signing, external `<script src>` / `<link href>` / `<img src>` / `<audio|video src>` / CSS `url(https://…)` / dynamic `import("https://…")`, or any side file the `srcdoc` iframe would have to fetch. Bytes are bundled at build time or requested through `resource`; state goes through `storage`; Nostr goes through `outbox` / `common` / `lists` / `count` / `dm` (or a documented `relay` escape hatch); URLs open through `link`. If a dependency needs direct network or storage authority at runtime, stop and flag it instead of shipping.

## Step 1 — Use the existing soyLI project

Read docs/napplet-space.md for the installed tooling contract. This project is
already scaffolded and its skills are installed. Do not run upstream create/init,
reinstall skills or overwrite its package/lock/build configuration.
For a fresh checkout, run soyli setup. Use soyli build and soyli dev for the
hosted app; use soyli run <script> for project checks. Preserve the pinned package
manager and single-file build. Add scripts and source modules as the app needs.

## Step 2 — Project-specific edit points

| File | Edit |
| --- | --- |
| `napplet.json` | Portable metadata, backend provider/boards/modules and capture settings. Use docs/napplet-space.md; keep identity selection and private state outside Git. |
| `vite.config.ts` | Hard `requires: [...]` and optional config schema; keep `artifactMode: 'single-file'` and the `nappletType` fallback. Put published archetypes, intents and optional domains in `napplet.json`. |
| `index.html` | Keep `<title>`, `<meta viewport>`, `#app` root. **Delete the starter `masthead` / `eyebrow` / `<h1>`** and the demo panels; add only the product's markup (`napplet-ui` Rule 1) |
| `src/styles.css` | Replace demo styling with the project visual direction from `napplet-ui`; keep responsive layout and comfortable controls |
| `src/main.ts` | Product behavior; SDK-first calls; keep `domain-availability.ts`'s `runtimeHasDomain` pattern for optional-domain gating |
| `tests/guidance.test.mjs` | The template's own guard runs under `pnpm verify`. It encodes *demo* expectations (starter control ids, no `requires:` in `vite.config.ts`, the `.codex/skills/README.md` pointer). When you replace the demo, update those product-specific lines to your product — keep the script, the forbidden-surface scans, and the OUTBOX-first assertions |
| `README.md`, `docs/*` | Product usage, NAP boundaries, verification notes |
| `src/**` | Split game, rendering, UI and networking code into useful modules; retain SDK boundaries |
| `backend/**` | Tracked handler, manifest and schemas; follow soy-backends |
| `tests/**` | Game rules, hosted multiplayer scenarios and responsive checks |

`package.json`: rename the package; add dependencies only when the feature truly needs them, and prove they carry no dormant network/storage paths into the bundle.

## Step 3 — Manifest configuration

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { nip5aManifest } from '@napplet/vite-plugin';

export default defineConfig({
  build: { modulePreload: { polyfill: false } },
  plugins: [
    nip5aManifest({
      nappletType: 'my-napplet',        // build-local fallback; soyLI publication metadata comes from napplet.json
      artifactMode: 'single-file',      // fold assets, keep inline scripts, one index.html
      requires: ['outbox', 'storage'],  // hard requirements only, bare domain names
      // archetypes: [{ slug: 'note', convention: 'napplet:note/open' }],  // see napplet-interop
    }),
  ],
});
```

soyLI publishes the HTML SHA-256 in the standalone NIP-5D `x` tag. Keep the existing Vite single-file build; do not set `VITE_DEV_PRIVKEY_HEX` or publish its optional legacy manifest. See docs/napplet-manifest.md for description, required/optional domains, archetypes, intents and icons.

## Step 4 — Implement

1. **Shell first, then features.** Lay out `index.html` + `styles.css` per the visual brief and `napplet-ui`: project-specific scene/content and UI tokens, responsive behavior, chosen theme policy and usable states. Check it at `200×160` and `2400×1200` before wiring data.
2. **Calls are SDK-first.** `import { outbox, storage, identity, … } from '@napplet/sdk'`; `window.napplet?.domain` only decides whether an optional feature renders. Exact signatures: `napplet-sdk` and the installed `@napplet/sdk` types.
3. **Boundaries from the spec.** Social reads/publishes through `outbox`; social actions through `common` / `lists` / `count` / `dm`; `relay` only where the spec names the escape hatch, with a code comment stating it.
4. **Teardown.** Close every subscription and key binding; revoke object URLs.
5. **States.** Signed-out (`identity.getPublicKey()` returns `""`), optional domain absent, publish failure (`result.ok === false`), resource rejection `code` — each renders useful feedback and a recovery action, never an unexplained blank frame.

## Step 5 — Validate the generated project

```bash
pnpm verify              # guidance test + type-check + single-file build
pnpm test:conformance    # real Chromium + reference shell against ./dist
```

Then the `napplet-ui` four-frame check and the `napplet-test` boundary audit. For a retrofit, add equivalent scripts and run the same commands.

## Step 6 — Verify in the soyLI host

Use soyli dev and its printed URL. Stop the session you started afterward.
Run soyli check against the final build and inspect captured screenshots/clips.
For dynamic backends or multiplayer, follow the scenario and identity fixtures in
docs/napplet-dynamic-backends.md and docs/napplet-backend.md. A startup check or
compiler success does not verify game rules, shared state or the public provider.

Report commands, passed assertions, skips and blockers separately. Record whether
the result is verified locally, published, backend-deployed and verified publicly.
If blocked, preserve the build, selected identity and real permissions; provide
the exact error, reproduction and remaining command instead of bypassing checks.

## Common pitfalls

- Shipping untouched demo styling or recoloring an authored scene through an inherited theme handler — see `napplet-ui`.
- Only checking one desktop width — the napplet is resized live; check four frames.
- Recreating the boilerplate by hand, or importing `@napplet/shim` in napplet code — the runtime injects `window.napplet`.
- Treating open NAP proposals as shipped APIs, or adding `shell.ready()` / capability probes — not in the packages.
- `relay` as the default data layer; hand-built social events instead of `common` / `lists`.
- `localStorage`, `fetch`, `<img src=https://…>`, `WebSocket`, `window.nostr` — none exist in the sandbox.
- External `<script src>` in the artifact — JS must be inline; `artifactMode: 'single-file'` handles it.
- Trusting upstream `Content-Type` for resource bytes — the shell delivers a byte-sniffed `mime`.

## soyLI manifest metadata

Before publication or changing capabilities/discovery, read docs/napplet-manifest.md. Save metadata in napplet.json; the publisher creates the signed event. Advertise only implemented intents and optional integrations, and verify their absent-domain fallbacks.
