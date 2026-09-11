import type { ReasonId, Scenario } from "@/domain/types";
import type { ParsedChallengeContent } from "@/lib/aiParsing";

/**
 * 纯函数安全闸：模型只能返回当前请求允许的引用，不能把自由文本或
 * Scenario 外的事实直接注入产品。外部文案由服务端的确定性 renderer 生成。
 */
export function isSafeChallengeContent(
  content: ParsedChallengeContent,
  scenario: Scenario,
  reasonIds: ReasonId[],
): boolean {
  const availableReasonIds = new Set(
    scenario.reasonOptions.map((reason) => reason.id),
  );
  const requestedReasonIds = new Set(reasonIds);
  const reasonsAreScoped =
    content.acknowledgeReasonIds.length > 0 &&
    content.acknowledgeReasonIds.every(
      (reasonId) =>
        availableReasonIds.has(reasonId) && requestedReasonIds.has(reasonId),
    );
  const factsAreScoped = [
    content.blindspotFactIndex,
    content.questionFactIndex,
  ].every(
    (factIndex) =>
      Number.isInteger(factIndex) &&
      factIndex >= 0 &&
      factIndex < scenario.situation.facts.length,
  );
  const alternativeCallIsScoped =
    content.alternativeCall === null ||
    scenario.calls.some((call) => call.id === content.alternativeCall);

  return reasonsAreScoped && factsAreScoped && alternativeCallIsScoped;
}
