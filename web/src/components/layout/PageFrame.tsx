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
  standalone: "max-w-xl",
  spatial: "max-w-3xl",
  decision: "max-w-2xl lg:max-w-5xl",
  editorial: "max-w-2xl",
  analysis: "max-w-4xl",
};

/**
 * 页面骨架：统一外层宽度/留白 + 每页唯一的阶段 eyebrow。
 * 视觉层级靠 typography 与留白，不额外提供卡片或边框。
 */
export function PageFrame({
  family = "editorial",
  eyebrow,
  children,
}: PageFrameProps) {
  return (
    <div
      className={`mx-auto flex min-h-dvh w-full flex-col px-5 sm:px-6 ${FAMILY_WIDTH[family]}`}
    >
      {eyebrow ? (
        <p className="pt-8 text-xs font-medium text-app-muted">{eyebrow}</p>
      ) : null}
      {children}
    </div>
  );
}
