"use client";

import { useState } from "react";
import type { Scenario } from "@/domain/types";

type ProfessionalReferenceScreenProps = {
  scenario: Scenario;
  onNext: () => void;
};

export function ProfessionalReferenceScreen({
  scenario,
  onNext,
}: ProfessionalReferenceScreenProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const pro = scenario.professional;
  const showVideo = !!pro.clipSrc && !videoFailed;
  const verified = scenario.verified;
  // 未核验（Practice Fixture）时，不得使用“真实比赛”“历史上真实发生”等措辞。
  const title = verified ? "真实职业路径" : "练习路径参考";
  const subtitle = verified
    ? "历史上真实发生的一条职业路径，仅供参考"
    : "Practice Reference · 尚未进行正式比赛核验";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6">
      <header className="border-b border-app-line py-4">
        <h1 className="text-[15px] font-medium text-app-text">{title}</h1>
        <p className="mt-0.5 text-[13px] text-app-muted">{subtitle}</p>
      </header>

      <div className="flex flex-1 flex-col gap-6 py-6">
        {showVideo && (
          <video
            src={pro.clipSrc}
            controls
            playsInline
            preload="metadata"
            onError={() => setVideoFailed(true)}
            className="aspect-video w-full rounded-lg border border-app-line bg-black"
          />
        )}

        <section className="flex flex-col gap-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">
            实际路径
          </p>
          <p className="text-[15px] font-medium leading-relaxed text-app-text">
            {pro.pathLabel}
          </p>
        </section>

        <section className="flex flex-col gap-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">
            历史结果
          </p>
          <p className="text-[14px] leading-relaxed text-app-muted">
            {pro.outcome}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">
            观察点
          </p>
          <ul className="flex flex-col gap-2">
            {pro.observations.map((obs) => (
              <li
                key={obs}
                className="rounded-md border border-app-line bg-app-surface px-4 py-3 text-[14px] leading-relaxed text-app-muted"
              >
                {obs}
              </li>
            ))}
          </ul>
        </section>

        <p className="rounded-lg border border-app-line bg-app-surface px-4 py-3 text-[13px] leading-relaxed text-app-muted">
          {verified
            ? "这是历史上真实发生的一条职业路径，不是唯一正确答案。"
            : "这是一条练习参考路径，尚未进行正式比赛核验，不是唯一正确答案。"}
        </p>
      </div>

      <div className="py-6">
        <button
          type="button"
          onClick={onNext}
          className="h-12 w-full rounded-md bg-app-accent text-[15px] font-medium text-[#16130c] transition-colors hover:bg-[#ebba79]"
        >
          查看本局复盘
        </button>
      </div>
    </div>
  );
}