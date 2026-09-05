"use client";

import { motion } from "framer-motion";
import type { CallId, ChallengeOutput, ReasonId, Scenario } from "@/domain/types";
import { PageFrame } from "@/components/layout/PageFrame";

type ChallengeScreenProps = {
  scenario: Scenario;
  initialCall: CallId;
  reasonIds: ReasonId[];
  challenge: ChallengeOutput | null;
  onKeep: () => void;
  onAccept: () => void;
};

const isDev = process.env.NODE_ENV === "development";

/**
 * AI 第二意见：用户判断锚点常驻，AI 以编辑批注体接入。
 * Desktop 左右双栏（User | AI）表达 Connection；mobile 纵向 User → AI → Final。
 * 保持 / 调整两个最终操作视觉完全平权，且紧跟内容，不推到底部。
 */
export function ChallengeScreen({
  scenario,
  initialCall,
  reasonIds,
  challenge,
  onKeep,
  onAccept,
}: ChallengeScreenProps) {
  const callOption = scenario.calls.find((c) => c.id === initialCall);
  const reasonLabels = reasonIds
    .map(
      (id) =>
        scenario.reasonOptions.find((r) => r.id === id)?.label ?? id,
    )
    .join(" · ");
  const alternative = challenge?.alternativeCall ?? null;

  const anchor = (
    <div className="border-l-2 border-app-user py-1 pl-4">
      <p className="text-base font-semibold leading-snug text-app-text">
        你的判断&nbsp;&nbsp;{initialCall} · {callOption?.label}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-app-muted">
        依据：{reasonLabels}
      </p>
    </div>
  );

  const controls = (
    <div className="mt-8">
      {alternative !== null ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onKeep}
            className="h-12 rounded-md border border-app-line text-[15px] font-medium text-app-text transition-colors hover:border-app-muted"
          >
            保持 {initialCall}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="h-12 rounded-md border border-app-line text-[15px] font-medium text-app-text transition-colors hover:border-app-muted"
          >
            调整为 {alternative}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onKeep}
          className="h-12 rounded-md border border-app-line px-8 text-[15px] font-medium text-app-text transition-colors hover:border-app-muted"
        >
          继续
        </button>
      )}
    </div>
  );

  const opinion = challenge === null ? (
    <div className="flex flex-col gap-3 py-8">
      <p className="text-[15px] text-app-text">AI 正在读取你的判断……</p>
      <p className="font-mono text-xs tabular-nums text-app-muted">
        基于你的 Call 与依据，正在生成第二意见
      </p>
    </div>
  ) : (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col"
    >
      <p className="text-xs font-medium text-app-ai">
        AI 第二意见
        {isDev ? (
          <span className="ml-2 font-mono tabular-nums text-app-muted">
            source: {challenge.source}
          </span>
        ) : null}
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <p className="text-[15px] leading-[1.7] text-app-text">
          {challenge.acknowledge}
        </p>
        <p className="text-[15px] leading-[1.7] text-app-text">
          {challenge.blindspot}
        </p>
      </div>

      {/* question 是本页视觉重心：独立成段 + 提字重，无卡片 */}
      <p className="mt-8 text-base font-medium leading-[1.6] text-app-text">
        {challenge.question}
      </p>

      <p className="mt-8 text-[13px] leading-relaxed text-app-muted">
        基于这一点，你会保持原判断，还是调整？
      </p>

      {controls}
    </motion.div>
  );

  return (
    <PageFrame family="decision" eyebrow="04 · 第二意见">
      {/* desktop ≥lg：左锚点 | 右 AI 流，左右空间关系表达 Connection */}
      <div className="hidden gap-12 py-10 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>{anchor}</div>
        <div>{opinion}</div>
      </div>

      {/* mobile：纵向 User → AI → Final，小型连接符保留 */}
      <div className="flex flex-col py-6 lg:hidden">
        {anchor}
        <p className="my-6 text-app-muted" aria-hidden="true">
          ↓
        </p>
        {opinion}
      </div>
    </PageFrame>
  );
}
