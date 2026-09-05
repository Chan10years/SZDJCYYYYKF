import type { Scenario } from "@/domain/types";

type SituationScreenProps = {
  scenario: Scenario;
  round: number;
  totalRounds: number;
  onBegin: () => void;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-[13px] text-app-muted">{label}</dt>
      <dd className="text-right text-[14px] text-app-text">{value}</dd>
    </div>
  );
}

export function SituationScreen({
  scenario,
  round,
  totalRounds,
  onBegin,
}: SituationScreenProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6">
      <header className="flex items-center justify-between border-b border-app-line py-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">
          Round {round} / {totalRounds}
        </span>
        {!scenario.verified && (
          <span className="rounded border border-app-accent/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-app-accent">
            Practice Fixture
          </span>
        )}
      </header>

      <div className="flex flex-1 flex-col justify-center gap-7 py-8">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-app-muted">{scenario.purpose}</p>
          <h1 className="text-2xl font-medium leading-tight tracking-tight text-app-text">
            {scenario.title}
          </h1>
        </div>

        <dl className="rounded-lg border border-app-line bg-app-surface px-4 py-3">
          <Field label="时间" value={scenario.situation.time} />
          <Field label="存活人数" value={scenario.situation.alive} />
          <Field label="目标" value={scenario.situation.objective} />
        </dl>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-app-line" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-app-muted">
              局势事实
            </span>
          </div>
          <ul className="flex flex-col gap-2">
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
        </div>

        <p className="font-mono text-[11px] text-app-muted">
          {scenario.source.event} · {scenario.source.map} · R{scenario.source.round}
        </p>
      </div>

      <div className="py-6">
        <button
          type="button"
          onClick={onBegin}
          className="h-12 w-full rounded-md bg-app-accent text-[15px] font-medium text-[#16130c] transition-colors hover:bg-[#ebba79]"
        >
          开始判断
        </button>
      </div>
    </div>
  );
}