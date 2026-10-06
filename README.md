## napplet soyLI workspace

Read [docs/napplet-space.md](docs/napplet-space.md) first for this project's CLI commands, installed skills, preview cleanup and host capabilities. Read [docs/napplet-visual-design.md](docs/napplet-visual-design.md) before styling the creation and its UI. This project and its adapted skills are already installed; do not re-scaffold or reinstall them. Use soyli dev and its printed URL for hosted preview, and stop your preview session after testing. Use the upstream guidance below with those tooling mappings.

# my-napplet

A small TypeScript starter for building a NIP-5D napplet with the published
`@napplet` packages.

Napplets are sandboxed iframe apps. The shell/runtime injects `window.napplet`
before app code runs; the app uses `@napplet/sdk` to call available NAP domains
such as outbox, identity, storage, resource, and notify.

## Start

```bash
soyli setup
soyli dev
```

Build and verify the production artifact:

```bash
pnpm verify
```

`soyli build` uses the pinned Vite plugin to produce one inlined `index.html`.
`soyli publish` signs the standalone NIP-5D manifest; its `x` is the HTML SHA-256.
Do not use the plugin's optional legacy manifest for publication. Read
`docs/napplet-manifest.md` for editable capabilities, discovery metadata and icons.

## Conformance Testing

Verify the napplet conforms to the NAP protocol before publishing. Two variants,
mirroring `vitest` vs `vitest --ui`:

```bash
pnpm test:conformance      # headless: build + check; non-zero exit on failure (CI)
pnpm test:conformance:ui   # live web runtime; re-runs on every source change
```

It loads the build into a real `sandbox="allow-scripts"` iframe and drives the
protocol with a reference shell. Boot, forbidden-global, and degradation checks
run for a local directory; manifest, wire, and lifecycle checks report `SKIP`
unless the invocation supplies the evidence they require.

Exacting requirements for a passing build:

- Build to a **single self-contained `index.html`** (`@napplet/vite-plugin`
  `artifactMode: 'single-file'` in `vite.config.ts`). NIP-5D loads a napplet via
  `iframe.srcdoc` with
  `sandbox="allow-scripts"` and no `allow-same-origin` (an opaque origin) — there
  is no served origin from which to fetch an external `<script src>`, so the JS
  must be inlined into the one file. External-asset builds do not boot.
- Do not import `@napplet/shim` from app code. The runtime injects
  `window.napplet`; conformance verifies boot and emitted envelopes through the
  reference runtime.
- Emit only well-formed envelopes via `@napplet/sdk`. Declare only hard NAP
  requirements in `vite.config.ts`; guard optional domains with
  `window.napplet?.domain` checks and a graceful fallback.
- Do not reference `window.nostr` or use direct `fetch`/`WebSocket`/`localStorage`.

The executable `index.html` does **not** carry its own manifest hash. Before
execution, the runtime verifies the signed manifest and the HTML SHA-256 against
its `x` tag. Earlier manifests remain readable through the legacy validator.

This generic starter declares no hard domains. Each demo action is optional and
disabled when its injected domain is absent. Add `requires` only after replacing
the demo with a core task that genuinely cannot run without that domain.

## Included

- Vanilla Vite + TypeScript napplet app.
- Typed `@napplet/sdk` helpers over the runtime-injected `window.napplet`
  namespace.
- Build-time `@napplet/vite-plugin` wiring for the single-file artifact and
  optional local manifest generation.
- Default app-chrome text selection disabled in `src/styles.css`, with
  opt-in controls for copyable or editable regions.
- Context documents for NIP-5D, shell boundaries, package surfaces, and authoring
  patterns.
- Guidance for handling missing NAP interfaces or numbered wire formats without
  submitting unnecessary protocol PRs.
- A responsive capability demo with a replaceable local palette and opt-in host
  theming. Choose the creation's own scene/content and UI direction using
  `docs/napplet-visual-design.md`; the demo is not a required visual style.
- Installed soyLI-adapted agent skills; tooling guidance in docs/napplet-space.md.

## Authoring Context

Read these before changing protocol-facing behavior:

- `docs/nip-5d.md`
- `docs/boundaries.md`
- `docs/design-patterns.md`
- `docs/package-surfaces.md`
- `docs/new-nap-proposals.md`
- `docs/authoring-checklist.md`

The living NIP-5D source is referenced from `docs/nip-5d.md`; this template does
not treat its local notes as normative protocol text.

For agent-driven work, use the installed `napplet-make` skill. Read
`docs/napplet-space.md` first; `soyli skills update` refreshes managed guidance
while preserving your edits. Living NIP-5D and NAP documents remain protocol truth.

## Text Selection

The starter disables accidental text selection by default. To change the whole
napplet, set `--napplet-text-selection: text` in `src/styles.css`. To opt in one
region, add `data-napplet-select="text"` or `data-napplet-select="all"`.

## Package Scripts

```bash
pnpm dev          # local Vite dev server
pnpm type-check   # TypeScript strict-mode check
pnpm build        # Vite production build
pnpm preview      # preview dist/
pnpm test:guidance       # stale-guidance and optional-domain regression checks
pnpm verify       # guidance test + type-check + build
pnpm test:conformance     # headless NAP conformance (build + check, CI exit code)
pnpm test:conformance:ui  # live conformance web runtime, re-runs on change
```
