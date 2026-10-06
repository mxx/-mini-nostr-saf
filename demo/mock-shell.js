/**
 * Demo mock of `window.napplet` for visual preview (NOT part of the napplet).
 * Implements just enough of the shell bridge for read-only browsing:
 * - relay.subscribe -> real WebSocket to the requested relay
 * - storage -> localStorage-backed async
 * - resource.bytes -> fetch -> blob
 * - identity/publish -> disabled (demo is read-only)
 */
(function () {
  function openRelaySubscription(filters, onEvent, onEose, options) {
    var url = (options && options.relay) || "wss://relay.damus.io";
    var subId = "demo-" + Math.random().toString(36).slice(2, 10);
    var ws;
    var closed = false;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      setTimeout(onEose, 0);
      return { close: function () {} };
    }
    var filterList = Array.isArray(filters) ? filters : [filters];
    ws.onopen = function () {
      if (closed) { ws.close(); return; }
      ws.send(JSON.stringify(["REQ", subId].concat(filterList)));
    };
    ws.onmessage = function (ev) {
      if (closed) return;
      try {
        var msg = JSON.parse(ev.data);
        if (msg[0] === "EVENT" && msg[1] === subId && msg[2]) onEvent({ event: msg[2] });
        else if (msg[0] === "EOSE" && msg[1] === subId) onEose();
        else if (msg[0] === "CLOSED" && msg[1] === subId) onEose();
      } catch (e) { /* ignore malformed frames */ }
    };
    var done = function () { if (!closed) { closed = true; try { onEose(); } catch (e) {} emitSamples(); } };
    ws.onerror = done;
    ws.onclose = done;
    // Demo fallback: the sandbox blocks raw WebSocket, so synthesize a few
    // posts so the feed layout can be previewed. Emitted when the socket
    // fails, or at 2.5s if the socket is still hanging.
    var samplesEmitted = false;
    function emitSamples() {
      if (samplesEmitted) return;
      samplesEmitted = true;
      var now = Math.floor(Date.now() / 1000);
      var samples = [
        { kind: 1, content: "mini-nostr-saf 跑起来了 🌿 这是从 napplet 沙箱里发出的第一条演示帖子。", tags: [] },
        { kind: 1, content: "Nostr 丛林深处，safari 刚刚开始。", tags: [["t", "safari"]] },
        { kind: 1, content: "host 代签名，私钥永不进应用——这就是 saf 的含义。", tags: [] },
      ];
      samples.forEach(function (s, i) {
        onEvent({ event: {
          id: "a".repeat(63) + String(i),
          pubkey: "75e0f2d4ca0f810b8813f7b8edbec679d5a49ccdeb6810832bf38b21eba4a431",
          created_at: now - i * 97,
          kind: s.kind, tags: s.tags, content: s.content, sig: "b".repeat(64),
        } });
      });
      try { onEose(); } catch (e) {}
    }
    setTimeout(function () {
      if (!closed) emitSamples();
    }, 2500);
    // Safety: some relays never send EOSE; don't leave the UI spinning forever.
    setTimeout(function () {
      if (!closed) { try { onEose(); } catch (e) {} }
    }, 20000);
    return {
      close: function () {
        if (closed) return;
        closed = true;
        try { ws.send(JSON.stringify(["CLOSE", subId])); } catch (e) {}
        try { ws.close(); } catch (e) {}
      },
    };
  }

  window.napplet = {
    relay: {
      subscribe: openRelaySubscription,
      query: function () { return Promise.reject(new Error("demo: query disabled")); },
      publish: function () { return Promise.reject(new Error("demo: publish disabled")); },
    },
    storage: {
      getItem: function (k) { return Promise.resolve(window.localStorage.getItem("saf-demo:" + k)); },
      setItem: function (k, v) { window.localStorage.setItem("saf-demo:" + k, v); return Promise.resolve(); },
      removeItem: function (k) { window.localStorage.removeItem("saf-demo:" + k); return Promise.resolve(); },
      keys: function () { return Promise.resolve([]); },
    },
    identity: {
      getPublicKey: function () { return Promise.reject(new Error("demo: no identity")); },
    },
    resource: {
      bytes: function (url) { return window.fetch(url).then(function (r) { return r.blob(); }); },
    },
  };
})();
