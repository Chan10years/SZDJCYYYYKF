import { z } from "zod";
import {
  assertSelectableTick,
  getSelectableRound,
  MAX_DEMO_FILE_SIZE_BYTES,
  type DemoImportInspection,
  type DemoImportRosterConfirmation,
  type DemoImportRound,
  type DemoImportStatus,
} from "@/domain/demoImport";
import {
  buildDemoImportInspection,
  buildDemoImportNormalizedState,
  type DemoParserInspectionInput,
  type DemoParserSelectionInput,
  type DemoImportRosterResolutionOptions,
} from "@/domain/demoImportAdapter";
import {
  DemoImportFailure,
  DemoParseError,
  DemoParserRuntimeError,
  DemoRosterRecoveryError,
  DemoRosterValidationError,
  type DemoImportFailureKind,
} from "@/domain/demoImportErrors";
import { NormalizedMatchStateSchema } from "@/domain/normalizedMatchState";

export type DemoImportClientMode = "browser-local";

export type DemoImportProgress = {
  status: DemoImportStatus;
  message: string;
  mode?: DemoImportClientMode;
  stage?: string;
  failureKind?: DemoImportFailureKind;
};

export type DemoImportLoadResult = {
  inspection: DemoImportInspection;
  mode: DemoImportClientMode;
};

export type DemoImportLoadOptions = {
  /** Explicit per-import roster input used only after automatic recovery is ambiguous. */
  rosterConfirmation?: DemoImportRosterConfirmation;
};

export type DemoImportSelectionResult = {
  normalizedMatchState: z.infer<typeof NormalizedMatchStateSchema>;
  mode: DemoImportClientMode;
};

export type DemoImportWorkerCommand =
  | {
      type: "load";
      buffer: ArrayBuffer;
      fileName: string;
      fileSize: number;
    }
  | { type: "select"; roundNumber: number; tick: number; sideTick: number }
  | { type: "reset" };

export type DemoImportWorkerLike = {
  addEventListener: (
    type: "message" | "error",
    listener: (event: MessageEvent) => void,
  ) => void;
  removeEventListener: (
    type: "message" | "error",
    listener: (event: MessageEvent) => void,
  ) => void;
  postMessage: (
    message: DemoImportWorkerCommand,
    transfer?: Transferable[],
  ) => void;
  terminate: () => void;
};

export type DemoImportClientOptions = {
  workerFactory?: () => DemoImportWorkerLike;
  workerTimeoutMs?: number;
  onProgress?: (progress: DemoImportProgress) => void;
};

export type DemoImportClientLike = Pick<
  DemoImportClient,
  "load" | "confirmRoster" | "select" | "reset" | "cancel"
>;

type LoadedDemo = {
  file: File;
  inspection: DemoImportInspection;
  mode: DemoImportClientMode;
  baseInput: DemoParserInspectionInput;
  worker: DemoImportWorkerLike;
  rosterResolutionOptions: DemoImportRosterResolutionOptions;
};

type PendingRosterConfirmation = {
  file: File;
  baseInput: DemoParserInspectionInput;
  worker: DemoImportWorkerLike;
};

export class LocalParserUnsupportedError extends DemoParserRuntimeError {
  constructor(message = "浏览器本地 parser runtime 失败；原始文件未上传。") {
    super(message);
    this.name = "LocalParserUnsupportedError";
  }
}

export class DemoImportCancelledError extends Error {
  constructor() {
    super("已取消 Demo 解析");
    this.name = "DemoImportCancelledError";
  }
}

function asRecord(input: unknown): Record<string, unknown> {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    throw new DemoParseError("浏览器本地 Demo 解析结果格式无效；原始文件未上传。");
  }
  return input as Record<string, unknown>;
}

function asArray(input: unknown): readonly unknown[] {
  if (!Array.isArray(input)) {
    throw new DemoParseError("浏览器本地 Demo 解析结果缺少数组字段；原始文件未上传。");
  }
  return input;
}

function workerBaseInput(
  messageInput: unknown,
  file: File,
): DemoParserInspectionInput {
  const message = asRecord(messageInput);
  const raw = asRecord(message.raw);
  const demoSha256 = message.demoSha256;
  if (typeof demoSha256 !== "string") {
    throw new LocalParserUnsupportedError();
  }
  const selectionTickStep = message.selectionTickStep;
  return {
    fileName: file.name,
    fileSize: file.size,
    demoSha256,
    header: raw.header,
    playerIdentities: asArray(raw.playerIdentities),
    competitiveParticipationEvidence: asArray(
      raw.competitiveParticipationEvidence,
    ),
    roundSideSnapshots: asArray(raw.roundSideSnapshots),
    roundStartEvents: asArray(raw.roundStartEvents),
    roundFreezeEndEvents: asArray(raw.roundFreezeEndEvents),
    roundEndEvents: asArray(raw.roundEndEvents),
    killEvents: asArray(raw.killEvents),
    bombEvents: asArray(raw.bombEvents),
    ...(typeof selectionTickStep === "number" ? { selectionTickStep } : {}),
  };
}

