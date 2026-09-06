import type { CallId, ReasonId, Scenario } from "@/domain/types";
import { PageFrame } from "@/components/layout/PageFrame";
import { TacticalPreview } from "@/components/tactical/TacticalPreview";

type DecisionScreenProps = {
  scenario: Scenario;
  initialCall: CallId | null;
  reasonIds: ReasonId[];
  onSelectCall: (call: CallId) => void;
  onToggleReason: (reason: ReasonId) => void;
  onLock: () => void;
};

/**
 * 判断页：A/B/C 是对同一战术空间的三个处理方向，紧凑三行而非巨型卡片。
 * 每行 = 缩略方向图（统一 renderer thumb）+ 字母 chip + 标签/描述。
 * 依据为轻量列表；锁定按钮紧随判断区；不以颜色暗示某 Call 更优。
 */
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

  const callsField = (
    <fieldset>
      <legend className="mb-2 text-[14px] font-semibold text-app-text">
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
              className={`flex min-h-14 items-center gap-3 rounded-md border p-2.5 text-left transition-colors ${
                selected
                  ? "border-app-user bg-app-surface"
                  : "border-app-line bg-transparent hover:border-app-muted"
              }`}
            >
              {/* 缩略方向图：同一 renderer thumb 模式 */}
              <span className="pointer-events-none block w-14 shrink-0 overflow-hidden rounded sm:w-[4.5rem]">
                <TacticalPreview
                  scenario={scenario}
                  call={call.id}
                  variant="thumb"
                />
              </span>
              {/* 字母 chip：中性色，选中才接入 User 色，不暗示优劣 */}
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold ${
                  selected
                    ? "border-app-user text-app-user"
                    : "border-app-line text-app-muted"
                }`}
              >
                {call.id}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={`text-[15px] font-semibold leading-snug ${
                    selected ? "text-app-user" : "text-app-text"
                  }`}
                >
                  {call.label}
                </span>
                <span className="text-[12px] leading-relaxed text-app-muted">
                  {call.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  const reasonsField = (
    <fieldset>
      <legend className="mb-2 text-[14px] font-semibold text-app-text">
        你的主要依据（选 1–2 项）
      </legend>
      <div className="flex flex-col">
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
              className={`flex min-h-10 items-center gap-3 border-b border-app-line/60 px-1 py-1.5 text-left text-[13px] transition-colors last:border-b-0 disabled:cursor-not-allowed ${
                selected
                  ? "text-app-text"
                  : atLimit
                    ? "text-app-muted/50"
                    : "text-app-muted hover:text-app-text"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-sm border ${
                  selected
                    ? "border-app-user bg-app-user"
                    : "border-app-muted/60 bg-transparent"
                }`}
              />
              {reason.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  const lockButton = (
    <div>
      <button
        type="button"
        onClick={onLock}
        disabled={!canSubmit}
        className="h-12 w-full rounded-md bg-app-text text-[15px] font-medium text-app-bg transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:border disabled:border-app-line disabled:bg-transparent disabled:text-app-muted/50"
      >
        锁定初始判断
      </button>
      {!canSubmit && (
        <p className="mt-2 text-center text-xs text-app-muted">
          需要选择 Call 与 1–2 项依据
        </p>
      )}
    </div>
  );

  return (
    <PageFrame family="decision" eyebrow="03 · 判断">
      <h1 className="pt-4 text-xl font-semibold leading-[1.28] text-app-text lg:text-2xl">
        你的判断是什么？
      </h1>
      <p className="mt-1 text-[13px] text-app-muted">
        基于当前局势，选择你认为更合理的处理方向。
      </p>

      {/* desktop ≥lg：左方案 + 右依据/锁定 */}
      <div className="hidden gap-12 py-6 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <div>{callsField}</div>
        <div className="flex flex-col gap-6">
          {reasonsField}
          {lockButton}
        </div>
      </div>

      {/* mobile：纵向紧凑，首屏至少露出两个 Call */}
      <div className="flex flex-col gap-5 py-5 lg:hidden">
        {callsField}
        {reasonsField}
        {lockButton}
      </div>
    </PageFrame>
  );
}
