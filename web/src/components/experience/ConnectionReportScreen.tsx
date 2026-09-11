"use client";

import { useEffect, useState } from "react";
import type { RoundResult } from "@/domain/types";
import { scenarios } from "@/data/scenarios";
import { calculateConnectionStats } from "@/domain/stats";
import { buildFallbackReport } from "@/domain/fallback";
import { OBSERVATION_CANDIDATES } from "@/domain/reportObservation";
import { ReportResponseSchema } from "@/lib/aiParsing";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { getAiSourceLabel } from "@/domain/aiSource";
import { ConnectionTrajectory } from "@/components/report/ConnectionTrajectory";
import { PageFrame } from "@/components/layout/PageFrame";
import { Num } from "@/components/layout/MetadataStrip";

type ConnectionReportScreenProps = {
  rounds: RoundResult[];
  onReset: () => void;
};

type Observation = { text: string; source: "live" | "fallback" };

export const REPORT_CLIENT_TIMEOUT_MS = 8_000;

/** 极轻量 AI annotation glyph：结论区锚点，非插画。 */
function ObservationGlyph() {
  const bars = [5, 9, 13, 8, 12, 6, 10];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 26 14"
      className="mt-1.5 h-4 w-[30px] shrink-0"
    >
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 4}
          y={14 - h}
          width={2}
          height={h}
          rx={1}
          className="fill-app-ai"
          opacity={0.55 + (i % 3) * 0.15}
        />
      ))}
    </svg>
  );
}

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
        const data = await fetchWithTimeout(
          "/api/report",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rounds }),
          },
          REPORT_CLIENT_TIMEOUT_MS,
          async (response) => {
            if (!response.ok) {
              throw new Error(
                `Report request failed with status ${response.status}`,
              );
            }
            return (await response.json()) as unknown;
          },
        );
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

  const topReasons = stats.reasonFrequency
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  // 两个核心数字：直接回答产品的两个核心问题。
  // 指标一：AI 分歧后发生调整的比例；分母为 0 时不得显示 0%，改用安全文案。
  const hasDisagreement = stats.disagreementCount > 0;
  const acceptanceRate = hasDisagreement
    ? Math.round((stats.acceptanceCount / stats.disagreementCount) * 100)
    : null;
  // 指标二：最终判断与职业路径趋同的比例。
  const finalAlignmentRate =
    stats.verifiedReferenceRounds > 0
      ? Math.round(
          (stats.finalProfessionalAlignmentCount /
            stats.verifiedReferenceRounds) *
            100,
        )
      : null;
  const smallSampleNote = `以下分析仅基于本次 ${stats.totalRounds} 个案例，用于观察当前体验中的决策变化，不代表稳定人格或能力评估。`;

  return (
    <PageFrame family="analysis" eyebrow="08 · 连接报告">
      <div className="w-full max-w-[840px]">
        <header className="pt-4">
          <h1 className="text-2xl font-semibold leading-[1.26] text-app-text lg:text-[1.75rem]">
            从单局，到模式。
          </h1>
          <p className="mt-1 text-[13px] text-app-muted">
            看看你的判断如何与 AI 和参考路径发生连接。
          </p>
        </header>

        {/* 三轮判断变化轨迹 */}
        <section className="mt-6 border-t border-app-line pt-5">
          <p className="text-[13px] font-medium text-app-muted">
            三轮判断变化轨迹
          </p>
          <div className="mt-4">
            <ConnectionTrajectory rounds={rounds} />
          </div>
        </section>

        {/* 关键观察：两个核心数字（轨迹之后的第二视觉高潮） */}
        <section className="mt-6 border-t border-app-line pt-6">
          <p className="text-[13px] font-medium text-app-muted">关键观察</p>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-stretch gap-5 sm:gap-8">
            <div>
              {acceptanceRate !== null ? (
                <>
                  <p className="font-mono text-[2.75rem] font-semibold leading-none tabular-nums text-app-ai lg:text-[3.25rem]">
                    {acceptanceRate}%
                  </p>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-app-muted">
                    在 AI 分歧后发生调整（
                    <Num>
                      {stats.acceptanceCount}/{stats.disagreementCount}
                    </Num>
                    ）
                  </p>
                </>
              ) : (
                <p className="text-[15px] leading-[1.7] text-app-text">
                  本次体验中 AI 未提出不同方向。
                </p>
              )}
            </div>
            <div aria-hidden="true" className="w-px bg-app-line" />
            <div>
              {finalAlignmentRate !== null ? (
                <>
                  <p className="font-mono text-[2.75rem] font-semibold leading-none tabular-nums text-app-text lg:text-[3.25rem]">
                    {finalAlignmentRate}%
                  </p>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-app-muted">
                    最终判断与已核验职业路径趋同（
                    <Num>
                      {stats.finalProfessionalAlignmentCount}/
                      {stats.verifiedReferenceRounds}
                    </Num>
                    ）
                  </p>
                </>
              ) : (
                <p className="text-[15px] leading-[1.7] text-app-text">
                  本次没有可用于职业路径趋同统计的已核验案例。
                </p>
              )}
            </div>
          </div>
          {topReasons.length > 0 ? (
            <p className="mt-5 text-[12px] leading-relaxed text-app-muted">
              依据使用：
              {topReasons.map(({ scenarioId, reasonId, count }, i) => {
                const scenario = scenarios.find((item) => item.id === scenarioId);
                const label = scenario?.reasonOptions.find(
                  (reason) => reason.id === reasonId,
                )?.label ?? reasonId;
                const roundLabel = scenario
                  ? `R${scenarios.indexOf(scenario) + 1} `
                  : "";
                return (
                <span key={`${scenarioId}:${reasonId}`}>
                  {i > 0 ? " · " : ""}
                  {roundLabel}{label} <Num>×{count}</Num>
                </span>
                );
              })}
            </p>
          ) : null}
        </section>

        {/* AI 行为观察：结论区，glyph + 收束文本一行，限本次 3 局行为 */}
        <section className="mt-6 border-t border-app-line pt-6">
          <p className="text-[13px] font-medium text-app-muted">AI 行为观察</p>
          <div className="mt-3 flex items-start gap-4">
            <ObservationGlyph />
            {observation ? (
              <div className="max-w-2xl flex-1">
                <p className="text-[15px] leading-[1.75] text-app-text">
                  {observation.text}
                </p>
                <p className="mt-2 text-xs text-app-muted">
                  来源：{getAiSourceLabel(observation.source)}
                </p>
              </div>
            ) : (
              <p className="max-w-2xl flex-1 text-[15px] leading-[1.75] text-app-muted">
                正在生成本次连接行为观察……
              </p>
            )}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-app-muted">
            {smallSampleNote}
          </p>
        </section>

        <div className="mt-8 pb-8">
          <button
            type="button"
            onClick={onReset}
            className="h-12 w-full rounded-md border border-app-line text-[15px] font-medium text-app-text transition-colors hover:border-app-muted sm:w-auto sm:px-12"
          >
            重新体验
          </button>
        </div>
      </div>
    </PageFrame>
  );
}
