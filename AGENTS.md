## napplet soyLI workspace

Read [docs/napplet-space.md](docs/napplet-space.md) first for this project's CLI commands, installed skills, preview cleanup and host capabilities. Read [docs/napplet-visual-design.md](docs/napplet-visual-design.md) before styling the creation and its UI. This project and its adapted skills are already installed; do not re-scaffold or reinstall them. Use soyli dev and its printed URL for hosted preview, and stop your preview session after testing. Use the upstream guidance below with those tooling mappings.

# Napplet Boilerplate Agent Guide

This repository is a starter for one NIP-5D napplet. Keep it small,
framework-light, and centered on the napplet side of the shell boundary.

## Before Editing

1. Read `docs/napplet-space.md` and follow the already installed `napplet-make`
   skill. Do not re-scaffold or reinstall upstream skills in this project.
2. Read `docs/context-map.md`.
3. Read the boundary document for the surface you are changing:
   - `docs/boundaries.md`
   - `docs/design-patterns.md`
   - `docs/package-surfaces.md`
4. If changing protocol assumptions, verify against the living NIP-5D reference
   in `docs/nip-5d.md`.
5. If the change appears to need a new NAP name, message domain, or numbered
   wire format, read `docs/new-nap-proposals.md` before writing code.

## Hard Boundaries

- Do not add shell implementation code to this template.
- Do not access signer keys, relay pools, cookies, service workers, or host DOM
  directly from napplet code.
- Do not use `localStorage` or `sessionStorage` for durable app state. Use
  `@napplet/sdk` storage helpers.
- Do not use direct `fetch`, `WebSocket`, or `EventSource`. NAP-CONNECT (the
  direct-network grant model) is currently deferred on the NAPs track, so there
  is no active direct-network surface. Use `resource.bytes()` for read-only
  external bytes.
- Do not import `@napplet/shim` from napplet code. The shell/runtime injects
  `window.napplet`; app calls use `@napplet/sdk`, while direct domain properties
  are only optional-domain availability checks.
- Use OUTBOX for normal Nostr reads and publishes. Use RELAY only when a feature
  names an explicit relay-local escape hatch.
- Add a domain to local `requires` (published as `R`) only when the napplet cannot perform its
  core task without it. Guard optional domains and provide a graceful fallback.
- Do not invent app-local NAP names, numbers, or JSON envelope domains. Open a
  proposal PR to `napplet/naps` only after the guardrails in
  `docs/new-nap-proposals.md` are satisfied.

## Visual direction and layout

Read docs/napplet-visual-design.md and the installed napplet-ui skill before
styling. Choose a visual direction for both the main experience and surrounding
UI/HUD; record it in the project's brief. Replace the capability demo's styling
and example size settings to fit the task. Keep existing art direction on a port
or contribution unless redesign was requested.

The frame can resize live. Check 200×160, 320×560, 900×600 and full screen, plus
touch portrait/landscape. If a minimum is genuinely needed, show a useful notice
below it. Controls must stay readable and reachable.

App-owned colors are the default: FOLLOW_HOST_THEME is false in src/main.ts.
Host matching or a scoped hybrid is an explicit design choice. Verify the chosen
policy in both host themes and without the optional theme domain. Keep gameplay
and semantic colors independent from host branding unless intentionally designed
otherwise. Theme data never implies a mandatory shell palette or density.

## Verification

Run these before claiming completion:

```bash
pnpm type-check
pnpm build
pnpm test:guidance
pnpm test:conformance
```

`test:conformance` loads the built napplet in a real `allow-scripts` iframe.
Read its report: manifest, wire, and lifecycle checks skip when their evidence
is not supplied. Use `pnpm test:conformance:ui` for the live runtime.

Use `soyli dev` and its printed URL for shell/manual testing; stop it afterward. A passing browser smoke test should
cover iframe load, injected-domain display, and at least one user-triggered SDK
operation in the target shell. Also verify that missing optional domains disable
only their enhancements without crashing the napplet.
