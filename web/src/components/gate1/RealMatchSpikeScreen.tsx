import type { CurrentStatePreviewData } from "@/domain/currentStatePreview";
import type { Scenario } from "@/domain/types";
import { MetadataStrip, Num } from "@/components/layout/MetadataStrip";
import { PageFrame } from "@/components/layout/PageFrame";
import { TacticalPreview } from "@/components/tactical/TacticalPreview";

type RealMatchSpikeScreenProps = {
  scenario: Scenario;
  currentState: CurrentStatePreviewData;
};

export function RealMatchSpikeScreen({
  scenario,
  currentState,
}: RealMatchSpikeScreenProps) {
  const aliveCount = currentState.players.filter((player) => player.alive).length;

  return (
    <PageFrame family="spatial" eyebrow="GATE 1 · REAL MATCH STATE">
      <main className="flex flex-col gap-6 py-6 lg:gap-8">
        <header className="flex flex-col gap-2">
          <MetadataStrip
            items={[
              <span key="match">G2 vs TEAM SPIRIT</span>,
              <span key="map">MIRAGE</span>,
              <span key="round">
                ROUND <Num>{currentState.round}</Num>
              </span>,
              <span key="time">
                <Num>{currentState.timeLabel}</Num>
              </span>,
              <span key="score">
                <Num>{currentState.score.G2}:{currentState.score["Team Spirit"]}</Num>
              </span>,
            ]}
          />
          <h1 className="text-2xl font-semibold leading-tight text-app-text lg:text-3xl">
            真实比赛状态：Round {currentState.round} / {currentState.timeLabel}
          </h1>
          <p className="max-w-3xl text-[13px] leading-relaxed text-app-muted">
            这是来自真实 .dem 的静态截点，用于验证数据能进入现有 Tactical Preview；它表达“此刻发生了什么”，不表达任何 Call 的执行路线。
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:items-start lg:gap-12">
          <section aria-label="Real match tactical map" className="min-w-0">
            <TacticalPreview
              scenario={scenario}
              call="A"
              currentState={currentState}
              variant="full"
            />
          </section>

          <aside className="flex min-w-0 flex-col gap-6 lg:pt-8">
            <section className="flex flex-col gap-3" aria-labelledby="snapshot-heading">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="snapshot-heading" className="text-base font-semibold text-app-text">
                  截点审计
                </h2>
                <span className="font-mono text-[11px] text-app-muted">
                  Tick {currentState.tick}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-app-line py-3 text-[13px]">
                <div>
                  <dt className="text-app-muted">存活状态</dt>
                  <dd className="mt-1 font-mono tabular-nums text-app-text">
                    {aliveCount}/10 · 5v5
                  </dd>
                </div>
                <div>
                  <dt className="text-app-muted">Round clock</dt>
                  <dd className="mt-1 font-mono tabular-nums text-app-text">
                    {currentState.timeLabel} remaining
                  </dd>
                </div>
                <div>
                  <dt className="text-app-muted">Round identity</dt>
                  <dd className="mt-1 font-mono tabular-nums text-app-text">
                    R{currentState.round} / parser {currentState.parserRound}
                  </dd>
                </div>
                <div>
                  <dt className="text-app-muted">Bomb</dt>
                  <dd className="mt-1 text-app-text">
                    {currentState.bomb.status === "carried"
                      ? `C4 · ${currentState.bomb.carrierName}`
                      : currentState.bomb.status}
                  </dd>
                </div>
              </dl>
              <p className="text-xs leading-relaxed text-app-muted">
                Bomb carrier is derived from the ordered event fold through the target tick. Team names are fixed only by the verified target roster.
              </p>
            </section>

            <section aria-labelledby="players-heading" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="players-heading" className="text-base font-semibold text-app-text">
                  10 名真实玩家
                </h2>
                <span className="text-[11px] text-app-muted">identity / HP / weapon</span>
              </div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {currentState.players.map((player) => (
                  <li
                    key={player.id}
                    data-gate1-player={player.id}
                    className="flex min-w-0 items-start justify-between gap-3 border-b border-app-line/70 pb-2 text-[12px]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                          player.side === "CT" ? "bg-[#6fb3c9]" : "bg-[#dfa45b]"
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-app-text">
                          {player.name}
                        </span>
                        <span className="block truncate text-app-muted">
                          {player.team} · {player.place ?? "place unavailable"}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right font-mono tabular-nums text-app-muted">
                      <span className="block text-app-text">HP {player.health}</span>
                      <span className="block">{player.weapon ?? "weapon unavailable"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-2 border-t border-app-line pt-4" aria-labelledby="provenance-heading">
              <h2 id="provenance-heading" className="text-sm font-semibold text-app-text">
                Provenance
              </h2>
              <p className="break-words text-xs leading-relaxed text-app-muted">
                {currentState.source.demoFile} · demoparser2 {currentState.source.parserVersion}
              </p>
              <p className="text-xs leading-relaxed text-app-muted">
                Extraction status: draft · Human QA required. Existing authored Scenario / Second Coach semantics remain separate.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </PageFrame>
  );
}
