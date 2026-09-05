import type { ReactNode } from "react";

type MetricCardProps = {
  title: string;
  children: ReactNode;
};

/** 结果页的通用指标卡片：标题 + 内容，保持克制的数据产品风格。 */
export function MetricCard({ title, children }: MetricCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-app-line bg-app-surface px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">
        {title}
      </p>
      {children}
    </div>
  );
}