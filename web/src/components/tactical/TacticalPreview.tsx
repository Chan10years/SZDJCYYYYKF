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

const LITE2_SCENARIO_ID = "lite2-g2-spirit-mirage-r34";
const LITE2_LETTERBOX_TRANSFORM = "matrix(1 0 0 0.75 0 12.5)";
const STAGED_PHASE_DURATION = 0.95;
const STAGED_EXECUTE_DELAY = 1.35;
const STAGED_ROUTE_STAGGER = 0.08;

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
  const mapOverlayTransform =
    scenario.id === LITE2_SCENARIO_ID ? LITE2_LETTERBOX_TRANSFORM : undefined;
  const movementPhases = spec.movementPhases;
  const firstStageId = movementPhases?.[0]?.id ?? "regroup";
  const secondStageId = movementPhases?.[1]?.id ?? "execute";
  const hasStagedMovement =
    movementPhases?.length === 2 &&
    spec.routes.every(
      (route) =>
        route.phaseBreak !== undefined &&
        route.phaseBreak > 0 &&
        route.phaseBreak < route.points.length - 1,
    );

  return (
    <div className="flex flex-col gap-2.5">
      {variant === "full" && hasStagedMovement && (
        <div
          aria-label={`Call ${call} 两阶段时序`}
          className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-app-line bg-app-elevated px-3 py-2 text-[11px] leading-tight text-app-muted"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6fb3c9]/20 font-mono text-[#9bd5e5]">
              1
            </span>
            <span>{movementPhases[0]?.label}</span>
          </span>
          <span aria-hidden="true" className="text-app-muted">
            →
          </span>
          <span className="flex min-w-0 items-center justify-end gap-2 text-right">
            <span>{movementPhases[1]?.label}</span>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#dfa45b]/20 font-mono text-[#f0bf7a]">
              2
            </span>
          </span>
        </div>
      )}
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
            <>
              <image
                href={scenario.mapBase}
                x={0}
                y={0}
                width={100}
                height={100}
                preserveAspectRatio="xMidYMid meet"
              />
              {scenario.id === LITE2_SCENARIO_ID && (
                <g aria-label="Lite2 修正版图例">
                  <rect
                    x={1}
                    y={74.8}
                    width={36}
                    height={12.5}
                    rx={0.8}
                    fill="#111820"
                    fillOpacity={0.98}
                  />
                  <text x={2.5} y={78.7} fill="#eef1f5" fontSize={1.55}>
                    8 · 带包的进攻队员（C4）
                  </text>
                  <text x={2.5} y={81.7} fill="#eef1f5" fontSize={1.55}>
                    0 / 6 / 7 / 9 · 其他进攻队员
                  </text>
                  <text x={2.5} y={84.7} fill="#98a2b1" fontSize={1.35}>
                    Mirage · Round 34 · 0:40
                  </text>
                </g>
              )}
            </>
          ) : (
            <>
              <rect width="100" height="100" fill="#171a20" />
              <rect width="100" height="100" fill={`url(#${gridId})`} />
            </>
          )}

          {/* Lite2 的 4:3 PNG 在方形 viewBox 中上下留白；routes/zones 使用同一矩阵回到图像坐标。 */}
          <g transform={mapOverlayTransform}>
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
            {spec.routes.map((route, ri) => {
              const phaseBreak = route.phaseBreak ?? 0;
              const isStagedRoute =
                hasStagedMovement &&
                phaseBreak > 0 &&
                phaseBreak < route.points.length - 1;
              const regroupPoints = isStagedRoute
                ? route.points.slice(0, phaseBreak + 1)
                : route.points;
              const executePoints = isStagedRoute
                ? route.points.slice(phaseBreak)
                : [];
              const regroupDelay = STAGED_ROUTE_STAGGER * ri;
              const executeDelay = STAGED_EXECUTE_DELAY + STAGED_ROUTE_STAGGER * ri;

              return (
                <g key={route.playerId}>
                  {isStagedRoute ? (
                    <>
                      {play ? (
                        <motion.path
                          data-stage={firstStageId}
                          d={toPath(regroupPoints)}
                          fill="none"
                          stroke="#6fb3c9"
                          strokeWidth="0.65"
                          strokeDasharray="4 2.5"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{
                            duration: STAGED_PHASE_DURATION,
                            delay: regroupDelay,
                          }}
                        />
                      ) : (
                        <path
                          data-stage={firstStageId}
                          d={toPath(regroupPoints)}
                          fill="none"
                          stroke="#6fb3c9"
                          strokeWidth="0.65"
                          strokeDasharray="4 2.5"
                        />
                      )}
                      {play ? (
                        <motion.path
                          data-stage={secondStageId}
                          d={toPath(executePoints)}
                          fill="none"
                          stroke="#dfa45b"
                          strokeWidth="0.65"
                          strokeDasharray="4 2.5"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{
                            duration: STAGED_PHASE_DURATION,
                            delay: executeDelay,
                          }}
                        />
                      ) : (
                        <path
                          data-stage={secondStageId}
                          d={toPath(executePoints)}
                          fill="none"
                          stroke="#dfa45b"
                          strokeWidth="0.65"
                          strokeDasharray="4 2.5"
                        />
                      )}
                      {regroupPoints.map((p, pi) => (
                        <motion.circle
                          key={`regroup-${pi}`}
                          data-stage={firstStageId}
                          cx={p.x}
                          cy={p.y}
                          r={1.6}
                          fill="#eef1f5"
                          stroke="#6fb3c9"
                          strokeWidth="0.6"
                          initial={play ? { opacity: 0, scale: 0.4 } : undefined}
                          animate={play ? { opacity: 1, scale: 1 } : undefined}
                          transition={{
                            duration: 0.3,
                            delay: regroupDelay + pi * 0.06,
                          }}
                        />
                      ))}
                      {executePoints.slice(1).map((p, pi) => (
                        <motion.circle
                          key={`execute-${pi + 1}`}
                          data-stage={secondStageId}
                          cx={p.x}
                          cy={p.y}
                          r={1.6}
                          fill="#eef1f5"
                          stroke="#dfa45b"
                          strokeWidth="0.6"
                          initial={play ? { opacity: 0, scale: 0.4 } : undefined}
                          animate={play ? { opacity: 1, scale: 1 } : undefined}
                          transition={{
                            duration: 0.3,
                            delay: executeDelay + pi * 0.06,
                          }}
                        />
                      ))}
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </g>
              );
            })}
          </g>
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
