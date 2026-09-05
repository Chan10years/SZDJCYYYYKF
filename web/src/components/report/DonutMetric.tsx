import type { CSSProperties } from "react";

type DonutMetricProps = {
  label: string;
  numerator: number;
  denominator: number;
};

/**
 * 用 conic-gradient 实现的环形指标，不依赖图表库。
 * denominator 为 0 或非法时：显示 `0 / 0`、使用中性 ring、避免 NaN。
 */
export function DonutMetric({
  label,
  numerator,
  denominator,
}: DonutMetricProps) {
  const isEmpty = denominator <= 0 || Number.isNaN(denominator);
  const ratio = isEmpty ? 0 : numerator / denominator;
  const degrees = Math.max(0, Math.min(1, ratio)) * 360;
  const background = isEmpty
    ? "conic-gradient(var(--app-line) 0turn 1turn)"
    : `conic-gradient(var(--app-accent) ${degrees}deg, var(--app-line) ${degrees}deg)`;
  const display = isEmpty ? "0 / 0" : `${numerator} / ${denominator}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background } as CSSProperties}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-app-surface">
          <span className="text-sm font-semibold tabular-nums text-app-text">
            {display}
          </span>
        </div>
      </div>
      <p className="max-w-[8rem] text-center text-[12px] leading-snug text-app-muted">
        {label}
      </p>
    </div>
  );
}