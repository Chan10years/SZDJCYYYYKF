import Image from "next/image";
import type { Scenario } from "@/domain/types";
import { PageFrame } from "@/components/layout/PageFrame";
import { MetadataStrip, Num } from "@/components/layout/MetadataStrip";
import { MediaViewport } from "@/components/layout/MediaViewport";

type SituationScreenProps = {
  scenario: Scenario;
  round: number;
  totalRounds: number;
  onBegin: () => void;
};

/**
 * 局势页（P0）：用户进入 Decision 前必须先看到当前决策时刻的地图。
 * 地图是判断基础信息，不是装饰 —— 表达“现在是什么局面”。
 * situation-hero 负责比赛气氛，两者并存、不互相替代。
 * Desktop 为宽屏 Spatial 构图：左主视觉区（氛围 + 判断地图），右局势栏。
 */
export function SituationScreen({
  scenario,
  round,
  totalRounds,
  onBegin,
}: SituationScreenProps) {
  const situationMap = (
    <MediaViewport>
      {scenario.mapBase ? (
        // 判断地图：当前决策时刻空间信息（无路线、无答案暗示）。
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={scenario.mapBase}
          alt={`${scenario.source.map} 当前局势地图`}
          className="block h-auto w-full"
        />
      ) : (
        <div className="flex aspect-square items-center justify-center text-[13px] text-app-muted">
          当前局势地图待接入
        </div>
      )}
    </MediaViewport>
  );

  const atmosphere = (
    <MediaViewport className="relative aspect-[16/8] w-full lg:aspect-[16/7]">
      {/* 氛围视觉图：不替代判断地图，仅作比赛气氛 */}
      <Image
        src="/media/visual/situation-hero.png"
        alt=""
        fill
        sizes="(min-width: 1024px) 620px, 100vw"
        className="object-cover"
      />
    </MediaViewport>
  );

  const metadata = (
    <MetadataStrip
      items={[
        <span key="r">
          ROUND <Num>{round}/{totalRounds}</Num>
        </span>,
        <span key="map">{scenario.source.map.toUpperCase()}</span>,
        <span key="time">
          <Num>{scenario.situation.time}</Num>
        </span>,
        <span key="alive">
          <Num>{scenario.situation.alive}</Num>
        </span>,
        <span key="obj">{scenario.situation.objective}</span>,
      ]}
    />
  );

  const titleBlock = (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] text-app-muted">{scenario.purpose}</p>
      <h1 className="text-xl font-semibold leading-[1.28] text-app-text lg:text-2xl">
        {scenario.title}
      </h1>
    </div>
  );

  // 紧凑事实：每条一行（label + detail 同段），避免“说明文档”纵向堆叠。
  const facts = (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] font-semibold text-app-text">已知信息</p>
      <ul className="flex flex-col gap-2">
        {scenario.situation.facts.map((fact) => (
          <li key={fact.label} className="flex gap-2 text-[13px] leading-relaxed">
            <span aria-hidden="true" className="shrink-0 text-app-muted">
              ·
            </span>
            <span>
              <span className="font-medium text-app-text">{fact.label}</span>
              {"　"}
              <span className="text-app-muted">{fact.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-app-muted">
        {scenario.source.event} · {scenario.source.map} · R{scenario.source.round}
        {scenario.verified ? "" : " · 练习场景 · 未核验"}
      </p>
    </div>
  );

  const beginButton = (
    <button
      type="button"
      onClick={onBegin}
      className="h-12 w-full rounded-md bg-app-text text-[15px] font-medium text-app-bg transition-colors hover:opacity-90"
    >
      开始判断
    </button>
  );

  return (
    <PageFrame family="spatial" eyebrow={`0${round + 1} · 局势`}>
      {/* desktop ≥lg：左主视觉区（氛围 + 判断地图）| 右局势栏 */}
      <div className="hidden gap-12 py-6 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <div className="flex flex-col gap-3">
          {metadata}
          {atmosphere}
          {situationMap}
        </div>
        <div className="flex flex-col gap-5 pt-7">
          {titleBlock}
          {facts}
          <div className="pt-1">{beginButton}</div>
        </div>
      </div>

      {/* mobile：紧凑标题/比赛信息 → 核心视觉 → 判断地图 → 已知信息 → 开始判断 */}
      <div className="flex flex-col gap-4 py-5 lg:hidden">
        <div className="flex flex-col gap-2">
          {titleBlock}
          {metadata}
        </div>
        {atmosphere}
        {situationMap}
        {facts}
        <div className="pt-1">{beginButton}</div>
      </div>
    </PageFrame>
  );
}
