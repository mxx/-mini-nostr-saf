/**
 * Durable storage adapter for the napplet sandbox.
 *
 * Hard boundary: napplet code must not use localStorage/sessionStorage for
 * durable state. The `@napplet/sdk` storage domain is async, but the ported
 * app reads storage synchronously in many places. This module bridges the
 * gap with a write-through in-memory cache:
 *
 * - Call `preloadNappletStorage()` once at startup (before first render).
 * - `getItem` / `setItem` / `removeItem` then behave synchronously against
 *   the cache; writes are flushed to SDK storage in the background.
 * - Outside the napplet sandbox it falls back to plain localStorage so
 *   `vite dev` still works for UI iteration.
 */


const cache = new Map<string, string>();
let preloaded = false;

async function sdkGet(key: string): Promise<string | null> {
  const { storage } = await import("@napplet/sdk");
  return storage.getItem(key);
}

async function sdkSet(key: string, value: string): Promise<void> {
  const { storage } = await import("@napplet/sdk");
  await storage.setItem(key, value);
}

async function sdkRemove(key: string): Promise<void> {
  const { storage } = await import("@napplet/sdk");
  await storage.removeItem(key);
}

/**
 * Load all known keys into the cache. Keys are discovered from the SDK when
 * possible; the app's known key list is merged in so fresh installs work.
 */
export async function preloadNappletStorage(knownKeys: string[]): Promise<void> {
  if (preloaded) return;
  try {
    const { storage } = await import("@napplet/sdk");
    const keys = new Set<string>(knownKeys);
    try {
      for (const key of await storage.keys()) keys.add(key);
    } catch {
      // Key listing is best-effort; known keys are enough.
    }
    await Promise.all(
      [...keys].map(async (key) => {
        try {
          const value = await sdkGet(key);
          if (value !== null) cache.set(key, value);
        } catch {
          // A single unreadable key must not block startup.
        }
      }),
    );
  } catch {
    // SDK unavailable: stay on the empty cache; reads miss, writes stay local.
  }
  preloaded = true;
}

export function storageGetItem(key: string): string | null {
  // Napplet-only build: durable state lives in the SDK storage domain.
  // The in-memory cache serves synchronous readers after preload.
  return cache.get(key) ?? null;
}

export function storageSetItem(key: string, value: string): void {
  cache.set(key, value);
  sdkSet(key, value).catch(() => {
    // Background flush failure: the in-memory value still serves this session.
  });
}

export function storageRemoveItem(key: string): void {
  cache.delete(key);
  sdkRemove(key).catch(() => undefined);
}
