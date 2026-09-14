"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { MetadataStrip, Num } from "@/components/layout/MetadataStrip";
import { PageFrame } from "@/components/layout/PageFrame";
import { ExperienceShell } from "@/components/experience/ExperienceShell";
import { buildCurrentStatePreview } from "@/domain/currentStatePreview";
import {
  filterMarkersThroughTick,
  formatDemoClock,
  getSelectableRound,
  type DemoImportInspection,
  type DemoImportRound,
} from "@/domain/demoImport";
import {
  buildScenarioDraft,
  SCENARIO_DRAFT_QA_CHECK_IDS,
  type ScenarioDraft,
} from "@/domain/scenarioDraft";
import {
  buildImportedPracticeScenario,
  type ImportedScenarioAuthoring,
} from "@/domain/importedScenario";
import type { CallId, ReasonId, Scenario } from "@/domain/types";
import {
  DemoImportClient,
  DemoImportCancelledError,
  type DemoImportClientLike,
  type DemoImportLoadResult,
  type DemoImportProgress,
  type DemoImportSelectionResult,
} from "@/lib/demoImportClient";

const CALL_IDS = ["A", "B", "C"] as const;
const REASON_IDS: ReasonId[] = [
  "known_position",
  "unknown_space",
  "time_pressure",
  "numbers_advantage",
  "utility_advantage",
  "resource_preservation",
];

type EditableCall = { label: string; description: string };
type EditableReason = { id: ReasonId; label: string };
type EditableGuidance = {
  blindspot: string;
  question: string;
  alternativeCall: CallId | null;
};

type AuthoringForm = {
  title: string;
  purpose: string;
  trainingFraming: string;
  objectiveFraming: string;
  knownFact: { label: string; detail: string };
  unknownFact: { label: string; detail: string };
  calls: Record<CallId, EditableCall>;
  reasonOptions: EditableReason[];
  challengeGuidance: Record<CallId, EditableGuidance>;
  tacticalNotes: Record<CallId, string>;
  professionalCall: CallId;
  professionalPathLabel: string;
  professionalOutcome: string;
  professionalObservations: [string, string, string];
  useMirageRaster: boolean;
  perspectiveSide: "CT" | "T";
  observableConfirmed: boolean;
  observableBombVisible: boolean;
};

function emptyGuidance(): EditableGuidance {
  return { blindspot: "", question: "", alternativeCall: null };
}

function initialAuthoringForm(): AuthoringForm {
  return {
    title: "",
    purpose: "",
    trainingFraming: "",
    objectiveFraming: "",
    knownFact: { label: "", detail: "" },
    unknownFact: { label: "", detail: "" },
    calls: { A: { label: "", description: "" }, B: { label: "", description: "" }, C: { label: "", description: "" } },
    reasonOptions: [
      { id: "known_position", label: "" },
      { id: "unknown_space", label: "" },
      { id: "time_pressure", label: "" },
    ],
    challengeGuidance: { A: emptyGuidance(), B: emptyGuidance(), C: emptyGuidance() },
    tacticalNotes: { A: "", B: "", C: "" },
    professionalCall: "A",
    professionalPathLabel: "",
    professionalOutcome: "",
    professionalObservations: ["", "", ""],
    useMirageRaster: false,
    perspectiveSide: "T",
    observableConfirmed: false,
    observableBombVisible: false,
  };
}

type DemoImportScreenProps = {
  clientFactory?: (
    onProgress: (progress: DemoImportProgress) => void,
  ) => DemoImportClientLike;
};

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "导入失败，请确认这是完整且受支持的 CS2 .dem 文件。";
}

function estimateRoundClock(round: DemoImportRound, tick: number): string {
  const elapsed = Math.max(0, (tick - round.freezeEndTick) / round.tickrate);
  return formatDemoClock(Math.max(0, round.durationSeconds - elapsed));
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-app-text">
        {label}{required ? "" : "（可选）"}
      </span>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-10 rounded-md border border-app-line bg-transparent px-3 text-[13px] text-app-text outline-none placeholder:text-app-muted/60 focus:border-app-user"
      />
    </label>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = true,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-app-text">
        {label}{required ? "" : "（可选）"}
      </span>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className="resize-y rounded-md border border-app-line bg-transparent px-3 py-2.5 text-[13px] leading-relaxed text-app-text outline-none placeholder:text-app-muted/60 focus:border-app-user"
      />
    </label>
  );
}

