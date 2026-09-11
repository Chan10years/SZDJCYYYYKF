// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/challenge/route";
import { requestChatCompletion } from "@/lib/aiClient";
import { resetAiBudgetForTests } from "@/lib/aiBudget";
import { buildFallbackChallenge } from "@/domain/fallback";
import { scenarios } from "@/data/scenarios";
import type { CallId } from "@/domain/types";

vi.mock("@/lib/aiClient", () => ({
  requestChatCompletion: vi.fn(),
}));

const mockedCompletion = vi.mocked(requestChatCompletion);

const scenario = scenarios[0];
const reasonIds = [scenario.reasonOptions[0].id];
let requestSequence = 0;

function post(body: unknown, sourceKey = `route-test-${requestSequence++}`) {
  return POST(
    new Request("http://localhost/api/challenge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": sourceKey,
      },
      body: JSON.stringify(body),
    }),
  );
}

function liveJson(
  alternativeCall: string | null,
  stance = "challenge",
  overrides: Partial<{
    acknowledgeReasonIds: string[];
    blindspotFactIndex: number;
    questionFactIndex: number;
  }> = {},
) {
  return JSON.stringify({
    stance,
    acknowledgeReasonIds: overrides.acknowledgeReasonIds ?? reasonIds,
    blindspotFactIndex: overrides.blindspotFactIndex ?? 2,
    questionFactIndex: overrides.questionFactIndex ?? 4,
    alternativeCall,
  });
}

function legacyFreeTextJson(overrides: {
  acknowledge?: string;
  blindspot?: string;
  question?: string;
}) {
  return JSON.stringify({
    stance: "challenge",
    acknowledge: overrides.acknowledge ?? "承接用户理由。",
    blindspot: overrides.blindspot ?? "指出盲点。",
    question: overrides.question ?? "要求重新判断的问题？",
    alternativeCall: "B",
  });
}

describe("POST /api/challenge — 独立第二意见", () => {
  beforeEach(() => {
    mockedCompletion.mockReset();
    resetAiBudgetForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it.each([
    ["未提供的精确位置", {blindspot: "敌人藏在 A 小道。"}],
    ["未提供的道具状态", {blindspot: "对方还留着两枚闪光。"}],
    ["未提供的比分", {blindspot: "当前比分 Falcons 5:3 Spirit。"}],
    ["否定用户判断", {question: "你的判断就是错的。"}],
    [
      "把职业打法说成最佳打法",
      {question: "职业队这样打，所以这才是最佳打法。"},
    ],
  ])("模型自由文本输出 %s 时安全回退", async (_label, text) => {
    mockedCompletion.mockResolvedValue(legacyFreeTextJson(text));
    const response = await post({
      scenarioId: scenario.id,
      initialCall: "A",
      reasonIds,
    });

    await expect(response.json()).resolves.toEqual(
      buildFallbackChallenge(scenario, "A", reasonIds),
    );
  });

  it("结构化引用当前 Scenario 事实的合理推理仍保留 live", async () => {
    mockedCompletion.mockResolvedValue(
      liveJson("B", "challenge", {
        acknowledgeReasonIds: ["known_position"],
        blindspotFactIndex: 1,
        questionFactIndex: 2,
      }),
    );
    const response = await post({
      scenarioId: scenario.id,
      initialCall: "A",
      reasonIds,
    });

    await expect(response.json()).resolves.toMatchObject({
      source: "live",
      alternativeCall: "B",
      blindspot: expect.stringContaining(scenario.situation.facts[1].label),
    });
  });

  it("结构化 fact index 越界时回退", async () => {
    mockedCompletion.mockResolvedValue(
      liveJson("B", "challenge", { blindspotFactIndex: 99 }),
    );
    const response = await post({
      scenarioId: scenario.id,
      initialCall: "A",
      reasonIds,
    });

    await expect(response.json()).resolves.toEqual(
      buildFallbackChallenge(scenario, "A", reasonIds),
    );
  });

  it("60 名用户各完成三轮 Challenge 后仍不触发进程预算 fallback", async () => {
    mockedCompletion.mockResolvedValue(liveJson(null, "agree"));
    const sourceKey = "198.51.100.77";
    const body = {
      scenarioId: scenario.id,
      initialCall: "A",
      reasonIds,
    };

    const burst = Array.from({ length: 60 }, () =>
      Array.from({ length: 3 }, () => post(body, sourceKey)),
    ).flat();
    await Promise.all(burst);
    const callsBeforeExhaustion = mockedCompletion.mock.calls.length;
    const response = await post(body, sourceKey);

    expect(callsBeforeExhaustion).toBe(180);
    expect(mockedCompletion).toHaveBeenCalledTimes(180);
    await expect(response.json()).resolves.toEqual(
      buildFallbackChallenge(scenario, "A", reasonIds),
    );
  });

  it("非法 timeout 环境变量回到安全默认值，并限制 Challenge 输出长度", async () => {
    vi.stubEnv("AI_CHALLENGE_TIMEOUT_MS", "not-a-number");
    mockedCompletion.mockResolvedValue(liveJson(null, "agree"));

    await post({
      scenarioId: scenario.id,
      initialCall: "A",
      reasonIds,
    });

    expect(mockedCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 5_000, maxTokens: 384 }),
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
