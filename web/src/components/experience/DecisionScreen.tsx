import type { CallId, ReasonId, Scenario } from "@/domain/types";

type DecisionScreenProps = {
  scenario: Scenario;
  initialCall: CallId | null;
  reasonIds: ReasonId[];
  onSelectCall: (call: CallId) => void;
  onToggleReason: (reason: ReasonId) => void;
  onLock: () => void;
};

export function DecisionScreen({
  scenario,
  initialCall,
  reasonIds,
  onSelectCall,
  onToggleReason,
  onLock,
}: DecisionScreenProps) {
  const canSubmit =
    initialCall !== null && reasonIds.length >= 1 && reasonIds.length <= 2;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6">
      <header className="border-b border-app-line py-4">
        <h1 className="text-[15px] font-medium text-app-text">
          你的初始判断
        </h1>
        <p className="mt-0.5 text-[13px] text-app-muted">
          先独立选择方案，再选择你的判断依据（1–2 项）。
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-7 py-6">
        <fieldset>
          <legend className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">
            方案
          </legend>
          <div className="flex flex-col gap-2">
            {scenario.calls.map((call) => {
              const selected = initialCall === call.id;
              return (
                <button
                  key={call.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectCall(call.id)}
                  className={`flex min-h-14 flex-col gap-1 rounded-md border px-4 py-3 text-left transition-colors ${
                    selected
                      ? "border-app-accent bg-app-accent/10"
                      : "border-app-line bg-app-surface hover:border-app-line/70"
                  }`}
                >
                  <span
                    className={`font-mono text-[11px] uppercase tracking-wider ${
                      selected ? "text-app-accent" : "text-app-muted"
                    }`}
                  >
                    Call {call.id}
                  </span>
                  <span className="text-[15px] font-medium text-app-text">
                    {call.label}
                  </span>
                  <span className="text-[13px] leading-relaxed text-app-muted">
                    {call.description}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">
            判断依据 · {reasonIds.length}/2
          </legend>
          <div className="flex flex-wrap gap-2">
            {scenario.reasonOptions.map((reason) => {
              const selected = reasonIds.includes(reason.id);
              const atLimit = reasonIds.length >= 2 && !selected;
              return (
                <button
                  key={reason.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={atLimit}
                  onClick={() => onToggleReason(reason.id)}
                  className={`min-h-11 rounded-full border px-4 text-[13px] transition-colors disabled:cursor-not-allowed ${
                    selected
                      ? "border-app-accent bg-app-accent text-[#16130c]"
                      : atLimit
                        ? "border-app-line bg-transparent text-app-muted/60"
                        : "border-app-line bg-app-surface text-app-text hover:border-app-line/70"
                  }`}
                >
                  {reason.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="py-6">
        <button
          type="button"
          onClick={onLock}
          disabled={!canSubmit}
          className="h-12 w-full rounded-md bg-app-accent text-[15px] font-medium text-[#16130c] transition-colors hover:bg-[#ebba79] disabled:cursor-not-allowed disabled:border disabled:border-app-line disabled:bg-transparent disabled:text-app-muted/50"
        >
          锁定初始判断
        </button>
        {!canSubmit && (
          <p className="mt-2 text-center font-mono text-[11px] text-app-muted">
            需要选择 Call 与 1–2 项依据
          </p>
        )}
      </div>
    </div>
  );
}