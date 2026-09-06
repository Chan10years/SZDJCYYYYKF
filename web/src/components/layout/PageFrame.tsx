import type { ReactNode } from "react";

export type PageFamily =
  | "standalone"
  | "spatial"
  | "decision"
  | "editorial"
  | "analysis";

type PageFrameProps = {
  family?: PageFamily;
  /** 每页唯一 eyebrow，如 "02 · 局势"。Intro 可不传。 */
  eyebrow?: string;
  children: ReactNode;
};

const FAMILY_WIDTH: Record<PageFamily, string> = {
  standalone: "lg:max-w-[1056px]",
  spatial: "lg:max-w-[1088px]",
  decision: "lg:max-w-[1088px]",
  editorial: "lg:max-w-[1088px]",
  analysis: "lg:max-w-[1056px]",
};

/**
 * 页面骨架：统一外层宽度/留白 + 每页唯一的阶段 eyebrow。
 * Desktop 目标内容宽度约 980–1100px；mobile 全宽（px-5）。
 * 视觉层级靠 typography 与留白，不额外提供卡片或边框。
 */
export function PageFrame({
  family = "editorial",
  eyebrow,
  children,
}: PageFrameProps) {
  return (
    <div
      className={`mx-auto flex min-h-dvh w-full flex-col px-5 sm:px-6 lg:px-0 ${FAMILY_WIDTH[family]}`}
    >
      {eyebrow ? (
        <p className="pt-5 text-xs font-medium text-app-muted lg:pt-6">
          {eyebrow}
        </p>
      ) : null}
      {children}
    </div>
  );
}
