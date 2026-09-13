import type { CallId, ChallengeOutput } from "./types";

export type NextTrainingHypothesisInput = {
  initialCall: CallId;
  finalCall: CallId;
  challenge: Pick<ChallengeOutput, "stance">;
};

/**
 * 生成不依赖地图事实或职业结果的 next check。
 * 它只描述用户已经走过的 response path，不把任何路径包装成标准答案。
 */
export function buildNextTrainingHypothesis({
  initialCall,
  finalCall,
  challenge,
}: NextTrainingHypothesisInput): string {
  if (initialCall !== finalCall) {
    return "下一次类似局面，先写下从初始判断改判前要验证的条件。";
  }

  if (challenge.stance === "challenge") {
    return "下一次类似局面，先检查 AI 提出的盲点，再决定是否坚持原判断。";
  }

  return "下一次类似局面，先复述支撑初始判断的关键条件，再确认它是否仍成立。";
}
