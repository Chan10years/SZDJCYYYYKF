"use client";

import type { CallId, Scenario } from "@/domain/types";
import { TacticalPreview } from "@/components/tactical/TacticalPreview";
import { PageFrame } from "@/components/layout/PageFrame";
import { MetadataStrip, Num } from "@/components/layout/MetadataStrip";

type TacticalPreviewScreenProps = {
  scenario: Scenario;
  finalCall: CallId;
  onNext: () => void;
};

/**
 * 战术空间预览：地图是全页最大视觉主角。
 * 表达“如果执行这个判断，空间结构如何变化”，与局势页的“现在是什么局面”语义分开。
 * 定性指标为紧凑编辑式表达，地图明显压过文字。
 */
export function TacticalPreviewScreen({
  scenario,
  finalCall,
  onNext,
}: TacticalPreviewScreenProps) {
  const map = <TacticalPreview scenario={scenario} call={finalCall} animate />;

  const nextButton = (
    <button
      type="button"
      onClick={onNext}
      className="h-12 rounded-md bg-app-text text-[15px] font-medium text-app-bg transition-colors hover:opacity-90"
    >
      {scenario.verified ? "查看真实职业路径" : "查看练习路径参考"}
    </button>
  );

  return (
    <PageFrame family="spatial" eyebrow="05 · 战术预览">
      <MetadataStrip
        className="pt-6"
        items={[
          <span key="m">{scenario.source.map.toUpperCase()}</span>,
          <span key="t">
            <Num>{scenario.situation.time}</Num>
          </span>,
          <span key="a">
            <Num>{scenario.situation.alive}</Num>
          </span>,
          <span key="o">{scenario.situation.objective}</span>,
        ]}
      />

      {/* desktop ≥lg：地图左大图 + 右注释列 */}
      <div className="hidden gap-12 py-6 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>{map}</div>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-app-muted">你的最终方案</p>
            <h1 className="text-2xl font-semibold leading-[1.28] text-app-text">
              <span className="text-app-user">Call {finalCall}</span> 的空间意义
            </h1>
          </div>
          <p className="text-[13px] leading-relaxed text-app-muted">
            这是执行该判断后的空间结构变化，不是比赛结果预测。
          </p>
          <div className="pt-2">{nextButton}</div>
        </div>
      </div>

      {/* mobile：地图优先 */}
      <div className="flex flex-col gap-6 py-6 lg:hidden">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-app-muted">你的最终方案</p>
          <h1 className="text-2xl font-semibold leading-[1.28] text-app-text">
            <span className="text-app-user">Call {finalCall}</span> 的空间意义
          </h1>
        </div>
        {map}
        <p className="text-[13px] leading-relaxed text-app-muted">
          这是执行该判断后的空间结构变化，不是比赛结果预测。
        </p>
        <div className="pt-2">{nextButton}</div>
      </div>
    </PageFrame>
  );
}
