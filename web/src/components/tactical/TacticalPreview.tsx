"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CallId, Scenario } from "@/domain/types";

type TacticalPreviewProps = {
  scenario: Scenario;
  call: CallId;
  animate?: boolean;
  /** full：完整预览（含 legend/metrics/disclaimer）；thumb：Decision 缩略方向图（仅底图+zones+routes）。 */
  variant?: "full" | "thumb";
};

const ZONE_KIND_COLOR: Record<string, string> = {
  pressure: "#dfa45b",
  information: "#6fb3c9",
  risk: "#d06a6c",
};

function toPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) {
    return "";
  }
  const [head, ...rest] = points;
  return rest.reduce(
    (acc, p) => `${acc} L ${p.x} ${p.y}`,
    `M ${head.x} ${head.y}`,
  );
}

/**
 * 单一 Tactical Preview renderer，服务全部 Scenario（A/B/C 由数据驱动）。
 * 只展示 Final Call 的空间意义：路线、玩家标记、压力/信息/风险区、定性标签。
 * 不模拟击杀、不预测胜负或比赛结果。
 */
export function TacticalPreview({
  scenario,
  call,
  animate = false,
  variant = "full",
}: TacticalPreviewProps) {
  const reduce = useReducedMotion();
  const play = animate && !reduce;
  const spec = scenario.previewByCall[call];
  const gridId = `tp-grid-${scenario.id}-${call}`;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative overflow-hidden rounded-lg border border-app-line bg-app-elevated p-1">
        <svg
          viewBox="0 0 100 100"
          className="block h-auto w-full"
          role="img"
          aria-label={`Call ${call} 战术空间预览`}
        >
          <defs>
            <pattern
              id={gridId}
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="#20252d"
                strokeWidth="0.2"
              />
            </pattern>
          </defs>

          {/* 地图底图：真实底图（含已人工核验的编号/阵营标记）或中性战术网格。
              底图负责底层视觉；routes/zones 由 renderer 叠加，不重复绘制编号。 */}
          {scenario.mapBase ? (
            <image
              href={scenario.mapBase}
              x={0}
              y={0}
              width={100}
              height={100}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <>
              <rect width="100" height="100" fill="#171a20" />
              <rect width="100" height="100" fill={`url(#${gridId})`} />
            </>
          )}

          {/* 空间区域 */}
          {spec.zones.map((zone, i) => {
            const color = ZONE_KIND_COLOR[zone.kind] ?? "#98a2b1";
            return (
              <motion.circle
                key={`${zone.kind}-${i}`}
                cx={zone.x}
                cy={zone.y}
                r={zone.radius}
                fill={color}
                fillOpacity={play ? 0 : 0.16}
                initial={play ? { fillOpacity: 0, r: zone.radius * 0.4 } : undefined}
                animate={play ? { fillOpacity: 0.16, r: zone.radius } : undefined}
                transition={{ duration: 0.7, delay: 0.15 * i }}
                stroke={color}
                strokeOpacity={0.35}
              />
            );
          })}

          {/* 路线 + 玩家沿途标记 */}
          {spec.routes.map((route, ri) => (
            <g key={route.playerId}>
              {play ? (
                <motion.path
                  d={toPath(route.points)}
                  fill="none"
                  stroke="#dfa45b"
                  strokeWidth="0.5"
                  strokeDasharray="4 2.5"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, delay: 0.12 * ri }}
                />
              ) : (
                <path
                  d={toPath(route.points)}
                  fill="none"
                  stroke="#dfa45b"
                  strokeWidth="0.5"
                  strokeDasharray="4 2.5"
                />
              )}
              {route.points.map((p, pi) => (
                <motion.circle
                  key={pi}
                  cx={p.x}
                  cy={p.y}
                  r={1.6}
                  fill="#eef1f5"
                  stroke="#dfa45b"
                  strokeWidth="0.6"
                  initial={play ? { opacity: 0, scale: 0.4 } : undefined}
                  animate={play ? { opacity: 1, scale: 1 } : undefined}
                  transition={{ duration: 0.3, delay: 0.12 * ri + pi * 0.06 }}
                />
              ))}
            </g>
          ))}
        </svg>

        {/* 区域标签（thumb 隐藏）：压图左下，轻量底条，不占垂直空间 */}
        {variant === "full" && spec.zones.length > 0 && (
          <p className="absolute bottom-2.5 left-2.5 flex max-w-[85%] flex-wrap items-center gap-x-3 gap-y-1 rounded bg-black/55 px-2 py-1 text-[11px] text-app-text/90 backdrop-blur-[2px]">
            {spec.zones.map((zone, i) => (
              <span key={`${zone.kind}-label-${i}`} className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: ZONE_KIND_COLOR[zone.kind] ?? "#98a2b1",
                  }}
                />
                {zone.label}
              </span>
            ))}
          </p>
        )}
      </div>

      {/* 定性指标（thumb 隐藏）：轻量底部信息，地图压过文字 */}
      {variant === "full" && spec.metrics.length > 0 && (
        <p className="text-[12px] leading-relaxed text-app-muted">
          {spec.metrics.map((m, i) => (
            <span key={m.label}>
              {i > 0 ? " · " : ""}
              {m.label} <span className="text-app-text">{m.value}</span>
            </span>
          ))}
        </p>
      )}

      {variant === "full" && (
        <p className="font-mono text-[11px] text-app-muted">
          战术空间预览 · 非比赛结果预测
        </p>
      )}
    </div>
  );
}