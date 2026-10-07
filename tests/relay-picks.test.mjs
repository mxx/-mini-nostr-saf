/**
 * 回归测试：每日推荐抓取永不悬挂、永不抛错。
 *
 * 背景（2026-10-07 用户报障）：napplet 里“每日推荐”长期显示“正在获取今日推荐…”、
 * 不断刷新。根因是 fetchRelayPicks 直接 await host 的 resource.bytes()：
 * host 悬挂（不解决也不拒绝）时 loading 状态永远卡住；SDK import 写在 try
 * 之外，抛错会导致未处理的 rejection，同样卡住 loading。
 * 修复：抓取器可注入 + 每次抓取硬超时 + 全链路 try/catch + UI 错误态与重试。
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function loadRelayPicks() {
  const source = await readFile(join(root, "src/relay-picks.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, {
    module,
    exports: module.exports,
    AbortController,
    setTimeout,
    clearTimeout,
    JSON,
    URL,
  });
  return module.exports;
}

const validDoc = {
  date: "2026-10-07",
  pool_size: 941,
  picks: [{ url: "wss://example.com", name: "example", description: "" }],
};

const blobOf = (text) =>
  new Blob([text], { type: "application/json" });

/** 断言被测 promise 在时限内解决，否则判悬挂失败。 */
async function mustSettle(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label}: hung for ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

test("fetchRelayPicks 从带日期的 URL 取到合法文档即返回", async () => {
  const { fetchRelayPicks } = await loadRelayPicks();
  const seen = [];
  const fetcher = async (url) => {
    seen.push(url);
    return blobOf(JSON.stringify(validDoc));
  };
  const result = await mustSettle(fetchRelayPicks(fetcher, 1000), 5000, "valid");
  assert.deepEqual(result, validDoc);
  assert.ok(seen[0].includes("?date="), "优先尝试带日期的 URL");
});

test("fetchRelayPicks 日期 URL 失败时回退到无参 URL", async () => {
  const { fetchRelayPicks, RELAY_PICKS_URL } = await loadRelayPicks();
  const seen = [];
  const fetcher = async (url) => {
    seen.push(url);
    if (url.includes("?date=")) {
      throw Object.assign(new Error("blocked"), { code: "blocked-by-policy" });
    }
    return blobOf(JSON.stringify(validDoc));
  };
  const result = await mustSettle(fetchRelayPicks(fetcher, 1000), 5000, "fallback");
  assert.deepEqual(result, validDoc);
  assert.equal(seen[1], RELAY_PICKS_URL);
});

test("fetchRelayPicks 抓取器悬挂时返回 null 而不是卡住", async () => {
  const { fetchRelayPicks } = await loadRelayPicks();
  // 永不解决、忽略 signal：模拟 host 的 resource.bytes 悬挂。
  const hanging = () => new Promise(() => {});
  const result = await mustSettle(fetchRelayPicks(hanging, 100), 5000, "hang");
  assert.equal(result, null);
});

test("fetchRelayPicks 抓取器持续抛错时返回 null 而不是抛错", async () => {
  const { fetchRelayPicks } = await loadRelayPicks();
  const failing = async () => {
    throw new Error("network-error");
  };
  const result = await mustSettle(fetchRelayPicks(failing, 200), 5000, "reject");
  assert.equal(result, null);
});

test("fetchRelayPicks 拿到非法 JSON 时返回 null", async () => {
  const { fetchRelayPicks } = await loadRelayPicks();
  const bad = async () => blobOf("not json{{{");
  const result = await mustSettle(fetchRelayPicks(bad, 200), 5000, "bad json");
  assert.equal(result, null);
});

test("isRelayPicks 校验文档形状", async () => {
  const { isRelayPicks } = await loadRelayPicks();
  assert.equal(isRelayPicks(validDoc), true);
  assert.equal(isRelayPicks(null), false);
  assert.equal(isRelayPicks({ date: "x", picks: [{ name: "缺 url" }] }), false);
  assert.equal(isRelayPicks({ date: "x", picks: "不是数组" }), false);
});
