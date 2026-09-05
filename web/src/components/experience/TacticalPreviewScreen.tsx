"use client";

import type { CallId, Scenario } from "@/domain/types";
import { TacticalPreview } from "@/components/tactical/TacticalPreview";

type TacticalPreviewScreenProps = {
  scenario: Scenario;
  finalCall: CallId;
  onNext: () => void;
};

export function TacticalPreviewScreen({
  scenario,
  finalCall,
  onNext,
}: TacticalPreviewScreenProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6">
      <header className="flex items-baseline justify-between border-b border-app-line py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-app-muted">
            你的最终方案
          </p>
          <h1 className="text-[15px] font-medium text-app-text">
            战术空间预览
          </h1>
        </div>
        <span className="rounded border border-app-accent/50 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-app-accent">
          Call {finalCall}
        </span>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-5 py-6">
        <TacticalPreview scenario={scenario} call={finalCall} animate />
      </div>

      <div className="py-6">
        <button
          type="button"
          onClick={onNext}
          className="h-12 w-full rounded-md bg-app-accent text-[15px] font-medium text-[#16130c] transition-colors hover:bg-[#ebba79]"
        >
          查看真实职业路径
        </button>
      </div>
    </div>
  );
}