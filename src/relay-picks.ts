/**
 * 每日推荐中继 API（lulin.org）：按日期种子从收集中继池随机抽 3 个，附 NIP-11 简介。
 *
 * Napplet 沙箱禁止 raw fetch；只读外部字节走 host 的 resource 域。
 * 抓取器可注入，便于测试；默认走 @napplet/sdk 的 resource.bytes。
 */

export const RELAY_PICKS_URL = "https://lulin.org/client/api/relay-picks.json";

/** 单次抓取超时：host 的 resource.bytes 可能悬挂（无拒绝、无解决），不能无限等。 */
export const RELAY_PICKS_TIMEOUT_MS = 12_000;

export type RelayPick = { url: string; name: string; description: string };
export type RelayPicks = { date: string; pool_size: number; picks: RelayPick[] };

export type BytesFetcher = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<Blob>;

/** 推荐 URL：?date= 避开 SW cache-first 缓存到的旧文件（每天换 URL 即换缓存键）。 */
export function relayPicksUrl(date: Date = new Date()): string {
  return `${RELAY_PICKS_URL}?date=${date.toISOString().slice(0, 10)}`;
}

export function isRelayPicks(value: unknown): value is RelayPicks {
  if (typeof value !== "object" || value === null) return false;
  const doc = value as Record<string, unknown>;
  return (
    typeof doc.date === "string" &&
    Array.isArray(doc.picks) &&
    doc.picks.every(
      (pick) =>
        typeof pick === "object" &&
        pick !== null &&
        typeof (pick as Record<string, unknown>).url === "string",
    )
  );
}

async function defaultBytesFetcher(
  url: string,
  init?: { signal?: AbortSignal },
): Promise<Blob> {
  const { resource } = await import("@napplet/sdk");
  return resource.bytes(url, init);
}

async function fetchBytesWithTimeout(
  fetcher: BytesFetcher,
  url: string,
  timeoutMs: number,
): Promise<Blob> {
  // 注意：不能只靠 AbortSignal——不遵守 signal 的 host 照样悬挂，
  // 必须用 Promise.race 硬超时，悬挂的 promise 丢弃即可。
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(new Error(`resource.bytes timeout after ${timeoutMs}ms: ${url}`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([fetcher(url, { signal: ctrl.signal }), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * 拉取今日推荐；若当日文件尚未生成则回退到无参 URL（昨日的）。
 * 保证：永不抛错（失败返回 null），永不悬挂（每次抓取有超时）。
 */
export async function fetchRelayPicks(
  fetcher: BytesFetcher = defaultBytesFetcher,
  timeoutMs: number = RELAY_PICKS_TIMEOUT_MS,
): Promise<RelayPicks | null> {
  for (const url of [relayPicksUrl(), RELAY_PICKS_URL]) {
    try {
      const blob = await fetchBytesWithTimeout(fetcher, url, timeoutMs);
      const doc: unknown = JSON.parse(await blob.text());
      if (isRelayPicks(doc)) return doc;
    } catch {
      // 超时、被 host 策略拦截、网络错误、JSON 非法都走这里：换下一个 URL 试。
    }
  }
  return null;
}