function MachineStateSummary({ draft }: { draft: ScenarioDraft }) {
  const state = draft.normalizedMatchState;
  return (
    <section
      aria-labelledby="machine-state-heading"
      className="flex flex-col gap-3 border-y border-app-line py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="machine-state-heading" className="text-base font-semibold text-app-text">
          机器恢复的 Draft 状态
        </h2>
        <span className="rounded-full border border-[#dfa45b]/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#f0bf7a]">
          machine-only · draft
        </span>
      </div>
      <p className="text-xs leading-relaxed text-app-muted">
        以下字段来自 Demo 原生解析或明确标注的派生规则。Call、Reason、Known / Unknown、路线语义与职业参考仍为空，必须由 Human QA 填写。
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs leading-relaxed">
        <dt className="text-app-muted">来源</dt>
        <dd className="break-all text-app-text">{state.source.demoFile}</dd>
        <dt className="text-app-muted">SHA-256</dt>
        <dd className="break-all font-mono text-[10px] text-app-text">{state.source.demoSha256}</dd>
        <dt className="text-app-muted">比赛 / 地图</dt>
        <dd className="text-app-text">{state.source.match} · {state.map.name}</dd>
        <dt className="text-app-muted">Round / Tick</dt>
        <dd className="font-mono tabular-nums text-app-text">{state.round.number} · {state.tick}</dd>
        <dt className="text-app-muted">时间 / 比分</dt>
        <dd className="text-app-text">{state.time.display} · {Object.entries(state.round.score).map(([team, score]) => `${team} ${score}`).join(" : ")}</dd>
        <dt className="text-app-muted">C4</dt>
        <dd className="text-app-text">{state.bomb.carrierName ?? state.bomb.status}</dd>
      </dl>
      <div className="overflow-x-auto border-t border-app-line pt-3">
        <table className="w-full min-w-[620px] text-left text-xs">
          <caption className="mb-2 text-left text-[11px] text-app-muted">所选 tick 的十名玩家原生字段</caption>
          <thead className="text-[11px] text-app-muted">
            <tr>
              <th className="pb-2 pr-3 font-medium">玩家</th>
              <th className="pb-2 pr-3 font-medium">阵营</th>
              <th className="pb-2 pr-3 font-medium">状态</th>
              <th className="pb-2 pr-3 font-medium">HP</th>
              <th className="pb-2 pr-3 font-medium">武器</th>
              <th className="pb-2 font-medium">原生 place</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-line/60 text-app-text">
            {state.players.map((player) => (
              <tr key={player.id}>
                <td className="py-2 pr-3">{player.name}</td>
                <td className="py-2 pr-3">{player.team}</td>
                <td className="py-2 pr-3">{player.alive ? "存活" : "已淘汰"}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">{player.health}</td>
                <td className="py-2 pr-3">{player.weapon ?? "未提供"}</td>
                <td className="py-2">{player.place ?? "未提供"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-app-muted">
        事实边界：{state.source.selectionEvidence}
      </p>
    </section>
  );
}

export function DemoImportScreen({ clientFactory }: DemoImportScreenProps) {
  const clientRef = useRef<DemoImportClientLike | null>(null);
  const [progress, setProgress] = useState<DemoImportProgress>({
    status: "idle",
    message: "",
  });
  const [inspection, setInspection] = useState<DemoImportInspection | null>(null);
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number | null>(null);
  const [selectedTick, setSelectedTick] = useState<number>(0);
  const [draft, setDraft] = useState<ScenarioDraft | null>(null);
  const [authoring, setAuthoring] = useState<AuthoringForm>(initialAuthoringForm);
  const [approvedChecks, setApprovedChecks] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [practiceScenario, setPracticeScenario] = useState<Scenario | null>(null);
  const [practiceCurrentState, setPracticeCurrentState] = useState<ReturnType<typeof buildCurrentStatePreview> | null>(null);

  function getClient(): DemoImportClientLike {
    if (!clientRef.current) {
      const onProgress = (next: DemoImportProgress) => setProgress(next);
      clientRef.current = clientFactory
        ? clientFactory(onProgress)
        : new DemoImportClient({ onProgress });
    }
    return clientRef.current;
  }

  async function importFile(file: File | undefined): Promise<void> {
    if (!file) return;
    setError(null);
    setInspection(null);
    setDraft(null);
    setPracticeScenario(null);
    setPracticeCurrentState(null);
    setApprovedChecks(new Set());
    try {
      const result: DemoImportLoadResult = await getClient().load(file);
      const firstRound = result.inspection.rounds[0];
      setInspection(result.inspection);
      setSelectedRoundNumber(firstRound.number);
      setSelectedTick(firstRound.minSelectableTick);
      setAuthoring(initialAuthoringForm());
    } catch (loadError) {
      if (loadError instanceof DemoImportCancelledError) return;
      setProgress({ status: "error", message: "导入失败" });
      setError(errorMessage(loadError));
    }
  }

  const selectedRound = useMemo(() => {
    if (!inspection || selectedRoundNumber === null) return null;
    return getSelectableRound(inspection, selectedRoundNumber);
  }, [inspection, selectedRoundNumber]);

  const selectedTickIsValid =
    selectedRound !== null &&
    Number.isInteger(selectedTick) &&
    selectedTick >= selectedRound.minSelectableTick &&
    selectedTick <= selectedRound.maxSelectableTick;
  const selectedTickStep = selectedRound?.tickStep ?? 1;

  const visibleMarkers = useMemo(() => {
    if (!inspection || !selectedRound || !selectedTickIsValid) return [];
    return filterMarkersThroughTick(
      inspection.markers.filter((marker) => marker.roundNumber === selectedRound.number),
      selectedTick,
    );
  }, [inspection, selectedRound, selectedTick, selectedTickIsValid]);

  function chooseRound(round: DemoImportRound): void {
    setSelectedRoundNumber(round.number);
    setSelectedTick(round.minSelectableTick);
    setDraft(null);
    setError(null);
  }

  async function restoreSelectedState(): Promise<void> {
    if (!selectedRound || !selectedTickIsValid) {
      setError("请选择可用范围内的整数 tick。");
      return;
    }
    setError(null);
    try {
      const result: DemoImportSelectionResult = await getClient().select(
        selectedRound.number,
        selectedTick,
      );
      const nextDraft = buildScenarioDraft(result.normalizedMatchState);
      setDraft(nextDraft);
      setApprovedChecks(new Set());
      setPracticeScenario(null);
      setPracticeCurrentState(null);
    } catch (selectionError) {
      if (selectionError instanceof DemoImportCancelledError) return;
      setProgress({ status: "error", message: "无法恢复所选 tick" });
      setError(errorMessage(selectionError));
    }
  }

  function toggleQa(id: string): void {
    setApprovedChecks((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateCall(id: CallId, field: keyof EditableCall, value: string): void {
    setAuthoring((current) => ({
      ...current,
      calls: { ...current.calls, [id]: { ...current.calls[id], [field]: value } },
    }));
  }

  function updateGuidance(
    id: CallId,
    field: keyof EditableGuidance,
    value: string,
  ): void {
    setAuthoring((current) => ({
      ...current,
      challengeGuidance: {
        ...current.challengeGuidance,
        [id]: {
          ...current.challengeGuidance[id],
          [field]: field === "alternativeCall" ? (value === "" ? null : value) : value,
        },
      },
    }));
  }

  function toAuthoring(): ImportedScenarioAuthoring {
    if (!draft) throw new Error("Draft 尚未生成");
    if (!authoring.observableConfirmed) {
      throw new Error(
        "请先确认 practice 只暴露该 perspective 的可见信息；对手位置与状态保持未知。",
      );
    }
    const reasonIds = authoring.reasonOptions.map((reason) => reason.id);
    if (new Set(reasonIds).size !== reasonIds.length) {
      throw new Error("Human QA 的依据选项不能重复。");
    }
    return {
      title: authoring.title,
      purpose: authoring.purpose,
      trainingFraming: authoring.trainingFraming,
      objectiveFraming: authoring.objectiveFraming,
      knownFact: authoring.knownFact,
      unknownFact: authoring.unknownFact,
      calls: CALL_IDS.map((id) => ({ id, ...authoring.calls[id] })),
      reasonOptions: authoring.reasonOptions,
      challengeGuidance: authoring.challengeGuidance,
      tacticalNotes: authoring.tacticalNotes,
      professional: {
        call: authoring.professionalCall,
        pathLabel: authoring.professionalPathLabel,
        outcome: authoring.professionalOutcome,
        observations: authoring.professionalObservations.filter((value) => value.trim().length > 0),
      },
      perspective: {
        side: authoring.perspectiveSide,
        visiblePlayerIds: draft.normalizedMatchState.players
          .filter((player) => player.side === authoring.perspectiveSide)
          .map((player) => player.id),
        confirmed: true,
        bombVisibility: authoring.observableBombVisible ? "confirmed" : "hidden",
      },
      mapAsset:
        authoring.useMirageRaster && draft.normalizedMatchState.map.name === "de_mirage"
          ? "/maps/Lite2_CurrentStateBase.png"
          : null,
    };
  }

  function approveDraft(): void {
    if (!draft) return;
    try {
      const authoringPayload = toAuthoring();
      const promoted = buildImportedPracticeScenario(
        draft,
        authoringPayload,
        Array.from(approvedChecks),
      );
      const currentState = authoringPayload.mapAsset
        ? buildCurrentStatePreview({
            ...draft.normalizedMatchState,
            map: {
              ...draft.normalizedMatchState.map,
              asset: "/maps/Lite2_Map.png",
            },
          }, {
            visiblePlayerIds: authoringPayload.perspective.visiblePlayerIds,
            bombVisibility: authoringPayload.perspective.bombVisibility,
          })
        : null;
      setPracticeScenario(promoted);
      setPracticeCurrentState(currentState);
      setError(null);
    } catch (approvalError) {
      setError(errorMessage(approvalError));
    }
  }

  if (practiceScenario) {
    return (
      <div data-testid="demo-import-experience">
        <ExperienceShell
          key={practiceScenario.id}
          scenarios={[practiceScenario]}
          currentStateByScenarioId={
            practiceCurrentState
              ? { [practiceScenario.id]: practiceCurrentState }
              : {}
          }
          persistSession={false}
          restoreSession={false}
          requestRemoteChallenge={false}
          requestRemoteReport={false}
          introSummary="1 个新 Demo · Human QA 已完成 · practice（未 verified）· AI Second Coach"
        />
      </div>
    );
  }

  const loading = progress.status === "reading" || progress.status === "parsing";
  const allChecksApproved = SCENARIO_DRAFT_QA_CHECK_IDS.every((id) => approvedChecks.has(id));

  function cancelImport(): void {
    getClient().cancel();
    setProgress({ status: "idle", message: "" });
    setError(null);
  }

  return (
    <PageFrame family="spatial" eyebrow="02 · DROP DEMO → REVIEW DECISIONS">
      <main className="flex flex-col gap-6 py-5 lg:gap-8 lg:py-7">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <MetadataStrip items={[<span key="product">CONNECTED DECISIONS</span>, <span key="parser">browser-local demoparser2</span>]} />
            <Link href="/" className="text-xs text-app-muted underline-offset-4 hover:text-app-text hover:underline">
              返回首页
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold leading-tight text-app-text lg:text-3xl">导入一场 Demo，开始复盘。</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-app-muted">
              选择或拖入一场新的 CS2 <span className="font-mono text-app-text">.dem</span>。系统恢复可验证的比赛事实、Round 与任意 tick；你选择截点后，再由 Human QA 补齐真正的战术语义。
            </p>
          </div>
        </header>

        {!inspection && (
          <section
            aria-label="导入 Demo"
            onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
            onDrop={(event) => { event.preventDefault(); setDragActive(false); void importFile(event.dataTransfer.files?.[0]); }}
            className={`flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed px-6 text-center transition-colors ${dragActive ? "border-app-user bg-app-user-dim" : "border-app-line bg-app-surface"}`}
          >
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-app-text">Drop Demo → Review Decisions</h2>
              <p className="max-w-md text-sm leading-relaxed text-app-muted">
                文件只在当前浏览器 Worker 中解析；当前本地 parser 不支持时会明确报错，不上传原始 Demo，也不替换成 fixture。全过程不需要开发工具。
              </p>
            </div>
            <label htmlFor="demo-import-input" className="flex h-11 cursor-pointer items-center rounded-md bg-app-text px-8 text-sm font-medium text-app-bg hover:opacity-90">
              选择 .dem 文件
              <input
                id="demo-import-input"
                data-testid="demo-import-input"
                type="file"
                accept=".dem,application/octet-stream"
                className="sr-only"
                onChange={(event) => { void importFile(event.target.files?.[0]); event.currentTarget.value = ""; }}
              />
            </label>
            <p className="font-mono text-[11px] text-app-muted">仅处理真实文件字节 · 最大 1 GB · 不写入仓库</p>
          </section>
        )}

        {loading && (
          <section aria-live="polite" className="border-y border-app-line py-5" data-testid="demo-import-progress">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-app-text">{progress.message}</p>
                <p className="mt-1 font-mono text-xs text-app-muted">browser-local worker · 原始文件不会上传</p>
              </div>
              <button type="button" data-testid="demo-import-cancel" onClick={cancelImport} className="h-9 rounded-md border border-app-line px-3 text-xs text-app-muted hover:border-app-muted hover:text-app-text">
                取消解析
              </button>
            </div>
          </section>
        )}

        {error && (
          <section role="alert" className="border border-[#d06a6c]/50 bg-[#d06a6c]/10 px-4 py-3 text-sm leading-relaxed text-app-text">
            {error}
          </section>
        )}

        {inspection && selectedRound && !draft && (
          <section data-testid="demo-import-inspection" className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 border-y border-app-line py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-xs text-app-muted">{inspection.matchLabel}</p>
                  <h2 className="mt-1 text-xl font-semibold text-app-text">{inspection.map.name.toUpperCase()} · 选择 Round 与时间</h2>
                </div>
                <span className="font-mono text-xs text-app-muted">{inspection.fileName} · {Math.round(inspection.fileSize / 1024 / 1024)} MB</span>
              </div>
              <MetadataStrip items={[
                <span key="map">{inspection.map.name.toUpperCase()}</span>,
                <span key="players"><Num>{inspection.players.length}</Num> players</span>,
                <span key="rounds"><Num>{inspection.rounds.length}</Num> rounds</span>,
                <span key="parser">{inspection.source.parser} {inspection.source.parserVersion}</span>,
              ]} />
              <p className="text-xs leading-relaxed text-app-muted">
                阵营标签：{inspection.teams.map((team) => `${team.label} ${team.playerCount}人`).join(" · ")}。玩家身份来自 <span className="font-mono">player_first_connect</span>，不是用户重新填写。
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-10">
              <section aria-labelledby="round-list-heading">
                <h3 id="round-list-heading" className="mb-3 text-base font-semibold text-app-text">可用 Round</h3>
                <div className="flex max-h-[430px] flex-col overflow-y-auto border-y border-app-line">
                  {inspection.rounds.map((round) => {
                    const selected = round.number === selectedRound.number;
                    return (
                      <button
                        key={round.number}
                        type="button"
                        data-testid={`demo-round-${round.number}`}
                        aria-pressed={selected}
                        onClick={() => chooseRound(round)}
                        className={`flex items-center justify-between gap-3 border-b border-app-line/60 px-3 py-3 text-left last:border-b-0 ${selected ? "bg-app-surface text-app-text" : "text-app-muted hover:bg-app-surface/60 hover:text-app-text"}`}
                      >
                        <span className="font-mono text-sm">R{round.number}</span>
                        <span className="flex flex-col items-end gap-0.5 text-[11px]">
                          <span>{round.minSelectableTick}–{round.maxSelectableTick} tick</span>
                          <span>冻结后可选 · {round.tickrate} tick/s</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section aria-labelledby="tick-picker-heading" className="flex flex-col gap-4">
                <div>
                  <h3 id="tick-picker-heading" className="text-base font-semibold text-app-text">R{selectedRound.number} · 任意时间截点</h3>
                  <p className="mt-1 text-xs leading-relaxed text-app-muted">范围从 freeze end 开始，到 Round 结束前一个 tick。Round 结果不会成为可选状态；当前 parser 的可选 tick 间隔为 {selectedTickStep}。</p>
                </div>
                <div className="flex flex-col gap-2 rounded-lg border border-app-line bg-app-surface px-4 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor="demo-tick-slider" className="text-xs text-app-muted">选定 tick</label>
                    <span data-testid="demo-selected-tick" className="font-mono text-lg tabular-nums text-app-text">{selectedTick}</span>
                  </div>
                  <input
                    id="demo-tick-slider"
                    data-testid="demo-tick-slider"
                    type="range"
                    min={selectedRound.minSelectableTick}
                    max={selectedRound.maxSelectableTick}
                    step={selectedTickStep}
                    value={selectedTick}
                    onChange={(event) => { setSelectedTick(Number(event.target.value)); setDraft(null); }}
                    className="w-full accent-[#dfa45b]"
                  />
                  <div className="flex items-center justify-between gap-3 text-[11px] text-app-muted">
                    <span className="font-mono">{selectedRound.minSelectableTick}</span>
                    <span>约 {selectedTickIsValid ? estimateRoundClock(selectedRound, selectedTick) : "—"} · 仅为选择前预览</span>
                    <span className="font-mono">{selectedRound.maxSelectableTick}</span>
                  </div>
                  <label htmlFor="demo-tick-number" className="mt-2 flex items-center justify-between gap-3 text-xs text-app-muted">
                    精确输入 tick
                    <input
                      id="demo-tick-number"
                      data-testid="demo-tick-number"
                      type="number"
                      min={selectedRound.minSelectableTick}
                      max={selectedRound.maxSelectableTick}
                      step={selectedTickStep}
                      value={selectedTick}
                      onChange={(event) => { setSelectedTick(Number(event.target.value)); setDraft(null); }}
                      className="h-9 w-36 rounded-md border border-app-line bg-transparent px-2 text-right font-mono text-sm text-app-text outline-none focus:border-app-user"
                    />
                  </label>
                  {!selectedTickIsValid && <p className="text-xs text-[#d06a6c]">tick 必须在当前 Round 的可选范围内。</p>}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <h4 className="text-sm font-semibold text-app-text">事件 marker</h4>
                    <span className="text-[11px] text-app-muted">只显示当前 tick 之前 · 仅用于定位</span>
                  </div>
                  {visibleMarkers.length === 0 ? (
                    <p className="border-y border-app-line py-3 text-xs text-app-muted">当前截点之前没有可展示的事件 marker。</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {visibleMarkers.map((marker) => (
                        <button
                          key={`${marker.kind}-${marker.tick}`}
                          type="button"
                          data-testid={`demo-marker-${marker.tick}`}
                          onClick={() => setSelectedTick(Math.min(selectedRound.maxSelectableTick, Math.max(selectedRound.minSelectableTick, Math.ceil(marker.tick / selectedTickStep) * selectedTickStep)))}
                          className="rounded-full border border-app-line px-2.5 py-1.5 text-[11px] text-app-muted hover:border-app-muted hover:text-app-text"
                        >
                          {marker.label} · <span className="font-mono">{marker.tick}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  data-testid="demo-restore-state"
                  onClick={() => void restoreSelectedState()}
                  disabled={!selectedTickIsValid || inspection.map.overview === null || loading}
                  className="h-12 rounded-md bg-app-text text-sm font-medium text-app-bg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  恢复这个 Round / Tick
                </button>
                {inspection.map.overview === null && (
                  <p className="text-xs leading-relaxed text-[#d06a6c]">该地图暂缺已批准 overview metadata，当前不能生成 normalized state；不会用猜测坐标补齐。</p>
                )}
              </section>
            </div>

            <section className="flex flex-col gap-2" aria-labelledby="import-boundary-heading">
              <h3 id="import-boundary-heading" className="text-sm font-semibold text-app-text">导入边界</h3>
              <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-app-muted">
                {inspection.warnings.map((warning) => <li key={warning}>· {warning}</li>)}
              </ul>
            </section>
          </section>
        )}

        {draft && (
          <section data-testid="demo-import-draft" className="flex flex-col gap-7">
            <header className="flex flex-col gap-2">
              <MetadataStrip items={[
                <span key="draft">DRAFT</span>,
                <span key="round">ROUND <Num>{draft.normalizedMatchState.round.number}</Num></span>,
                <span key="tick">TICK <Num>{draft.normalizedMatchState.tick}</Num></span>,
                <span key="time">{draft.normalizedMatchState.time.display}</span>,
              ]} />
              <h2 className="text-2xl font-semibold text-app-text">先确认机器事实，再写你的战术判断。</h2>
              <p className="max-w-2xl text-sm leading-relaxed text-app-muted">这是一份新 Demo 的真实 Draft。机器只恢复当前截点；Human QA 现在负责把它变成可训练的 practice Scenario，永远不会自动发布为 verified。</p>
            </header>

            <MachineStateSummary draft={draft} />

            <section aria-labelledby="human-semantics-heading" className="flex flex-col gap-5">
              <div>
                <h2 id="human-semantics-heading" className="text-xl font-semibold text-app-text">Human QA：补齐决策语义</h2>
                <p className="mt-1 text-xs leading-relaxed text-app-muted">所有输入都属于人工内容；不要把未知内容写成 Demo 原生事实。</p>
              </div>

              <section className="flex flex-col gap-3 border-y border-[#6fb3c9]/30 bg-[#6fb3c9]/5 py-4" aria-labelledby="observable-boundary-heading">
                <div>
                  <h3 id="observable-boundary-heading" className="text-sm font-semibold text-app-text">训练 perspective / observable boundary</h3>
                  <p className="mt-1 text-xs leading-relaxed text-app-muted">机器 Draft 保留完整十人状态供 Human QA 核对；进入 practice 后只展示你确认属于该 perspective 的阵营。对手位置、血量、武器与 C4 carrier 不会在判断前自动暴露。</p>
                </div>
                <label htmlFor="import-perspective-side" className="flex max-w-xs flex-col gap-1.5 text-xs font-medium text-app-text">
                  用户训练 perspective
                  <select id="import-perspective-side" value={authoring.perspectiveSide} onChange={(event) => setAuthoring((current) => ({ ...current, perspectiveSide: event.target.value as "CT" | "T" }))} className="h-10 rounded-md border border-app-line bg-app-bg px-2 text-xs text-app-text outline-none focus:border-app-user">
                    <option value="T">T side · 进攻 perspective</option>
                    <option value="CT">CT side · 防守 perspective</option>
                  </select>
                </label>
                <label className="flex cursor-pointer gap-3 rounded-md border border-app-line p-3 text-xs leading-relaxed text-app-text">
                  <input type="checkbox" data-testid="import-observable-confirm" checked={authoring.observableConfirmed} onChange={(event) => setAuthoring((current) => ({ ...current, observableConfirmed: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#6fb3c9]" />
                  <span>我已确认 practice 只显示所选阵营的可见状态；对手位置、状态和未确认信息保持 Unknown。</span>
                </label>
                <label className="flex cursor-pointer gap-3 rounded-md border border-app-line p-3 text-xs leading-relaxed text-app-text">
                  <input type="checkbox" data-testid="import-observable-bomb" checked={authoring.observableBombVisible} onChange={(event) => setAuthoring((current) => ({ ...current, observableBombVisible: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#dfa45b]" />
                  <span>我另外确认该 perspective 在此截点确实知道 C4 状态；否则保持 Unknown（默认）。</span>
                </label>
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="flex flex-col gap-3 border-y border-app-line py-4">
                  <h3 className="text-sm font-semibold text-app-text">训练 framing</h3>
                  <TextField id="import-title" label="节点标题" value={authoring.title} onChange={(value) => setAuthoring((current) => ({ ...current, title: value }))} placeholder="例如：中路信息不足时是否转点" />
                  <TextAreaField id="import-purpose" label="判断主题" value={authoring.purpose} onChange={(value) => setAuthoring((current) => ({ ...current, purpose: value }))} placeholder="这场局面训练什么取舍？" />
                  <TextAreaField id="import-training-framing" label="训练 framing" value={authoring.trainingFraming} onChange={(value) => setAuthoring((current) => ({ ...current, trainingFraming: value }))} placeholder="希望用户练习怎样连接事实、理由与行动？" />
                  <TextAreaField id="import-objective" label="战术目标描述" value={authoring.objectiveFraming} onChange={(value) => setAuthoring((current) => ({ ...current, objectiveFraming: value }))} placeholder="由 Human 写下目标，不是机器推断。" />
                </section>

                <section className="flex flex-col gap-3 border-y border-app-line py-4">
                  <h3 className="text-sm font-semibold text-app-text">Known / Unknown</h3>
                  <TextField id="import-known-label" label="Known 标签" value={authoring.knownFact.label} onChange={(value) => setAuthoring((current) => ({ ...current, knownFact: { ...current.knownFact, label: value } }))} placeholder="例如：已确认的信息" />
                  <TextAreaField id="import-known-detail" label="Known 细节" value={authoring.knownFact.detail} onChange={(value) => setAuthoring((current) => ({ ...current, knownFact: { ...current.knownFact, detail: value } }))} placeholder="只写你愿意为之负责的人工核验内容。" />
                  <TextField id="import-unknown-label" label="Unknown 标签" value={authoring.unknownFact.label} onChange={(value) => setAuthoring((current) => ({ ...current, unknownFact: { ...current.unknownFact, label: value } }))} placeholder="例如：仍未知的空间" />
                  <TextAreaField id="import-unknown-detail" label="Unknown 细节" value={authoring.unknownFact.detail} onChange={(value) => setAuthoring((current) => ({ ...current, unknownFact: { ...current.unknownFact, detail: value } }))} placeholder="明确写出未知，不要将 heuristic 当成事实。" />
                </section>
              </div>

              <section className="flex flex-col gap-4 border-y border-app-line py-4">
                <div>
                  <h3 className="text-sm font-semibold text-app-text">三个 Call 与理由</h3>
                  <p className="mt-1 text-xs text-app-muted">三种方案保持平权；Second Coach 会在用户先选 Call 后才出现。</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {CALL_IDS.map((id) => (
                    <div key={id} className="flex flex-col gap-2 rounded-md border border-app-line p-3">
                      <p className="font-mono text-sm text-app-user">Call {id}</p>
                      <TextField id={`import-call-${id}-label`} label="名称" value={authoring.calls[id].label} onChange={(value) => updateCall(id, "label", value)} placeholder="人工方案名" />
                      <TextAreaField id={`import-call-${id}-description`} label="行动描述" value={authoring.calls[id].description} onChange={(value) => updateCall(id, "description", value)} placeholder="具体表达战术意图与约束。" />
                      <TextAreaField id={`import-tactical-${id}`} label="路线 / 区域含义（人工）" value={authoring.tacticalNotes[id]} onChange={(value) => setAuthoring((current) => ({ ...current, tacticalNotes: { ...current.tacticalNotes, [id]: value } }))} placeholder="写语义，不填未经核验的坐标。" />
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  {authoring.reasonOptions.map((reason, index) => (
                    <div key={index} className="flex flex-col gap-2 rounded-md border border-app-line p-3">
                      <label htmlFor={`import-reason-${index}`} className="text-xs font-medium text-app-text">依据 {index + 1} ID</label>
                      <select id={`import-reason-${index}`} value={reason.id} onChange={(event) => setAuthoring((current) => ({ ...current, reasonOptions: current.reasonOptions.map((item, itemIndex) => itemIndex === index ? { ...item, id: event.target.value as ReasonId } : item) }))} className="h-10 rounded-md border border-app-line bg-app-bg px-2 text-xs text-app-text outline-none focus:border-app-user">
                        {REASON_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
                      </select>
                      <TextField id={`import-reason-label-${index}`} label="人工标签" value={reason.label} onChange={(value) => setAuthoring((current) => ({ ...current, reasonOptions: current.reasonOptions.map((item, itemIndex) => itemIndex === index ? { ...item, label: value } : item) }))} placeholder="例如：已知人数优势" />
                    </div>
                  ))}
                </div>
              </section>

              <section className="flex flex-col gap-4 border-y border-app-line py-4">
                <div>
                  <h3 className="text-sm font-semibold text-app-text">Challenge guidance</h3>
                  <p className="mt-1 text-xs text-app-muted">由 Human 写第二意见的盲点与问题；不是机器替你判断。</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {CALL_IDS.map((id) => (
                    <div key={id} className="flex flex-col gap-2 rounded-md border border-app-line p-3">
                      <p className="font-mono text-sm text-app-ai">Call {id}</p>
                      <TextAreaField id={`import-guidance-${id}-blindspot`} label="盲点" value={authoring.challengeGuidance[id].blindspot} onChange={(value) => updateGuidance(id, "blindspot", value)} placeholder="一个遗漏条件或风险。" />
                      <TextAreaField id={`import-guidance-${id}-question`} label="复盘问题" value={authoring.challengeGuidance[id].question} onChange={(value) => updateGuidance(id, "question", value)} placeholder="让用户重新检查自己的理由。" />
                      <label htmlFor={`import-guidance-${id}-alternative`} className="flex flex-col gap-1.5 text-xs font-medium text-app-text">替代 Call（可无）
                        <select id={`import-guidance-${id}-alternative`} value={authoring.challengeGuidance[id].alternativeCall ?? ""} onChange={(event) => updateGuidance(id, "alternativeCall", event.target.value)} className="h-10 rounded-md border border-app-line bg-app-bg px-2 text-xs text-app-text outline-none focus:border-app-ai">
                          <option value="">无</option>
                          {CALL_IDS.filter((candidate) => candidate !== id).map((candidate) => <option key={candidate} value={candidate}>Call {candidate}</option>)}
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-5 border-y border-app-line py-4 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-app-text">Professional / Coach Reference</h3>
                  <label htmlFor="import-professional-call" className="flex flex-col gap-1.5 text-xs font-medium text-app-text">参考 Call
                    <select id="import-professional-call" value={authoring.professionalCall} onChange={(event) => setAuthoring((current) => ({ ...current, professionalCall: event.target.value as CallId }))} className="h-10 rounded-md border border-app-line bg-app-bg px-2 text-xs text-app-text outline-none focus:border-app-pro">
                      {CALL_IDS.map((id) => <option key={id} value={id}>Call {id}</option>)}
                    </select>
                  </label>
                  <TextField id="import-professional-path" label="参考路径" value={authoring.professionalPathLabel} onChange={(value) => setAuthoring((current) => ({ ...current, professionalPathLabel: value }))} placeholder="人工教练参考，不是标准答案" />
                  <TextAreaField id="import-professional-outcome" label="结果 / 观察边界" value={authoring.professionalOutcome} onChange={(value) => setAuthoring((current) => ({ ...current, professionalOutcome: value }))} placeholder="把历史结果和决策时刻分开写。" />
                  {authoring.professionalObservations.map((value, index) => (
                    <TextAreaField key={index} id={`import-professional-observation-${index}`} label={`观察 ${index + 1}`} value={value} required={index === 0} onChange={(next) => setAuthoring((current) => ({ ...current, professionalObservations: current.professionalObservations.map((item, itemIndex) => itemIndex === index ? next : item) as [string, string, string] }))} placeholder={index === 0 ? "至少一条人工观察" : "补充观察（可选）"} />
                  ))}
                </div>
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-app-text">空间边界</h3>
                  <p className="text-xs leading-relaxed text-app-muted">新 Demo 默认不附带可用于战术语义的 raster。只有 Mirage 才能由 Human 明确确认复用既有 Current State 底图；不编辑坐标、不伪造路线。</p>
                  {draft.normalizedMatchState.map.name === "de_mirage" ? (
                    <label className="flex cursor-pointer gap-3 rounded-md border border-app-line p-3 text-xs leading-relaxed text-app-text">
                      <input type="checkbox" checked={authoring.useMirageRaster} onChange={(event) => setAuthoring((current) => ({ ...current, useMirageRaster: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#dfa45b]" />
                      <span>我已人工确认现有 Mirage raster 可用于本场 practice 的空间阅读（不是 Demo 原生事实）。</span>
                    </label>
                  ) : (
                    <p className="border border-app-line p-3 text-xs text-app-muted">当前地图没有 Gate 4 可复用的人工确认 raster；practice 将保留无底图状态。</p>
                  )}
                </div>
              </section>

              <section className="flex flex-col gap-4 border-y border-app-line py-4" aria-labelledby="draft-qa-heading">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <h3 id="draft-qa-heading" className="text-sm font-semibold text-app-text">机器事实核对</h3>
                    <p className="mt-1 text-xs text-app-muted">五项都需要人工明确确认；这不会把 Draft 变成 verified。</p>
                  </div>
                  <span className="font-mono text-xs text-app-muted">{approvedChecks.size}/{SCENARIO_DRAFT_QA_CHECK_IDS.length}</span>
                </div>
                <div className="flex flex-col divide-y divide-app-line border-y border-app-line">
                  {draft.qaChecks.map((check) => (
                    <label key={check.id} className="flex cursor-pointer gap-3 py-3">
                      <input type="checkbox" checked={approvedChecks.has(check.id)} onChange={() => toggleQa(check.id)} aria-label={`Human QA：${check.label}`} className="mt-0.5 h-4 w-4 accent-[#dfa45b]" />
                      <span className="flex flex-col gap-1"><span className="text-sm font-medium text-app-text">{check.label}</span><span className="text-xs leading-relaxed text-app-muted">{check.evidence}</span></span>
                    </label>
                  ))}
                </div>
                <button type="button" data-testid="demo-qa-approve" onClick={approveDraft} disabled={!allChecksApproved} className="h-12 rounded-md bg-app-text text-sm font-medium text-app-bg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                  通过 Human QA，进入 Second Coach
                </button>
                <p className="text-[11px] leading-relaxed text-app-muted">当前只会提升为 <span className="font-mono text-app-text">practice</span>。机器不会代替你填写 Call、Reason、战术 route / zone 或训练 takeaway。</p>
              </section>
            </section>
          </section>
        )}
      </main>
    </PageFrame>
  );
}