function workerSelectionInput(
  messageInput: unknown,
  baseInput: DemoParserInspectionInput,
  roundNumber: number,
  requestedTick: number,
  round: DemoImportRound,
): DemoParserSelectionInput {
  const message = asRecord(messageInput);
  const raw = asRecord(message.raw);
  const actualTickValue = message.actualTick;
  if (typeof actualTickValue !== "number") {
    throw new DemoParseError(
      "浏览器本地 Demo 解析结果未提供可信的实际 tick；已拒绝该截点。原始文件未上传。",
    );
  }
  const actualTick = actualTickValue;
  if (!Number.isInteger(actualTick)) {
    throw new DemoParseError(
      "浏览器本地 Demo 解析结果返回了无效的实际 tick；已拒绝该截点。原始文件未上传。",
    );
  }
  if (actualTick > requestedTick) {
    throw new DemoParseError(
      `浏览器本地 Demo 解析结果返回了未来 sample tick ${actualTick}，请求 tick 是 ${requestedTick}；已拒绝该截点。原始文件未上传。`,
    );
  }
  if (actualTick !== requestedTick) {
    throw new DemoParseError(
      `浏览器本地 Demo 解析结果返回的 sample tick ${actualTick} 与请求 tick ${requestedTick} 不一致；已拒绝该截点。原始文件未上传。`,
    );
  }
  if (
    actualTick < round.minSelectableTick ||
    actualTick > round.maxSelectableTick ||
    actualTick % (round.tickStep ?? 1) !== 0
  ) {
    throw new DemoParseError(
      "浏览器本地 Demo 解析结果的实际 tick 不在可信可选范围内；已拒绝该截点。原始文件未上传。",
    );
  }
  return {
    ...baseInput,
    roundNumber,
    tick: actualTick,
    tickRows: asArray(raw.tickRows),
    sideRows: Array.isArray(raw.sideRows) ? raw.sideRows : undefined,
  };
}

function workerFailure(messageInput: unknown): DemoImportFailure {
  const message =
    typeof messageInput === "object" &&
    messageInput !== null &&
    !Array.isArray(messageInput)
      ? (messageInput as Record<string, unknown>)
      : {};
  const detail =
    typeof message.message === "string" && message.message.length > 0
      ? message.message
      : undefined;
  if (message.code === "demo-parse") {
    return new DemoParseError(
      detail ?? "浏览器本地 Demo 解析失败；原始文件未上传。",
    );
  }
  return new LocalParserUnsupportedError(
    detail ?? "浏览器本地 parser runtime 失败；原始文件未上传。",
  );
}

function defaultWorkerFactory(): DemoImportWorkerLike {
  if (typeof Worker === "undefined") {
    throw new LocalParserUnsupportedError(
      "当前环境没有可用的浏览器 Worker；未上传原始文件。",
    );
  }
  const worker = new Worker("/workers/demoParserWorker.js", {
    type: "classic",
  });
  return {
    addEventListener: (type, listener) =>
      worker.addEventListener(type, listener as EventListener),
    removeEventListener: (type, listener) =>
      worker.removeEventListener(type, listener as EventListener),
    postMessage: (message, transfer) => {
      if (transfer) {
        worker.postMessage(message, transfer);
      } else {
        worker.postMessage(message);
      }
    },
    terminate: () => worker.terminate(),
  };
}

/** Browser-local orchestration for the product import flow. */
export class DemoImportClient {
  private readonly workerFactory: () => DemoImportWorkerLike;
  private readonly workerTimeoutMs: number;
  private readonly onProgress: (progress: DemoImportProgress) => void;
  private loadedDemo: LoadedDemo | null = null;
  private pendingRosterConfirmation: PendingRosterConfirmation | null = null;
  private activeWorker: DemoImportWorkerLike | null = null;
  private generation = 0;
  private pendingReject: ((error: Error) => void) | null = null;
  private pendingCleanup: (() => void) | null = null;

  constructor(options: DemoImportClientOptions = {}) {
    this.workerFactory = options.workerFactory ?? defaultWorkerFactory;
    this.workerTimeoutMs = options.workerTimeoutMs ?? 180_000;
    this.onProgress = options.onProgress ?? (() => undefined);
  }

