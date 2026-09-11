/**
 * 为浏览器请求提供可恢复的整体 deadline。
 * 可选的 consume 回调会把响应体读取也纳入同一个 deadline，避免
 * fetch 已经 resolve 但 response.json() 永久 pending。
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response>;
export async function fetchWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  consume: (response: Response) => Promise<T>,
): Promise<T>;
export async function fetchWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  consume?: (response: Response) => Promise<T>,
): Promise<Response | T> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 1;

  const abortFromCaller = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener("abort", abortFromCaller, { once: true });
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("request timed out"));
    }, timeout);
  });

  try {
    const request = consume
      ? fetch(input, { ...init, signal: controller.signal }).then((response) =>
          consume(response),
        )
      : fetch(input, { ...init, signal: controller.signal });
    return await Promise.race([request, deadline]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}
