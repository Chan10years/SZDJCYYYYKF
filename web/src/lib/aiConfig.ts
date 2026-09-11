const MAX_AI_TIMEOUT_MS = 15_000;

/** 读取服务端 timeout；无效环境变量回到明确的产品默认值。 */
export function readAiTimeoutMs(
  environmentName: string,
  fallbackMs: number,
): number {
  const configured = Number(process.env[environmentName]);
  if (!Number.isFinite(configured) || configured <= 0) {
    return fallbackMs;
  }
  return Math.min(Math.max(Math.floor(configured), 1), MAX_AI_TIMEOUT_MS);
}
