/**
 * Napplet environment detection.
 *
 * This project is the napplet.soy port of MiniNostrApp ("mini-nostr-saf").
 * It only ever runs inside the napplet sandbox, so napplet mode is always
 * on. There are no non-napplet fallbacks: raw WebSocket, fetch, localStorage
 * and window.nostr are forbidden surfaces in the sandbox and must not be
 * referenced anywhere in this build.
 */
export function isNapplet(): boolean {
  return true;
}
