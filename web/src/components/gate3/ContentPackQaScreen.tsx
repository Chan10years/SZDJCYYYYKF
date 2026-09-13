"use client";

import { useMemo, useState } from "react";
import { MetadataStrip, Num } from "@/components/layout/MetadataStrip";
import { PageFrame } from "@/components/layout/PageFrame";
import {
  CONTENT_QA_CHECK_IDS,
  type RealContentPack,
} from "@/domain/contentPack";

type ContentPackQaScreenProps = {
  pack: RealContentPack;
};

function formatScore(score: Record<string, number>): string {
  return Object.entries(score)
    .map(([team, value]) => `${team} ${value}`)
    .join(" : ");
}

function formatAlive(entry: RealContentPack["entries"][number]): string {
  return (["CT", "T"] as const)
    .map(
      (side) =>
        `${entry.normalizedMatchState.players.filter((player) => player.side === side && player.alive).length}${side}`,
    )
    .join(" / ");
}

/**
 * Review surface for the machine-to-human content boundary. The checkboxes
 * are deliberately local acknowledgements; there is no publish or verify
 * action in this Gate 3 surface.
 */
export function ContentPackQaScreen({ pack }: ContentPackQaScreenProps) {
  const [selectedEntryId, setSelectedEntryId] = useState(pack.entries[0]?.id ?? "");
  const [acknowledgedByEntry, setAcknowledgedByEntry] = useState<Record<string, Set<string>>>({});
  const selectedEntry =
    pack.entries.find((entry) => entry.id === selectedEntryId) ?? pack.entries[0];
  const acknowledged = acknowledgedByEntry[selectedEntry.id] ?? new Set<string>();
  const humanChecks = selectedEntry.qaChecks.filter((check) => check.owner === "human");
  const humanAcknowledged = humanChecks.filter((check) => acknowledged.has(check.id)).length;
  const allHumanChecksAcknowledged = humanAcknowledged === humanChecks.length;
  const mapNames = useMemo(
    () => Array.from(new Set(pack.entries.map((entry) => entry.normalizedMatchState.map.name))),
    [pack.entries],
  );

  function toggleCheck(checkId: string): void {
    setAcknowledgedByEntry((current) => {
      const next = new Set(current[selectedEntry.id] ?? []);
      if (next.has(checkId)) {
        next.delete(checkId);
      } else {
        next.add(checkId);
      }
      return { ...current, [selectedEntry.id]: next };
    });
  }

  return (
    <PageFrame family="spatial" eyebrow="GATE 3 · REAL CONTENT → HUMAN QA">
      <main className="flex flex-col gap-6 py-5 lg:gap-8 lg:py-7">
        <header className="flex flex-col gap-3">
          <MetadataStrip
            items={[
              <span key="entries">
                <Num>{pack.entries.length}</Num> 个真实 snapshot
              </span>,
              <span key="maps">{mapNames.join(" / ").toUpperCase()}</span>,
              <span key="status">全部保持 DRAFT</span>,
            ]}
          />
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-app-muted">
              机器恢复可验证事实；教练决定它是否能成为可信训练内容。
            </p>
            <h1 className="text-2xl font-semibold leading-tight text-app-text lg:text-3xl">
              Real Content Pack · machine facts → Human QA
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-app-muted">
              这个页面没有发布按钮，也不会从 demo 自动生成 Call、Reason、trade-off、路线或职业判断。
              空间标定和训练语义仍必须由人工完成；当前所有条目都停在 draft。
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(220px,3fr)_minmax(0,8fr)] lg:gap-10">
          <nav aria-label="真实 snapshot 列表" className="flex flex-col gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-app-muted">
              Snapshots
            </p>
            <ul className="flex flex-col gap-2">
              {pack.entries.map((entry) => {
                const active = entry.id === selectedEntry.id;
                const state = entry.normalizedMatchState;
                return (
                  <li key={entry.id}>
                    <label
                      className={`flex w-full cursor-pointer gap-3 rounded-md border px-3 py-3 text-left transition-colors ${
                        active
                          ? "border-[#6fb3c9]/60 bg-[#6fb3c9]/10"
                          : "border-app-line bg-app-elevated hover:border-app-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="real-content-snapshot"
                        value={entry.id}
                        checked={active}
                        onChange={() => setSelectedEntryId(entry.id)}
                        aria-label={`${state.map.name} R${state.round.number} · ${state.time.display} · ${state.source.demoFile}`}
                        className="mt-1 h-3.5 w-3.5 shrink-0 accent-[#6fb3c9]"
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm font-medium text-app-text">{state.map.name}</span>
                        <span className="font-mono text-[11px] text-app-muted">
                          R{state.round.number} · {state.time.display} · {state.source.demoFile}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#f0bf7a]">
                          draft
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </nav>

          <section className="flex min-w-0 flex-col gap-5" aria-labelledby="snapshot-heading">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-app-line pb-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-app-muted">
                  {selectedEntry.id}
                </p>
                <h2 id="snapshot-heading" className="mt-2 text-xl font-semibold text-app-text">
                  {selectedEntry.normalizedMatchState.source.match} · {selectedEntry.normalizedMatchState.map.name}
                </h2>
              </div>
              <span className="rounded-full border border-[#dfa45b]/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#f0bf7a]">
                draft · QA required
              </span>
            </div>

            <section aria-labelledby="machine-facts-heading" className="flex flex-col gap-3">
              <div>
                <h3 id="machine-facts-heading" className="text-base font-semibold text-app-text">
                  Machine facts
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-app-muted">
                  这些字段由同一 demoparser2 adapter 从该条真实 demo 恢复；不等于战术结论。
                </p>
              </div>
              <dl className="grid gap-x-5 gap-y-3 border-y border-app-line py-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-app-muted">来源 / SHA</dt>
                  <dd className="mt-1 break-all font-mono text-app-text">
                    {selectedEntry.normalizedMatchState.source.demoFile} · {selectedEntry.normalizedMatchState.source.demoSha256}
                  </dd>
                </div>
                <div>
                  <dt className="text-app-muted">回合 / 时间 / Tick</dt>
                  <dd className="mt-1 font-mono text-app-text">
                    R{selectedEntry.normalizedMatchState.round.number} · {selectedEntry.normalizedMatchState.time.display} · {selectedEntry.normalizedMatchState.tick}
                  </dd>
                </div>
                <div>
                  <dt className="text-app-muted">比分 / 存活</dt>
                  <dd className="mt-1 text-app-text">
                    {formatScore(selectedEntry.normalizedMatchState.round.score)} · {formatAlive(selectedEntry)}
                  </dd>
                </div>
                <div>
                  <dt className="text-app-muted">Bomb</dt>
                  <dd className="mt-1 text-app-text">
                    {selectedEntry.normalizedMatchState.bomb.status}
                    {selectedEntry.normalizedMatchState.bomb.carrierName
                      ? ` · ${selectedEntry.normalizedMatchState.bomb.carrierName}`
                      : ""}
                  </dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="qa-heading" className="flex flex-col gap-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 id="qa-heading" className="text-base font-semibold text-app-text">
                    Human QA boundary
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-app-muted">
                    machine 标记仅说明“已提取”；human 项必须由教练逐项确认。
                  </p>
                </div>
                <span className="font-mono text-xs tabular-nums text-app-muted">
                  {humanAcknowledged}/{humanChecks.length}
                </span>
              </div>
              <ul className="flex flex-col divide-y divide-app-line border-y border-app-line">
                {selectedEntry.qaChecks.map((check) => {
                  const isHuman = check.owner === "human";
                  return (
                    <li key={check.id} className="py-3">
                      <label className={`flex gap-3 ${isHuman ? "cursor-pointer" : ""}`}>
                        <input
                          type="checkbox"
                          checked={isHuman && acknowledged.has(check.id)}
                          disabled={!isHuman}
                          onChange={() => toggleCheck(check.id)}
                          aria-label={`Human QA：${check.label}`}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#dfa45b]"
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-app-text">
                            {check.label}
                            <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${isHuman ? "bg-[#dfa45b]/15 text-[#f0bf7a]" : "bg-[#6fb3c9]/15 text-[#9bd5e5]"}`}>
                              {isHuman ? "human" : "machine"}
                            </span>
                          </span>
                          <span className="text-xs leading-relaxed text-app-muted">{check.evidence}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-col gap-2 rounded-md border border-app-line bg-app-elevated px-3 py-3 text-xs leading-relaxed">
                <span className="font-medium text-app-text">
                  {allHumanChecksAcknowledged
                    ? "本条目的人工作业已在本地逐项勾选"
                    : "尚未完成本条目的 Human QA 勾选"}
                </span>
                <span className="text-app-muted">
                  勾选不会改变条目状态、不会发布内容，也不会把机器坐标变成已核验战术空间。
                </span>
              </div>
            </section>

            <p className="font-mono text-[11px] leading-relaxed text-app-muted">
              QA contract: {CONTENT_QA_CHECK_IDS.length} checks · verificationStatus remains draft · no auto-generated authored semantics
            </p>
          </section>
        </div>
      </main>
    </PageFrame>
  );
}
