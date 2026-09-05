import type { ConnectionStats } from "./types";

/**
 * 封闭式安全观察：最终展示给用户的 observation 只允许来自本文件中的程序候选文本。
 * AI 只能从中选择要强调的角度（返回候选 id），不能生成自由文本。
 */
export const REPORT_OBSERVATION_IDS = [
  "acceptance",
  "persistence",
  "mixed",
  "no_disagreement",
  "alignment_progress",
  "alignment_stable",
] as const;

export type ObservationId = (typeof REPORT_OBSERVATION_IDS)[number];

/** 程序定义的安全候选文本，全部带小样本限定，静态不可变。 */
export const OBSERVATION_CANDIDATES: Record<ObservationId, string> = {
  acceptance:
    "本次体验中，当 AI 与你的初始判断不一致时，你更倾向采纳其第二意见，并据此调整了最终判断。",
  persistence:
    "本次体验中，当 AI 与你的初始判断不一致时，你更倾向坚持自己的初始判断。",
  mixed:
    "本次体验中，当 AI 提出不同意见时，你有时采纳、有时坚持，呈现逐局差异。",
  no_disagreement:
    "本次体验中，AI 与你的初始判断基本一致，几乎没有产生根本性分歧。",
  alignment_progress:
    "本次体验中，你的最终判断相比初始更贴近真实职业路径，呈现明显的趋同变化。",
  alignment_stable:
    "本次体验中，你与真实职业路径的趋同关系在连接 AI 前后保持稳定。",
};

/** 提供给 AI 选择用的候选说明（非展示文本，避免模型直接照抄自由改写）。 */
export const OBSERVATION_CHOICE_OPTIONS: Record<ObservationId, string> = {
  acceptance: "多数分歧中你采纳了 AI 的替代建议",
  persistence: "多数分歧中你坚持了自己的初始判断",
  mixed: "分歧中你既有采纳也有坚持",
  no_disagreement: "AI 与你的初始判断基本一致",
  alignment_progress: "你的最终判断比初始更贴近真实职业路径",
  alignment_stable: "你与职业路径的趋同关系保持稳定",
};

/** 根据程序统计计算本次可用的候选集合（AI 只能从其中选择）。 */
export function eligibleObservationIds(
  stats: ConnectionStats,
): ObservationId[] {
  const ids: ObservationId[] = [];
  if (stats.disagreementCount === 0) {
    ids.push("no_disagreement");
  } else if (stats.acceptanceCount > 0 && stats.persistenceCount > 0) {
    ids.push("mixed");
  } else if (stats.acceptanceCount > 0) {
    ids.push("acceptance");
  } else {
    ids.push("persistence");
  }
  if (
    stats.finalProfessionalAlignmentCount > stats.initialProfessionalAlignmentCount
  ) {
    ids.push("alignment_progress");
  } else if (stats.finalProfessionalAlignmentCount > 0) {
    ids.push("alignment_stable");
  }
  return ids;
}

/** 无 AI 或 AI 失效时的确定性选择（行为类别优先）。 */
export function fallbackObservationId(stats: ConnectionStats): ObservationId {
  if (stats.disagreementCount === 0) {
    return "no_disagreement";
  }
  if (stats.acceptanceCount > 0 && stats.persistenceCount > 0) {
    return "mixed";
  }
  if (stats.acceptanceCount > 0) {
    return "acceptance";
  }
  return "persistence";
}

/**
 * AI 返回的候选 id → 安全观察文案。
 * 未知 id 或不符合当前统计的候选一律返回 null（调用方走 deterministic fallback）。
 */
export function resolveReportObservation(
  choose: string | null,
  stats: ConnectionStats,
): string | null {
  if (choose === null || !(choose in OBSERVATION_CANDIDATES)) {
    return null;
  }
  const id = choose as ObservationId;
  if (!eligibleObservationIds(stats).includes(id)) {
    return null;
  }
  return OBSERVATION_CANDIDATES[id];
}