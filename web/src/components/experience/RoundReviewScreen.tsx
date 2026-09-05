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
 * 单局复盘：用户最终判断与职业路径形成真正可理解的对照。
 * 左：用户最终方案地图（数据存在）；右：职业路径文字参考（无核验空间轨迹时不伪造职业路线）。
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

  const userSide = (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] font-medium text-app-user">
        你的最终方案 · Call {finalCall}
      </p>
      <div className="pointer-events-none">
        <TacticalPreview scenario={scenario} call={finalCall} variant="thumb" />
      </div>
      <div>
        <p className="text-base font-semibold text-app-text">
          {finalOption?.label}
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-app-muted">
          {finalOption?.description}
        </p>
      </div>
      {challengeAppliesToFinal ? (
        <>
          <div className="border-t border-app-line pt-3">
            <p className="text-[13px] font-medium text-app-muted">可能风险</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-app-muted">
              {challenge.blindspot}
            </p>
          </div>
          <div className="border-t border-app-line pt-3">
            <p className="text-[13px] font-medium text-app-muted">
              需要再想一次
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-app-muted">
              {challenge.question}
            </p>
          </div>
        </>
      ) : (
        <div className="border-t border-app-line pt-3">
          <p className="text-[13px] font-medium text-app-muted">已调整方案</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-app-muted">
            你已从 Call {initialCall} 改判至 Call {finalCall}。以上为最终方案本身的空间意义；改判后应独立评估该 Call 的利弊。
          </p>
        </div>
      )}
    </div>
  );

  const proSide = (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] font-medium text-app-pro">
        职业路径参考 · Call {pro.call}
      </p>
      <div>
        <p className="text-base font-semibold text-app-text">{pro.pathLabel}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-app-muted">
          {pro.outcome}
        </p>
      </div>
      <ol className="flex flex-col gap-2 border-t border-app-line pt-3">
        {pro.observations.map((obs, i) => (
          <li key={obs} className="flex gap-3">
            <span className="font-mono text-sm tabular-nums text-app-muted">
              {i + 1}
            </span>
            <span className="text-[13px] leading-relaxed text-app-muted">
              {obs}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <PageFrame family="editorial" eyebrow="07 · 单局复盘">
      <header className="pt-6">
        <h1 className="text-2xl font-semibold leading-[1.28] text-app-text">
          你的判断 <span className="text-app-muted">vs</span> 职业路径
        </h1>
        <p className="mt-1 text-[13px] text-app-muted">
          你的方案与历史路径并排对照，不评价对错
        </p>
      </header>

      {/* desktop ≥lg：左右对照，中间竖 rule */}
      <div className="hidden gap-12 py-8 lg:grid lg:grid-cols-2">
        <div className="border-r border-app-line pr-12">{userSide}</div>
        <div>{proSide}</div>
      </div>

      {/* mobile：上下排列，用户侧在前 */}
      <div className="flex flex-col gap-8 py-6 lg:hidden">
        {userSide}
        <div className="border-t border-app-line pt-8">{proSide}</div>
        <div className="pt-2">
          <button
            type="button"
            onClick={onComplete}
            className="h-12 w-full rounded-md bg-app-text text-[15px] font-medium text-app-bg transition-colors hover:opacity-90"
          >
            {primaryLabel}
          </button>
        </div>
      </div>

      {/* desktop CTA */}
      <div className="hidden pb-8 lg:block">
        <button
          type="button"
          onClick={onComplete}
          className="h-12 rounded-md bg-app-text px-12 text-[15px] font-medium text-app-bg transition-colors hover:opacity-90"
        >
          {primaryLabel}
        </button>
      </div>
    </PageFrame>
  );
}
