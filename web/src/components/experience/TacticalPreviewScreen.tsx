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
 * 战术空间预览：地图是全页第一视觉对象，面积明显压过一切文字。
 * 表达“如果执行这个判断，空间结构如何变化”，与局势页的“现在是什么局面”语义分开。
 * legend 压图、定性指标为轻量底部信息；CTA 弱化，不抢地图。
 */
export function TacticalPreviewScreen({
  scenario,
  finalCall,
  onNext,
}: TacticalPreviewScreenProps) {
  const map = <TacticalPreview scenario={scenario} call={finalCall} animate />;

  const titleBlock = (
    <div className="flex flex-col gap-1">
      <p className="text-[12px] text-app-muted">你的最终方案</p>
      <h1 className="text-xl font-semibold leading-[1.28] text-app-text lg:text-2xl">
        <span className="text-app-user">Call {finalCall}</span> 的空间意义
      </h1>
    </div>
  );

  const note = (
    <p className="text-[13px] leading-relaxed text-app-muted">
      这是执行该判断后的空间结构变化，不是比赛结果预测。
    </p>
  );

  const nextButton = (
    <button
      type="button"
      onClick={onNext}
      className="h-11 rounded-md bg-app-text px-8 text-[14px] font-medium text-app-bg transition-colors hover:opacity-90"
    >
      {scenario.verified ? "查看真实职业路径" : "查看练习路径参考"}
    </button>
  );

  return (
    <PageFrame family="spatial" eyebrow="05 · 战术预览">
      <MetadataStrip
        className="pt-4"
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

      {/* desktop ≥lg：地图大面积左置 + 窄注释列 */}
      <div className="hidden gap-10 py-5 lg:grid lg:grid-cols-[minmax(0,8fr)_minmax(0,3fr)]">
        <div>{map}</div>
        <div className="flex flex-col gap-4 pt-2">
          {titleBlock}
          {note}
          <div className="pt-2">{nextButton}</div>
        </div>
      </div>

      {/* mobile：标题紧凑 + 地图优先 */}
      <div className="flex flex-col gap-4 py-5 lg:hidden">
        {titleBlock}
        {map}
        {note}
        <div className="pt-1">{nextButton}</div>
      </div>
    </PageFrame>
  );
}
