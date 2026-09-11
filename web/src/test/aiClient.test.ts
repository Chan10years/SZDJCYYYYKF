// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestChatCompletion } from "@/lib/aiClient";

describe("requestChatCompletion", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("rejects when the response body never settles by the provider deadline", async () => {
    vi.useFakeTimers();
    vi.stubEnv("AI_BASE_URL", "https://ai.example.test/v1");
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "test-model");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => new Promise<unknown>(() => undefined),
      }),
    );

    let settled = false;
    const request = requestChatCompletion({
      messages: [],
      timeoutMs: 100,
      maxTokens: 10,
    }).catch(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(100);

    expect(settled).toBe(true);
    await request;
  });

  it("rejects immediately when the server has no AI credentials", async () => {
    vi.stubEnv("AI_BASE_URL", "");
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_MODEL", "");

    await expect(
      requestChatCompletion({ messages: [], timeoutMs: 100, maxTokens: 10 }),
    ).rejects.toThrow("AI credentials are not configured");
  });
});
