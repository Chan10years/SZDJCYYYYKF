import type { ScenarioVerificationStatus } from "./types";

export type ScenarioStatusCopy = {
  title: string;
  subtitle: string;
  note: string;
  pathHeading: string;
  outcomeHeading: string;
  entryLabel: string;
  referenceLabel: string;
  shortLabel: string;
  situationSuffix: string;
};

const STATUS_COPY: Record<ScenarioVerificationStatus, ScenarioStatusCopy> = {
  verified: {
    title: "真实职业路径",
    subtitle: "历史上真实发生的一条职业路径，仅供参考",
    note: "这是历史上真实发生的一条职业路径，不是唯一正确答案。",
    pathHeading: "实际路径",
    outcomeHeading: "历史结果",
    entryLabel: "查看真实职业路径",
    referenceLabel: "职业路径参考",
    shortLabel: "职业",
    situationSuffix: "",
  },
  practice: {
    title: "练习路径参考",
    subtitle: "Practice Reference · 尚未进行正式比赛核验",
    note: "这是一条练习参考路径，尚未进行正式比赛核验，不是唯一正确答案。",
    pathHeading: "练习路径",
    outcomeHeading: "练习观察",
    entryLabel: "查看练习路径参考",
    referenceLabel: "练习路径参考",
    shortLabel: "练习",
    situationSuffix: " · 练习场景 · 尚未正式核验",
  },
  draft: {
    title: "草稿路径参考",
    subtitle: "Draft · 尚未完成事实核验",
    note: "这是一条草稿参考路径，尚未完成事实核验，不是唯一正确答案。",
    pathHeading: "草稿路径",
    outcomeHeading: "草稿观察",
    entryLabel: "查看草稿参考",
    referenceLabel: "草稿路径参考",
    shortLabel: "草稿",
    situationSuffix: " · 草稿场景 · 未完成事实核验",
  },
};

export function getScenarioStatusCopy(
  status: ScenarioVerificationStatus,
): ScenarioStatusCopy {
  return STATUS_COPY[status];
}
