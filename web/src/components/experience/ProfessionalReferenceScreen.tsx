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
 * 职业路径参考：editorial case study，不是后台详情卡片堆。
 * 视频是第一视觉对象；observations 用编号编辑式列表；disclaimer 用 fine print。
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] text-app-muted">实际路径</p>
        <p className="text-base font-semibold leading-snug text-app-text">
          {pro.pathLabel}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] text-app-muted">历史结果</p>
        <p className="text-[15px] leading-[1.7] text-app-text">{pro.outcome}</p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[15px] font-semibold text-app-text">关键观察</p>
        <ol className="flex flex-col gap-2.5">
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

      <p className="text-xs leading-relaxed text-app-muted">
        {verified
          ? "这是历史上真实发生的一条职业路径，不是唯一正确答案。"
          : "这是一条练习参考路径，尚未进行正式比赛核验，不是唯一正确答案。"}
      </p>

      <div className="pt-2">
        <button
          type="button"
          onClick={onNext}
          className="h-12 w-full rounded-md bg-app-text text-[15px] font-medium text-app-bg transition-colors hover:opacity-90 sm:w-auto sm:px-10"
        >
          查看本局复盘
        </button>
      </div>
    </div>
  );

  return (
    <PageFrame family="editorial" eyebrow="06 · 职业参考">
      <header className="pt-6">
        <h1 className="text-2xl font-semibold leading-[1.28] text-app-text">
          {title}
        </h1>
        <p className="mt-1 text-[13px] text-app-muted">{subtitle}</p>
      </header>

      {/* desktop ≥lg 且有视频：媒体左 + 分析右 */}
      {media ? (
        <div className="hidden gap-12 py-8 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>{media}</div>
          <div>{analysis}</div>
        </div>
      ) : null}

      {/* mobile 或无视频：单栏 */}
      <div className={`flex flex-col gap-6 py-6 ${media ? "lg:hidden" : ""}`}>
        {media}
        {analysis}
      </div>
    </PageFrame>
  );
}