  async load(
    file: File,
    options: DemoImportLoadOptions = {},
  ): Promise<DemoImportLoadResult> {
    this.validateFile(file);
    this.reset();
    const generation = this.generation;
    this.emit({
      status: "reading",
      message: "正在浏览器本地读取 Demo…",
      mode: "browser-local",
    });
    let worker: DemoImportWorkerLike | null = null;
    let baseInput: DemoParserInspectionInput | null = null;
    try {
      worker = this.workerFactory();
      this.activeWorker = worker;
      const resultPromise = this.waitForWorkerMessage(
        worker,
        "inspection",
        generation,
      );
      // `file.arrayBuffer()` yields before the awaited worker promise below.
      // Attach a handler now so an immediate user cancellation cannot leave
      // the internal promise temporarily unhandled.
      void resultPromise.catch(() => undefined);
      const buffer = await file.arrayBuffer();
      if (generation !== this.generation) {
        throw new DemoImportCancelledError();
      }
      worker.postMessage(
        {
          type: "load",
          buffer,
          fileName: file.name,
          fileSize: file.size,
        },
        [buffer],
      );
      const message = await resultPromise;
      baseInput = workerBaseInput(message, file);
      const inspection = buildDemoImportInspection(baseInput, options);
      this.storeLoadedDemo(file, baseInput, worker, inspection);
      this.activeWorker = worker;
      this.emit({
        status: "ready",
        message: "Demo 已在浏览器本地解析，选择 Round 与时间截点。",
        mode: "browser-local",
      });
      return { inspection, mode: "browser-local" };
    } catch (error) {
      if (error instanceof DemoImportCancelledError) {
        throw error;
      }
      const parserError = this.asParserError(error);
      if (
        parserError instanceof DemoRosterRecoveryError &&
        parserError.canConfirm &&
        worker !== null &&
        baseInput !== null
      ) {
        // Keep the already parsed browser-local facts and worker alive. The
        // next explicit confirmation is a per-import roster input; it does
        // not rewrite the parser result or send the Demo anywhere.
        this.pendingRosterConfirmation = { file, baseInput, worker };
        this.activeWorker = worker;
      } else {
        worker?.terminate();
        if (this.activeWorker === worker) {
          this.activeWorker = null;
        }
      }
      this.emit({
        status: parserError.kind === "parser-runtime" ? "unsupported" : "error",
        message: parserError.message,
        mode: "browser-local",
        failureKind: parserError.kind,
      });
      throw parserError;
    }
  }

  async confirmRoster(
    confirmation: DemoImportRosterConfirmation,
  ): Promise<DemoImportLoadResult> {
    const pending = this.pendingRosterConfirmation;
    if (!pending) {
      throw new DemoRosterValidationError(
        "当前没有等待确认的 match roster 导入。",
      );
    }
    try {
      const inspection = buildDemoImportInspection(pending.baseInput, {
        rosterConfirmation: confirmation,
      });
      this.storeLoadedDemo(
        pending.file,
        pending.baseInput,
        pending.worker,
        inspection,
      );
      this.pendingRosterConfirmation = null;
      this.activeWorker = pending.worker;
      this.emit({
        status: "ready",
        message: "已确认本次导入的 10 人 match roster，选择 Round 与时间截点。",
        mode: "browser-local",
      });
      return { inspection, mode: "browser-local" };
    } catch (error) {
      const parserError = this.asParserError(error);
      this.emit({
        status: parserError.kind === "parser-runtime" ? "unsupported" : "error",
        message: parserError.message,
        mode: "browser-local",
        failureKind: parserError.kind,
      });
      throw parserError;
    }
  }

  async select(
    roundNumber: number,
    tick: number,
  ): Promise<DemoImportSelectionResult> {
    const loaded = this.loadedDemo;
    if (!loaded) {
      throw new Error("请先导入 Demo");
    }
    const round = getSelectableRound(loaded.inspection, roundNumber);
    assertSelectableTick(round, tick);
    const generation = this.generation;
    try {
      const resultPromise = this.waitForWorkerMessage(
        loaded.worker,
        "selection",
        generation,
      );
      loaded.worker.postMessage({
        type: "select",
        roundNumber,
        tick,
        sideTick: round.freezeEndTick,
      });
      const message = await resultPromise;
      const selectionInput = workerSelectionInput(
        message,
        loaded.baseInput,
        roundNumber,
        tick,
        round,
      );
      const normalizedMatchState = buildDemoImportNormalizedState(
        selectionInput,
        loaded.rosterResolutionOptions,
      );
      this.emit({
        status: "ready",
        message: "所选 Round / Tick 已在浏览器本地恢复。",
        mode: "browser-local",
      });
      return { normalizedMatchState, mode: "browser-local" };
    } catch (error) {
      if (error instanceof DemoImportCancelledError) {
        throw error;
      }
      loaded.worker.terminate();
      this.loadedDemo = null;
      if (this.activeWorker === loaded.worker) {
        this.activeWorker = null;
      }
      const parserError = this.asParserError(error);
      this.emit({
        status: parserError.kind === "parser-runtime" ? "unsupported" : "error",
        message: parserError.message,
        mode: "browser-local",
        failureKind: parserError.kind,
      });
      throw parserError;
    }
  }

