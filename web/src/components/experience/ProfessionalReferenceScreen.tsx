"use client";

import { useState } from "react";
import type { Scenario } from "@/domain/types";
import { PageFrame } from "@/components/layout/PageFrame";
import { MediaViewport } from "@/components/layout/MediaViewport";

type ProfessionalReferenceScreenProps = {
  scenario: Scenario;
  onNext: () => void;
};

/**
 * 职业路径参考：媒体分析页 —— 视频是第一视觉位，明显大于文字内容。
 * 关键观察用编号结构；历史结果与免责声明降级为编辑式说明。
 * 职业路径是历史参考，不是唯一正确答案；path 与 outcome 分开表达。
 */
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

  const media = showVideo ? (
    <MediaViewport>
      <video
        src={pro.clipSrc}
        controls
        playsInline
        preload="metadata"
        onError={() => setVideoFailed(true)}
        className="aspect-video w-full bg-black"
      />
    </MediaViewport>
  ) : null;

  const analysis = (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-[12px] text-app-muted">实际路径</p>
        <p className="text-[15px] font-semibold leading-snug text-app-text">
          {pro.pathLabel}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-[12px] text-app-muted">历史结果</p>
        <p className="text-[13px] leading-relaxed text-app-muted">
          {pro.outcome}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-[14px] font-semibold text-app-text">关键观察</p>
        <ol className="flex flex-col gap-2.5">
          {pro.observations.map((obs, i) => (
            <li key={obs} className="flex gap-3">
              <span className="w-4 shrink-0 font-mono text-[13px] tabular-nums text-app-muted">
                {i + 1}
              </span>
              <span className="text-[13px] leading-relaxed text-app-text">
                {obs}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-xs leading-relaxed text-app-muted">
        {verified
          ? "这是历史上真实发生的一条职业路径，不是唯一正确答案。"
          : "这是一条练习参考路径，尚未进行正式比赛核验，不是唯一正确答案。"}
      </p>

      <div className="pt-1">
        <button
          type="button"
          onClick={onNext}
          className="h-11 w-full rounded-md bg-app-text text-[14px] font-medium text-app-bg transition-colors hover:opacity-90 sm:w-auto sm:px-10"
        >
          查看本局复盘
        </button>
      </div>
    </div>
  );

  return (
    <PageFrame family="editorial" eyebrow="06 · 职业参考">
      <header className="pt-4">
        <h1 className="text-xl font-semibold leading-[1.28] text-app-text lg:text-2xl">
          {title}
        </h1>
        <p className="mt-1 text-[13px] text-app-muted">{subtitle}</p>
      </header>

      {/* desktop ≥lg 且有视频：视频大画面左 + 分析右 */}
      {media ? (
        <div className="hidden gap-10 py-6 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
          <div>{media}</div>
          <div>{analysis}</div>
        </div>
      ) : null}

      {/* mobile 或无视频：单栏，视频占满有效宽度 */}
      <div className={`flex flex-col gap-5 py-5 ${media ? "lg:hidden" : ""}`}>
        {media}
        {analysis}
      </div>
    </PageFrame>
  );
}
