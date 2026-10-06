import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { preloadNappletStorage } from "./napplet-storage";
import "./theme.css";

const rootEl = document.querySelector<HTMLElement>("[data-generated-space-root]");
if (!rootEl) {
  throw new Error("missing generated space root element");
}

// Napplet durable state lives in the SDK storage domain (never localStorage).
// Preload the app's known keys before first render so synchronous readers hit.
const STORAGE_KEYS = [
  "nostr-min-nip46-session-v1",
  "nostr-min-relays-v1",
  "nostr-min-profiles-v1",
  "nostr-min-follows-v1",
  "nostr-min-follows-local-v1",
  "nostr-min-events-v1",
  "nostr-min-view-mode-v1",
  "nostr-min-incognito-v1",
  "nostr-min-filters-v1",
  "nostr-min-longforms-v1",
];

preloadNappletStorage(STORAGE_KEYS).finally(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <div className="hatch-space-root" data-hatch-space-root>
        <App />
      </div>
    </StrictMode>,
  );
});
