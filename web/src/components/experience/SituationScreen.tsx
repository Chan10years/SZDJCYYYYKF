import type { Scenario } from "@/domain/types";
import { PageFrame } from "@/components/layout/PageFrame";
import { MetadataStrip, Num } from "@/components/layout/MetadataStrip";
import { MediaViewport } from "@/components/layout/MediaViewport";
import { getScenarioStatusCopy } from "@/domain/scenarioStatus";

/* The map asset must remain a plain image so the shared SVG/PNG source stays inspectable. */
/* eslint-disable @next/next/no-img-element */

type SituationScreenProps = {
  scenario: Scenario;
  round: number;
  totalRounds: number;
  onBegin: () => void;
};

/**
 * 局势页（P0）：用户进入 Decision 前必须先看到当前决策时刻的地图。
 * 地图是判断基础信息，不是装饰 —— 表达“现在是什么局面”。
 * 决策页只展示当前时间点的地图与事实，不复用带有其他回合 HUD 的氛围素材。
 * Desktop 为宽屏 Spatial 构图：左主视觉区（判断地图），右局势栏。
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
        <div className="relative">
          <img
            src={scenario.mapBase}
            alt={`${scenario.source.map} 当前局势地图`}
            className="block h-auto w-full"
          />
          {scenario.id === "lite2-g2-spirit-mirage-r34" && (
            <div
              aria-label="Lite2 修正版图例"
              className="pointer-events-none absolute bottom-0 left-0 flex h-[18%] min-h-[72px] w-[42%] min-w-[165px] flex-col justify-center rounded-none bg-[#111820]/98 px-2 py-1.5 text-[9px] leading-[1.35] text-app-text/90 shadow-lg"
            >
              <div>8 · 带包的进攻队员（C4）</div>
              <div>0 / 6 / 7 / 9 · 其他进攻队员</div>
              <div className="text-app-muted">Mirage · Round 34 · 0:40</div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex aspect-square items-center justify-center text-[13px] text-app-muted">
          当前局势地图待接入
        </div>
      )}
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
        {getScenarioStatusCopy(scenario.verificationStatus).situationSuffix}
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
      {/* desktop ≥lg：左主视觉区（判断地图）| 右局势栏 */}
      <div className="hidden gap-12 py-6 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <div className="flex flex-col gap-3">
          {metadata}
          {situationMap}
        </div>
        <div className="flex flex-col gap-5 pt-7">
          {titleBlock}
          {facts}
          <div className="pt-1">{beginButton}</div>
        </div>
      </div>

      {/* mobile：紧凑标题/比赛信息 → 判断地图 → 已知信息 → 开始判断 */}
      <div className="flex flex-col gap-4 py-5 lg:hidden">
        <div className="flex flex-col gap-2">
          {titleBlock}
          {metadata}
        </div>
        {situationMap}
        {facts}
        <div className="pt-1">{beginButton}</div>
      </div>
    </PageFrame>
  );
}
