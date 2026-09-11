// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("also times out a response body that never settles", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return Promise.resolve({
          ok: true,
          json: () => new Promise<unknown>(() => undefined),
        });
      }),
    );

    const request = fetchWithTimeout(
      "/api/test",
      { method: "GET" },
      800,
      async (response) => response.json(),
    );
    const rejected = expect(request).rejects.toThrow("request timed out");

    await vi.advanceTimersByTimeAsync(800);

    expect(signal?.aborted).toBe(true);
    await rejected;
  });
});