  cancel(): void {
    const hadWork = this.activeWorker !== null || this.pendingReject !== null;
    this.reset();
    if (hadWork) {
      this.emit({
        status: "idle",
        message: "已取消 Demo 解析。原始文件未上传。",
        mode: "browser-local",
      });
    }
  }

  reset(): void {
    this.generation += 1;
    const pendingReject = this.pendingReject;
    const pendingCleanup = this.pendingCleanup;
    this.pendingReject = null;
    this.pendingCleanup = null;
    pendingCleanup?.();
    pendingReject?.(new DemoImportCancelledError());
    this.loadedDemo?.worker.terminate();
    if (this.activeWorker && this.activeWorker !== this.loadedDemo?.worker) {
      this.activeWorker.terminate();
    }
    this.loadedDemo = null;
    this.pendingRosterConfirmation = null;
    this.activeWorker = null;
  }

  private storeLoadedDemo(
    file: File,
    baseInput: DemoParserInspectionInput,
    worker: DemoImportWorkerLike,
    inspection: DemoImportInspection,
  ): void {
    this.loadedDemo = {
      file,
      inspection,
      mode: "browser-local",
      baseInput,
      worker,
      rosterResolutionOptions:
        inspection.rosterResolution.mode === "user-confirmed"
          ? {
              rosterConfirmation: {
                matchRosterIds: [...inspection.rosterResolution.matchRosterIds],
              },
            }
          : {},
    };
  }

  private validateFile(file: File): void {
    if (!file || typeof file.name !== "string") {
      throw new Error("请选择一个 .dem 文件");
    }
    if (!file.name.toLowerCase().endsWith(".dem")) {
      throw new Error("只支持 .dem Demo 文件");
    }
    if (!Number.isInteger(file.size) || file.size <= 0) {
      throw new Error("Demo 文件为空或大小无效");
    }
    if (file.size > MAX_DEMO_FILE_SIZE_BYTES) {
      throw new Error("Demo 文件超过当前 1 GB 导入上限");
    }
  }

  private asParserError(error: unknown): DemoImportFailure {
    if (error instanceof DemoImportFailure) {
      return error;
    }
    const detail = error instanceof Error ? error.message : String(error);
    const detailSuffix =
      detail && detail !== "undefined"
        ? `（${detail.slice(0, 240)}）`
        : "";
    return detail.includes("超时")
      ? new LocalParserUnsupportedError(
          "浏览器本地 parser 超时；未上传原始文件。",
        )
      : new DemoParseError(
          `浏览器本地 Demo 解析失败；原始文件未上传。${detailSuffix}`,
        );
  }

  private emit(progress: DemoImportProgress): void {
    this.onProgress(progress);
  }

  private waitForWorkerMessage(
    worker: DemoImportWorkerLike,
    finalType: "inspection" | "selection",
    generation: number,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let cleanup = () => undefined;
      const settleReject = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const settleResolve = (message: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(message);
      };
      const timeout = setTimeout(() => {
        worker.terminate();
        settleReject(
          new LocalParserUnsupportedError(
            "浏览器本地 parser 超时；未上传原始文件。",
          ),
        );
      }, this.workerTimeoutMs);
      const onMessage = (event: MessageEvent) => {
        if (generation !== this.generation) return;
        const message = event.data;
        if (!message || typeof message !== "object") return;
        const type = (message as { type?: unknown }).type;
        if (type === "reading") {
          this.emit({
            status: "reading",
            message: "正在浏览器本地读取 Demo…",
            mode: "browser-local",
          });
          return;
        }
        if (type === "parsing") {
          const stage =
            typeof (message as { stage?: unknown }).stage === "string"
              ? (message as { stage: string }).stage
              : undefined;
          this.emit({
            status: "parsing",
            message:
              stage === "selected-tick"
                ? "正在浏览器本地恢复所选 tick…"
                : "正在浏览器本地解析比赛事件…",
            mode: "browser-local",
            stage,
          });
          return;
        }
        if (type === "error") {
          settleReject(workerFailure(message));
          return;
        }
        if (type === finalType) {
          settleResolve(message);
        }
      };
      const onError = (event: MessageEvent) => {
        const detail = (event as unknown as { message?: unknown })?.message;
        settleReject(
          new LocalParserUnsupportedError(
            typeof detail === "string" && detail.length > 0
              ? `浏览器本地 parser 发生错误；未上传原始文件。(${detail})`
              : "浏览器本地 parser 发生错误；未上传原始文件。",
          ),
        );
      };
      cleanup = () => {
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
        if (this.pendingReject === settleReject) {
          this.pendingReject = null;
          this.pendingCleanup = null;
        }
      };
      this.pendingReject = settleReject;
      this.pendingCleanup = cleanup;
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
    });
  }
}
