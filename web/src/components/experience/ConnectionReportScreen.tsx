"use client";

import { useEffect, useState } from "react";
import type { RoundResult } from "@/domain/types";
import { scenarios } from "@/data/scenarios";
import { calculateConnectionStats } from "@/domain/stats";
import { buildFallbackReport } from "@/domain/fallback";
import { ReportResponseSchema } from "@/lib/aiParsing";
import { ConnectionTrajectory } from "@/components/report/ConnectionTrajectory";
import { DonutMetric } from "@/components/report/DonutMetric";
import { MetricCard } from "@/components/report/MetricCard";

type ConnectionReportScreenProps = {
  rounds: RoundResult[];
  onReset: () => void;
};

const SMALL_SAMPLE_NOTE =
  "以下分析仅基于本次 3 个案例，用于观察当前体验中的决策变化，不代表稳定人格或能力评估。";

type Observation = { text: string; source: "live" | "fallback" };

export function ConnectionReportScreen({
  rounds,
  onReset,
}: ConnectionReportScreenProps) {
  const stats = calculateConnectionStats(rounds);
  const [observation, setObservation] = useState<Observation | null>(null);

  // 三局记录与统计一旦确定，立即异步获取跨局行为观察；任何失败都回退到确定性文本。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rounds }),
        });
        if (!response.ok) {
          throw new Error(`Report request failed with status ${response.status}`);
        }
        const data: unknown = await response.json();
        const parsed = ReportResponseSchema.safeParse(data);
        if (!parsed.success) {
          throw new Error("Report response failed schema validation");
        }
        if (!cancelled) {
          setObservation({ text: parsed.data.observation, source: parsed.data.source });
        }
      } catch {
        if (!cancelled) {
          setObservation({
            text: buildFallbackReport(rounds, calculateConnectionStats(rounds)),
            source: "fallback",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rounds]);

  // 从所有 Scenario 收集 Reason label，用于展示理由频率。
  const reasonLabels = new Map<string, string>();
  for (const scenario of scenarios) {
    for (const reason of scenario.reasonOptions) {
      reasonLabels.set(reason.id, reason.label);
    }
  }

  const topReasons = Object.entries(stats.reasonFrequency)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6">
      <header className="border-b border-app-line py-4">
        <h1 className="text-[15px] font-medium text-app-text">连接报告</h1>
        <p className="mt-0.5 text-[13px] text-app-muted">
          连接 AI 之后，你的判断发生了什么
        </p>
      </header>

      <div className="flex flex-col gap-6 py-6">
        <p className="rounded-md border border-app-line bg-app-surface px-3 py-2.5 text-[12px] leading-relaxed text-app-muted">
          {SMALL_SAMPLE_NOTE}
        </p>

        <ConnectionTrajectory rounds={rounds} />

        <div className="grid grid-cols-2 gap-3">
          <MetricCard title="AI 分歧">
            <DonutMetric
              label="AI 给出不同初始判断的比例"
              numerator={stats.disagreementCount}
              denominator={stats.totalRounds}
            />
          </MetricCard>

          <MetricCard title="分歧后采纳">
            <DonutMetric
              label="分歧后选择 AI 建议的比例"
              numerator={stats.acceptanceCount}
              denominator={stats.disagreementCount}
            />
          </MetricCard>

          <MetricCard title="独立坚持">
            <p className="text-center font-mono text-3xl font-semibold tabular-nums text-app-info">
              {stats.persistenceCount}
              <span className="ml-1 text-sm font-normal text-app-muted">次</span>
            </p>
            <p className="text-center text-[12px] leading-snug text-app-muted">
              分歧后坚持自己初始方案，非好坏评价
            </p>
          </MetricCard>

          <MetricCard title="职业路径趋同">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-app-muted">初始趋同</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-app-text">
                  {stats.initialProfessionalAlignmentCount} / {stats.totalRounds}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-app-muted">最终趋同</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-app-text">
                  {stats.finalProfessionalAlignmentCount} / {stats.totalRounds}
                </span>
              </div>
            </div>
          </MetricCard>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-app-line bg-app-elevated px-4 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">
            AI 行为观察
          </p>
          {observation ? (
            <p className="text-[13px] leading-relaxed text-app-text">
              {observation.text}
            </p>
          ) : (
            <p className="text-[13px] leading-relaxed text-app-muted">
              正在生成本次连接行为观察……
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-app-line bg-app-surface px-4 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">
            理由频率
          </p>
          {topReasons.length === 0 ? (
            <p className="text-[13px] text-app-muted">暂无理由记录。</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {topReasons.map(([id, count]) => (
                <li
                  key={id}
                  className="flex items-center justify-between text-[13px]"
                >
                  <span className="text-app-text">
                    {reasonLabels.get(id) ?? id}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-app-muted">
                    ×{count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="py-6">
        <button
          type="button"
          onClick={onReset}
          className="h-12 w-full rounded-md border border-app-line text-[15px] font-medium text-app-text transition-colors hover:border-app-accent hover:text-app-accent"
        >
          重新体验
        </button>
      </div>
    </div>
  );
}