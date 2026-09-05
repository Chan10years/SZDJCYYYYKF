"use client";

import { useEffect, useState } from "react";
import type { RoundResult } from "@/domain/types";
import { scenarios } from "@/data/scenarios";
import { calculateConnectionStats } from "@/domain/stats";
import { buildFallbackReport } from "@/domain/fallback";
import { OBSERVATION_CANDIDATES } from "@/domain/reportObservation";
import { ReportResponseSchema } from "@/lib/aiParsing";
import { ConnectionTrajectory } from "@/components/report/ConnectionTrajectory";
import { PageFrame } from "@/components/layout/PageFrame";
import { Num } from "@/components/layout/MetadataStrip";

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
        // 最终展示的 observation 必须来自程序定义的安全候选，杜绝任意模型文本进入 UI。
        if (!(Object.values(OBSERVATION_CANDIDATES) as string[]).includes(parsed.data.observation)) {
          throw new Error("Report observation is not a program-defined candidate");
        }
        if (!cancelled) {
          setObservation({ text: parsed.data.observation, source: parsed.data.source });
        }
      } catch {
        if (!cancelled) {
          setObservation({
            text: buildFallbackReport(calculateConnectionStats(rounds)),
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
    <PageFrame family="analysis">
      <header className="pt-8">
        <h1 className="text-2xl font-semibold leading-[1.28] text-app-text">
          连接报告
        </h1>
        <p className="mt-6 text-[2rem] font-semibold leading-[1.24] text-app-text">
          从单局，到模式。
        </p>
        <p className="mt-6 text-xs leading-relaxed text-app-muted">
          {SMALL_SAMPLE_NOTE}
        </p>
      </header>

      <div className="flex flex-col py-8">
        <div className="border-y border-app-line py-6">
          <ConnectionTrajectory rounds={rounds} />
        </div>

        {/* supporting metrics：嵌句呈现，数字 mono tabular，不做看板 */}
        <p className="mt-8 text-[15px] leading-[1.7] text-app-text">
          本次体验中：AI 在 <Num>{stats.disagreementCount}/{stats.totalRounds}</Num> 局给出不同方向；
          {stats.disagreementCount > 0 ? (
            <>
              分歧后调整 <Num>{stats.acceptanceCount}/{stats.disagreementCount}</Num>；
            </>
          ) : null}
          独立坚持 <Num>{stats.persistenceCount}</Num> 次；
          职业路径趋同 <Num>{stats.initialProfessionalAlignmentCount}</Num>
          {" → "}
          <Num>{stats.finalProfessionalAlignmentCount}</Num>。
        </p>

        <div className="mt-10 flex flex-col gap-3">
          <p className="text-[15px] font-semibold text-app-text">AI 行为观察</p>
          {observation ? (
            <p className="text-[15px] leading-[1.7] text-app-text">
              {observation.text}
            </p>
          ) : (
            <p className="text-[15px] leading-[1.7] text-app-muted">
              正在生成本次连接行为观察……
            </p>
          )}
        </div>

        {topReasons.length > 0 ? (
          <p className="mt-10 text-[13px] leading-relaxed text-app-muted">
            依据使用：
            {topReasons.map(([id, count], i) => (
              <span key={id}>
                {i > 0 ? " · " : ""}
                {reasonLabels.get(id) ?? id}{" "}
                <Num>×{count}</Num>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="pb-8">
        <button
          type="button"
          onClick={onReset}
          className="h-12 w-full rounded-md border border-app-line text-[15px] font-medium text-app-text transition-colors hover:border-app-muted"
        >
          重新体验
        </button>
      </div>
    </PageFrame>
  );
}
