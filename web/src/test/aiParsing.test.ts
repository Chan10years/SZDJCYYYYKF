import { describe, expect, it } from "vitest";
import {
  normalizeChallengeContent,
  parseChallengeContent,
  parseReportChooseContent,
} from "@/lib/aiParsing";

describe("parseChallengeContent", () => {
  it("parses a plain JSON object", () => {
    const raw = JSON.stringify({
      stance: "challenge",
      acknowledgeReasonIds: ["known_position"],
      blindspotFactIndex: 2,
      questionFactIndex: 4,
      alternativeCall: "B",
    });
    expect(parseChallengeContent(raw)).toMatchObject({
      stance: "challenge",
      acknowledgeReasonIds: ["known_position"],
      blindspotFactIndex: 2,
      alternativeCall: "B",
    });
  });

  it("parses a JSON object wrapped in a markdown code fence", () => {
    const raw =
      '```json\n' +
      JSON.stringify({
        stance: "agree",
        acknowledgeReasonIds: ["time_pressure"],
        blindspotFactIndex: 1,
        questionFactIndex: 0,
        alternativeCall: null,
      }) +
      '\n```';
    expect(parseChallengeContent(raw)).toMatchObject({
      stance: "agree",
      alternativeCall: null,
    });
  });

  it("returns null for malformed JSON", () => {
    expect(parseChallengeContent("{ not valid json")).toBeNull();
  });

  it("returns null when the alternative Call is schema-invalid", () => {
    const raw = JSON.stringify({
      stance: "challenge",
      acknowledgeReasonIds: ["known_position"],
      blindspotFactIndex: 0,
      questionFactIndex: 1,
      alternativeCall: "D",
    });
    expect(parseChallengeContent(raw)).toBeNull();
  });

  it("returns null when a required text field is missing", () => {
    const raw = JSON.stringify({
      stance: "challenge",
      acknowledgeReasonIds: ["known_position"],
      alternativeCall: null,
    });
    expect(parseChallengeContent(raw)).toBeNull();
  });

  it("rejects the old free-text contract instead of trying to inspect prose", () => {
    const raw = JSON.stringify({
      stance: "challenge",
      acknowledge: "承接。",
      blindspot: "对手在未提供的位置。",
      question: "你的判断就是错的。",
      alternativeCall: "B",
    });
    expect(parseChallengeContent(raw)).toBeNull();
  });
});

describe("normalizeChallengeContent — alternativeCall 必须不同于用户 Initial Call", () => {
  const base = {
    acknowledgeReasonIds: ["known_position"] as ["known_position"],
    blindspotFactIndex: 0,
    questionFactIndex: 1,
  };

  it("Case A：用户 A、AI 独立首选 B → alternativeCall 保留 B，stance 为 challenge", () => {
    expect(
      normalizeChallengeContent(
        { ...base, stance: "challenge", alternativeCall: "B" },
        "A",
      ),
    ).toMatchObject({ alternativeCall: "B", stance: "challenge" });
  });

  it("Case B：用户 A、模型把用户选择复述为 alternativeCall → 归一化为 null + agree", () => {
    expect(
      normalizeChallengeContent(
        { ...base, stance: "challenge", alternativeCall: "A" },
        "A",
      ),
    ).toMatchObject({ alternativeCall: null, stance: "agree" });
  });

  it("alternativeCall 已为 null 时保持 null + agree", () => {
    expect(
      normalizeChallengeContent(
        { ...base, stance: "agree", alternativeCall: null },
        "A",
      ),
    ).toMatchObject({ alternativeCall: null, stance: "agree" });
  });

  it("模型给出分歧但 stance 误标 agree 时，stance 由 alternativeCall 派生", () => {
    expect(
      normalizeChallengeContent(
        { ...base, stance: "agree", alternativeCall: "C" },
        "A",
      ),
    ).toMatchObject({ alternativeCall: "C", stance: "challenge" });
  });
});

describe("parseReportChooseContent", () => {
  it("parses a plain choose JSON object", () => {
    const raw = JSON.stringify({ choose: "mixed" });
    expect(parseReportChooseContent(raw)).toEqual({ choose: "mixed" });
  });

  it("rejects an empty choose", () => {
    expect(parseReportChooseContent('{"choose":""}')).toBeNull();
  });

  it("rejects non-JSON input", () => {
    expect(parseReportChooseContent("not json")).toBeNull();
  });

  it("rejects free-text observation output (no choose field)", () => {
    const raw = JSON.stringify({
      observation: "你在分歧中明显更重视自己的判断，这说明你……",
    });
    expect(parseReportChooseContent(raw)).toBeNull();
  });
});
