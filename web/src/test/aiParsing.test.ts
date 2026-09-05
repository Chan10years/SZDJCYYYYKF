import { describe, expect, it } from "vitest";
import { parseChallengeContent } from "@/lib/aiParsing";

describe("parseChallengeContent", () => {
  it("parses a plain JSON object", () => {
    const raw = JSON.stringify({
      stance: "challenge",
      acknowledge: "你主要依据「已知位置」做出判断。",
      blindspot: "A 区信息明确，但那可能只是诱饵。",
      question: "如果对手压向 A 区，你的依据还成立吗？",
      alternativeCall: "B",
    });
    expect(parseChallengeContent(raw)).toMatchObject({
      stance: "challenge",
      acknowledge: "你主要依据「已知位置」做出判断。",
      alternativeCall: "B",
    });
  });

  it("parses a JSON object wrapped in a markdown code fence", () => {
    const raw =
      '```json\n' +
      JSON.stringify({
        stance: "agree",
        acknowledge: "你当前的选择合理。",
        blindspot: "仍需留意时间消耗。",
        question: "倒计时是否在压缩你的执行窗口？",
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
      acknowledge: "好",
      blindspot: "盲点",
      question: "问题",
      alternativeCall: "D",
    });
    expect(parseChallengeContent(raw)).toBeNull();
  });

  it("returns null when a required text field is missing", () => {
    const raw = JSON.stringify({
      stance: "challenge",
      acknowledge: "好",
      alternativeCall: null,
    });
    expect(parseChallengeContent(raw)).toBeNull();
  });
});