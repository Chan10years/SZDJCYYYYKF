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
 * 不显示当前 Call 路线 / AI 替代 / 职业路径 / 后续击杀 / 防守轮转 / 胜率。
 * situation-hero 为氛围视觉，不替代判断地图。
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

  const facts = (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] font-semibold text-app-text">已知信息</p>
      <ul className="flex flex-col gap-3">
        {scenario.situation.facts.map((fact) => (
          <li key={fact.label} className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-app-text">
              {fact.label}
            </span>
            <span className="text-[13px] leading-relaxed text-app-muted">
              {fact.detail}
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
      className="h-12 rounded-md bg-app-text text-[15px] font-medium text-app-bg transition-colors hover:opacity-90"
    >
      开始判断
    </button>
  );

  return (
    <PageFrame family="spatial" eyebrow={`0${round + 1} · 局势`}>
      {/* desktop ≥lg：左地图 + 右局势栏，充分用宽 */}
      <div className="hidden gap-12 py-8 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          {metadata}
          {situationMap}
        </div>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-app-muted">{scenario.purpose}</p>
            <h1 className="text-2xl font-semibold leading-[1.28] text-app-text">
              {scenario.title}
            </h1>
          </div>
          {/* 氛围视觉图：不替代判断地图，仅作页面视觉元素 */}
          <MediaViewport className="overflow-hidden">
            <Image
              src="/media/visual/situation-hero.png"
              alt=""
              width={640}
              height={360}
              className="block h-auto w-full"
            />
          </MediaViewport>
          {facts}
          <div className="pt-2">{beginButton}</div>
        </div>
      </div>

      {/* mobile：地图可读优先，再显示事实 */}
      <div className="flex flex-col gap-6 py-6 lg:hidden">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-app-muted">{scenario.purpose}</p>
          <h1 className="text-2xl font-semibold leading-[1.28] text-app-text">
            {scenario.title}
          </h1>
        </div>
        <div className="flex flex-col gap-3">
          {metadata}
          {situationMap}
        </div>
        {facts}
        <div className="pt-2">{beginButton}</div>
      </div>
    </PageFrame>
  );
}
