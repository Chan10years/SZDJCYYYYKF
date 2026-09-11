export type AiBudgetOperation = "challenge" | "report";

type BudgetBucket = {
  windowStartedAt: number;
  total: number;
  perKey: Map<string, number>;
};

const WINDOW_MS = 60_000;
const MAX_KEYS = 256;
// One ordinary user sends one Challenge request per round. Keep the process
// guard finite while allowing a 60-user classroom burst behind one NAT.
const CLASSROOM_CHALLENGE_REQUESTS = 60 * 3;
const CLASSROOM_REPORT_REQUESTS = 60;
const LIMITS: Record<AiBudgetOperation, { perKey: number; total: number }> = {
  challenge: {
    perKey: CLASSROOM_CHALLENGE_REQUESTS,
    total: CLASSROOM_CHALLENGE_REQUESTS,
  },
  report: {
    perKey: CLASSROOM_REPORT_REQUESTS,
    total: CLASSROOM_REPORT_REQUESTS,
  },
};

const buckets: Record<AiBudgetOperation, BudgetBucket> = {
  challenge: createBucket(),
  report: createBucket(),
};

function createBucket(): BudgetBucket {
  return { windowStartedAt: Date.now(), total: 0, perKey: new Map() };
}

/** Test-only reset hook; production callers never need to reset the window. */
export function resetAiBudgetForTests(): void {
  buckets.challenge = createBucket();
  buckets.report = createBucket();
}

/**
 * 进程内、固定窗口预算。Challenge/Report 允许一整轮 60 人课堂 burst，
 * 仍保留单实例固定上限；它不冒充跨实例公网限流。
 */
export function consumeAiBudget(
  operation: AiBudgetOperation,
  key: string,
): boolean {
  const now = Date.now();
  const bucket = buckets[operation];
  const limits = LIMITS[operation];

  if (now - bucket.windowStartedAt >= WINDOW_MS) {
    buckets[operation] = createBucket();
    return consumeAiBudget(operation, key);
  }

  const normalizedKey = key.trim().slice(0, 128) || "anonymous";
  const currentForKey = bucket.perKey.get(normalizedKey) ?? 0;
  if (bucket.total >= limits.total || currentForKey >= limits.perKey) {
    return false;
  }

  if (!bucket.perKey.has(normalizedKey) && bucket.perKey.size >= MAX_KEYS) {
    const oldestKey = bucket.perKey.keys().next().value;
    if (typeof oldestKey === "string") {
      bucket.perKey.delete(oldestKey);
    }
  }

  bucket.total += 1;
  bucket.perKey.set(normalizedKey, currentForKey + 1);
  return true;
}

/** 优先使用反向代理传入的第一个客户端地址，避免把整串 header 当作 key。 */
export function getAiRequestKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",", 1)[0]?.trim();
  if (firstForwarded) {
    return firstForwarded;
  }
  return request.headers.get("x-real-ip")?.trim() || "anonymous";
}
