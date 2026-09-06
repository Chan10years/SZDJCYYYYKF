// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/challenge/route";
import { requestChatCompletion } from "@/lib/aiClient";
import { buildFallbackChallenge } from "@/domain/fallback";
import { scenarios } from "@/data/scenarios";
import type { CallId } from "@/domain/types";

vi.mock("@/lib/aiClient", () => ({
  requestChatCompletion: vi.fn(),
}));

const mockedCompletion = vi.mocked(requestChatCompletion);

const scenario = scenarios[0];
const reasonIds = [scenario.reasonOptions[0].id];

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function liveJson(alternativeCall: string | null, stance = "challenge") {
  return JSON.stringify({
    stance,
    acknowledge: "承接用户理由。",
    blindspot: "指出盲点。",
    question: "要求重新判断的问题？",
    alternativeCall,
  });
}

describe("POST /api/challenge — 独立第二意见", () => {
  beforeEach(() => {
    mockedCompletion.mockReset();
  });

  it("Case A：用户 A、AI 独立首选 B → alternativeCall = B（live）", async () => {
    mockedCompletion.mockResolvedValue(liveJson("B"));
    const response = await post({
      scenarioId: scenario.id,
      initialCall: "A",
      reasonIds,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      alternativeCall: "B",
      stance: "challenge",
      source: "live",
    });
  });

  it("Case B：用户 A、模型复述用户选择 → alternativeCall = null（live）", async () => {
    mockedCompletion.mockResolvedValue(liveJson("A"));
    const response = await post({
      scenarioId: scenario.id,
      initialCall: "A",
      reasonIds,
    });
    await expect(response.json()).resolves.toMatchObject({
      alternativeCall: null,
      stance: "agree",
      source: "live",
    });
  });

  it("Case C：模型返回非法 Call → 安全 fallback，不崩、不生成不存在方案", async () => {
    mockedCompletion.mockResolvedValue(liveJson("D"));
    const response = await post({
      scenarioId: scenario.id,
      initialCall: "A",
      reasonIds,
    });
    expect(response.status).toBe(200);
    const fallback = buildFallbackChallenge(scenario, "A", reasonIds);
    await expect(response.json()).resolves.toEqual(fallback);
    expect(fallback.source).toBe("fallback");
  });

  it("模型请求抛错 → 安全 fallback", async () => {
    mockedCompletion.mockRejectedValue(new Error("timeout"));
    const response = await post({
      scenarioId: scenario.id,
      initialCall: "A",
      reasonIds,
    });
    await expect(response.json()).resolves.toEqual(
      buildFallbackChallenge(scenario, "A", reasonIds),
    );
  });
});

describe("POST /api/challenge — Prompt 组装", () => {
  beforeEach(() => {
    mockedCompletion.mockReset();
    mockedCompletion.mockResolvedValue(liveJson(null, "agree"));
  });

  async function captureUserPrompt(initialCall: CallId): Promise<string> {
    await post({ scenarioId: scenario.id, initialCall, reasonIds });
    const messages = mockedCompletion.mock.calls[0][0].messages;
    const user = messages.find((m) => m.role === "user");
    return user?.content ?? "";
  }

  it("三个 Call 的真实语义全部进入 Prompt（独立比较的前提）", async () => {
    const prompt = await captureUserPrompt("A");
    for (const call of scenario.calls) {
      expect(prompt).toContain(`Call ${call.id}（${call.label}）`);
      expect(prompt).toContain(call.description);
    }
  });

  it("用户初始判断出现在可选方案之后（先独立判断，再看用户答案）", async () => {
    const prompt = await captureUserPrompt("A");
    expect(prompt.indexOf("可选方案")).toBeLessThan(
      prompt.indexOf("用户初始判断"),
    );
  });

  it("职业路径 / 历史结果不得进入 Prompt", async () => {
    const prompt = await captureUserPrompt("A");
    // pathLabel 可能与某个 Call 的 label 重合（职业选择了该 Call），
    // 因此用 outcome / observations / 职业框架措辞判断泄漏，而不是 label 字符串。
    expect(prompt).not.toContain(scenario.professional.outcome);
    for (const obs of scenario.professional.observations) {
      expect(prompt).not.toContain(obs);
    }
    expect(prompt).not.toMatch(/职业|历史结果|实际路径/);
  });
});
