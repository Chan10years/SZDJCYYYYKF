"use client";

import type { CallId, ChallengeOutput, Scenario } from "@/domain/types";
import { TacticalPreview } from "@/components/tactical/TacticalPreview";
import { PageFrame } from "@/components/layout/PageFrame";

type RoundReviewScreenProps = {
  scenario: Scenario;
  initialCall: CallId;
  finalCall: CallId;
  challenge: ChallengeOutput;
  primaryLabel: string;
  onComplete: () => void;
};

/**
 * 单局复盘：用户最终判断与职业路径是两个明显对照的区域。
 * 用户侧有最终方案地图（数据存在）；职业侧用文字/关键观察结构（不伪造职业路线地图）。
 * 对照靠细线、对齐与并列标题建立，不用两张同规格大卡片。
 * 注意：AI Challenge 只针对当时的 Initial Call。只有用户坚持原判断时，
 * 该 Challenge 才属于这个最终方案；改判后不能冒充成新 Final Call 的风险。
 */
export function RoundReviewScreen({
  scenario,
  initialCall,
  finalCall,
  challenge,
  primaryLabel,
  onComplete,
}: RoundReviewScreenProps) {
  const finalOption = scenario.calls.find((c) => c.id === finalCall);
  const challengeAppliesToFinal = finalCall === initialCall;
  const pro = scenario.professional;

  const userLabel = (
    <p className="text-[12px] font-medium text-app-user">
      你的最终方案 · Call {finalCall}
    </p>
  );

  const proLabel = (
    <p className="text-[12px] font-medium text-app-pro">
      职业路径参考 · Call {pro.call}
    </p>
  );

  const userMap = (
    <div className="pointer-events-none w-full max-w-[300px]">
      <TacticalPreview scenario={scenario} call={finalCall} variant="thumb" />
    </div>
  );

  const userSummary = (
    <div>
      <p className="text-[14px] font-semibold text-app-text">
        {finalOption?.label}
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-app-muted">
        {finalOption?.description}
      </p>
    </div>
  );

  const proSummary = (
    <div>
      <p className="text-[14px] font-semibold text-app-text">{pro.pathLabel}</p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-app-muted">
        {pro.outcome}
      </p>
    </div>
  );

  const userAftermath = challengeAppliesToFinal ? (
    <>
      <div className="border-t border-app-line pt-3">
        <p className="text-[12px] font-medium text-app-muted">可能风险</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-app-muted">
          {challenge.blindspot}
        </p>
      </div>
      <div className="border-t border-app-line pt-3">
        <p className="text-[12px] font-medium text-app-muted">需要再想一次</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-app-muted">
          {challenge.question}
        </p>
      </div>
    </>
  ) : (
    <div className="border-t border-app-line pt-3">
      <p className="text-[12px] font-medium text-app-muted">已调整方案</p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-app-muted">
        你已从 Call {initialCall} 改判至 Call {finalCall}。以上为最终方案本身的空间意义；改判后应独立评估该
        Call 的利弊。
      </p>
    </div>
  );

  const proObservations = (
    <ol className="flex flex-col gap-2 border-t border-app-line pt-3">
      {pro.observations.map((obs, i) => (
        <li key={obs} className="flex gap-3">
          <span className="w-4 shrink-0 font-mono text-[13px] tabular-nums text-app-muted">
            {i + 1}
          </span>
          <span className="text-[13px] leading-relaxed text-app-muted">
            {obs}
          </span>
        </li>
      ))}
    </ol>
  );

  const userSide = (
    <div className="flex flex-col gap-4">
      {userLabel}
      {userMap}
      {userSummary}
      {userAftermath}
    </div>
  );

  const proSide = (
    <div className="flex flex-col gap-4">
      {proLabel}
      {proSummary}
      {proObservations}
    </div>
  );

  const completeButton = (className: string) => (
    <button
      type="button"
      onClick={onComplete}
      className={`h-12 rounded-md bg-app-text text-[15px] font-medium text-app-bg transition-colors hover:opacity-90 ${className}`}
    >
      {primaryLabel}
    </button>
  );

  return (
    <PageFrame family="editorial" eyebrow="07 · 单局复盘">
      <header className="pt-4">
        <h1 className="text-xl font-semibold leading-[1.28] text-app-text lg:text-2xl">
          你的判断 <span className="text-app-muted">vs</span> 职业路径
        </h1>
        <p className="mt-1 text-[13px] text-app-muted">
          同一局面，不同处理。并排对照，不评价对错。
        </p>
      </header>

      {/* desktop ≥lg：左右对照，中间竖 rule */}
      <div className="hidden gap-12 py-6 lg:grid lg:grid-cols-2">
        <div className="border-r border-app-line pr-12">{userSide}</div>
        <div>{proSide}</div>
      </div>

      {/* mobile：上方两列对照区（用户地图 | 职业内容），下方各自细节 */}
      <div className="flex flex-col gap-5 py-5 lg:hidden">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            {userLabel}
            {userMap}
          </div>
          <div className="flex flex-col gap-3 border-l border-app-line pl-4">
            {proLabel}
            {proSummary}
          </div>
        </div>
        {userSummary}
        {userAftermath}
        {proObservations}
        <div className="pt-1">{completeButton("w-full")}</div>
      </div>

      {/* desktop CTA */}
      <div className="hidden pb-8 lg:block">
        {completeButton("px-12")}
      </div>
    </PageFrame>
  );
}
