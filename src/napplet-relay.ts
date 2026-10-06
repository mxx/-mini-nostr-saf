/**
 * WebSocket-compatible relay transport for the napplet sandbox.
 *
 * Hard boundary: napplet code must not use raw WebSocket. The app's relay
 * layer speaks Nostr wire frames (REQ / CLOSE / EVENT) and tracks per-relay
 * connection state, so this shim keeps that exact surface and routes the
 * frames through `@napplet/sdk`'s host-mediated `relay` domain:
 *
 * - `["REQ", subId, ...filters]`  -> `relaySubscribe(filters, onEvent, onEose, { relay: url })`
 * - `["CLOSE", subId]`            -> subscription `close()`
 * - `["EVENT", signed]`           -> `relayPublish(template)` (shell signs
 *                                    with the viewer's identity), then a
 *                                    synthesized `["OK", id, true, ""]`
 *
 * Incoming shell events are re-emitted as `["EVENT", subId, event]` /
 * `["EOSE", subId]` message frames so the app's existing parsers work
 * unchanged. `readyState` transitions to OPEN on the next microtask, like a
 * real socket whose handlers are assigned right after construction.
 */

import type { NostrEvent, NostrFilter, Subscription } from "@napplet/sdk";

export const NAPPLET_WS_CONNECTING = 0;
export const NAPPLET_WS_OPEN = 1;
export const NAPPLET_WS_CLOSING = 2;
export const NAPPLET_WS_CLOSED = 3;

type MessageHandler = ((ev: { data: string }) => void) | null;
type OpenHandler = ((ev: Event) => void) | null;
type CloseHandler = ((ev: { code: number; reason: string }) => void) | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export class NappletRelaySocket {
  static readonly CONNECTING = NAPPLET_WS_CONNECTING;
  static readonly OPEN = NAPPLET_WS_OPEN;
  static readonly CLOSING = NAPPLET_WS_CLOSING;
  static readonly CLOSED = NAPPLET_WS_CLOSED;

  readonly url: string;
  readyState: number = NAPPLET_WS_CONNECTING;
  onopen: OpenHandler = null;
  onmessage: MessageHandler = null;
  onclose: CloseHandler = null;
  onerror: OpenHandler = null;

  private subs = new Map<string, Subscription>();
  private closed = false;

  constructor(url: string) {
    this.url = url;
    // Let the caller assign handlers before we report OPEN, mirroring
    // the real WebSocket constructor's asynchronous open.
    queueMicrotask(() => {
      if (this.closed || this.readyState !== NAPPLET_WS_CONNECTING) return;
      this.readyState = NAPPLET_WS_OPEN;
      try {
        this.onopen?.(new Event("open"));
      } catch {
        // App handlers must never break the transport.
      }
    });
  }

  private emit(frame: unknown[]): void {
    if (this.closed) return;
    const handler = this.onmessage;
    if (!handler) return;
    try {
      handler({ data: JSON.stringify(frame) });
    } catch {
      // App handlers must never break the transport.
    }
  }

  private fail(code: number, reason: string): void {
    if (this.closed) return;
    this.closed = true;
    this.readyState = NAPPLET_WS_CLOSED;
    for (const sub of this.subs.values()) {
      try {
        sub.close();
      } catch {
        // ignore
      }
    }
    this.subs.clear();
    try {
      this.onclose?.({ code, reason });
    } catch {
      // ignore
    }
  }

  send(data: string): void {
    if (this.readyState !== NAPPLET_WS_OPEN) return;
    let frame: unknown;
    try {
      frame = JSON.parse(data);
    } catch {
      return;
    }
    if (!Array.isArray(frame) || typeof frame[0] !== "string") return;
    const [verb, arg, ...rest] = frame as [string, unknown, ...unknown[]];
    if (verb === "REQ" && typeof arg === "string") {
      void this.handleReq(arg, rest);
      return;
    }
    if (verb === "CLOSE" && typeof arg === "string") {
      const sub = this.subs.get(arg);
      if (sub) {
        try {
          sub.close();
        } catch {
          // ignore
        }
        this.subs.delete(arg);
      }
      return;
    }
    if (verb === "EVENT" && isRecord(arg)) {
      void this.handlePublish(arg);
    }
  }

  private async handleReq(subId: string, filters: unknown[]): Promise<void> {
    // Replace any previous subscription under the same id (NIP-01 semantics).
    const previous = this.subs.get(subId);
    if (previous) {
      try {
        previous.close();
      } catch {
        // ignore
      }
      this.subs.delete(subId);
    }
    try {
      const { relaySubscribe } = await import("@napplet/sdk");
      const typed = filters as NostrFilter | NostrFilter[];
      const sub = relaySubscribe(
        typed,
        (result) => {
          if (this.closed || !this.subs.has(subId)) return;
          this.emit(["EVENT", subId, result.event]);
        },
        () => {
          if (this.closed || !this.subs.has(subId)) return;
          this.emit(["EOSE", subId]);
        },
        { relay: this.url },
      );
      if (this.closed) {
        try {
          sub.close();
        } catch {
          // ignore
        }
        return;
      }
      this.subs.set(subId, sub);
    } catch {
      // The shell refused the subscription (unknown relay, policy, ...).
      // Report EOSE so the app stops waiting; per-relay status stays usable.
      this.emit(["EOSE", subId]);
    }
  }

  private async handlePublish(record: Record<string, unknown>): Promise<void> {
    // The shell signs with the viewer's identity; the app must not pre-sign.
    // Accept the app's signed-or-unsigned event and forward its template.
    const template = {
      kind: typeof record.kind === "number" ? record.kind : 1,
      created_at:
        typeof record.created_at === "number" ? record.created_at : Math.floor(Date.now() / 1000),
      tags: Array.isArray(record.tags) ? (record.tags as string[][]) : [],
      content: typeof record.content === "string" ? record.content : "",
    };
    try {
      const { relayPublish } = await import("@napplet/sdk");
      const published: NostrEvent = await relayPublish(template, { relay: true });
      // Synthesize the OK the app's publish tracker waits for. The published
      // id differs from any client-side pre-image; report the real one.
      this.emit(["OK", published.id, true, ""]);
    } catch {
      const fallbackId = typeof record.id === "string" ? record.id : "";
      this.emit(["OK", fallbackId, false, "publish rejected by host"]);
    }
  }

  close(): void {
    if (this.readyState === NAPPLET_WS_CLOSED) return;
    this.readyState = NAPPLET_WS_CLOSING;
    this.fail(1000, "closed by app");
  }
}

/** Drop-in replacement for `new WebSocket(url)` in napplet mode. */
export function createRelaySocket(url: string): NappletRelaySocket {
  return new NappletRelaySocket(url);
}
