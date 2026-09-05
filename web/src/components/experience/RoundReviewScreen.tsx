"use client";

import type { CallId, ChallengeOutput, Scenario } from "@/domain/types";

type RoundReviewScreenProps = {
  scenario: Scenario;
  finalCall: CallId;
  challenge: ChallengeOutput;
  primaryLabel: string;
  onComplete: () => void;
};

/**
 * 单局复盘：用户最终方案 与 职业路径 并列，不做对错判断。
 */
export function RoundReviewScreen({
  scenario,
  finalCall,
  challenge,
  primaryLabel,
  onComplete,
}: RoundReviewScreenProps) {
  const finalOption = scenario.calls.find((c) => c.id === finalCall);
  const pro = scenario.professional;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6">
      <header className="border-b border-app-line py-4">
        <h1 className="text-[15px] font-medium text-app-text">本局复盘</h1>
        <p className="mt-0.5 text-[13px] text-app-muted">
          你的方案与历史路径并排对照，不评价对错
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-5 py-6">
        <section className="flex flex-col gap-3 rounded-lg border border-app-line bg-app-surface px-4 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">
            你的最终方案 · Call {finalCall}
          </p>
          <div>
            <p className="text-[15px] font-medium text-app-text">
              {finalOption?.label}
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-app-muted">
              {finalOption?.description}
            </p>
          </div>
          <div className="border-t border-app-line pt-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-app-muted">
              可能风险
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-app-muted">
              {challenge.blindspot}
            </p>
          </div>
          <div className="border-t border-app-line pt-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-app-muted">
              需要再想一次
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-app-muted">
              {challenge.question}
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-app-line bg-app-elevated px-4 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-app-info">
            职业路径参考 · Call {pro.call}
          </p>
          <div>
            <p className="text-[15px] font-medium text-app-text">
              {pro.pathLabel}
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-app-muted">
              {pro.outcome}
            </p>
          </div>
          <ul className="flex flex-col gap-1.5 border-t border-app-line pt-3">
            {pro.observations.map((obs) => (
              <li
                key={obs}
                className="text-[13px] leading-relaxed text-app-muted"
              >
                · {obs}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="py-6">
        <button
          type="button"
          onClick={onComplete}
          className="h-12 w-full rounded-md bg-app-accent text-[15px] font-medium text-[#16130c] transition-colors hover:bg-[#ebba79]"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}