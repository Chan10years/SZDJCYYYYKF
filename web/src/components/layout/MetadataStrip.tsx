import type { ReactNode } from "react";

type MetadataStripProps = {
  /** 比赛 context 片段，如 ["ROUND 2/3", "DUST II", "T SIDE", "2v2", "0:49"] */
  items: ReactNode[];
  className?: string;
};

/**
 * Scorebug 式单行比赛 context：` · ` 分隔、无框、可整体 wrap。
 * 数字片段由调用方用 <Num> 包裹以获得 mono tabular。
 */
export function MetadataStrip({ items, className = "" }: MetadataStripProps) {
  return (
    <p
      className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs font-medium text-app-muted ${className}`}
    >
      {items.map((item, i) => (
        <span key={i} className="flex items-baseline gap-2">
          {i > 0 ? <span aria-hidden="true">·</span> : null}
          {item}
        </span>
      ))}
    </p>
  );
}

/** metadata / 正文中的数字片段：mono + tabular，与中文同行同字号。 */
export function Num({ children }: { children: ReactNode }) {
  return <span className="font-mono tabular-nums">{children}</span>;
}
