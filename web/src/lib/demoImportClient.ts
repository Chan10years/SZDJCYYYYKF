import { z } from "zod";
import {
  assertSelectableTick,
  getSelectableRound,
  MAX_DEMO_FILE_SIZE_BYTES,
  type DemoImportInspection,
  type DemoImportRound,
  type DemoImportStatus,
} from "@/domain/demoImport";
import {
  buildDemoImportInspection,
  buildDemoImportNormalizedState,
  type DemoParserInspectionInput,
  type DemoParserSelectionInput,
} from "@/domain/demoImportAdapter";
import { NormalizedMatchStateSchema } from "@/domain/normalizedMatchState";

export type DemoImportClientMode = "browser-local";

export type DemoImportProgress = {
  status: DemoImportStatus;
  message: string;
  mode?: DemoImportClientMode;
  stage?: string;
};

export type DemoImportLoadResult = {
  inspection: DemoImportInspection;
  mode: DemoImportClientMode;
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
  "load" | "select" | "reset" | "cancel"
>;

type LoadedDemo = {
  file: File;
  inspection: DemoImportInspection;
  mode: DemoImportClientMode;
  baseInput: DemoParserInspectionInput;
  worker: DemoImportWorkerLike;
};

export class LocalParserUnsupportedError extends Error {
  constructor(message = "浏览器本地 parser 不支持当前 Demo；未上传原始文件。") {
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
    throw new LocalParserUnsupportedError();
  }
  return input as Record<string, unknown>;
}

function asArray(input: unknown): readonly unknown[] {
  if (!Array.isArray(input)) {
    throw new LocalParserUnsupportedError();
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
    playerFirstConnectEvents: asArray(raw.playerFirstConnectEvents),
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
    throw new LocalParserUnsupportedError(
      "浏览器本地 parser 未提供可信的实际 tick；已拒绝该截点。",
    );
  }
  const actualTick = actualTickValue;
  if (!Number.isInteger(actualTick)) {
    throw new LocalParserUnsupportedError(
      "浏览器本地 parser 返回了无效的实际 tick；已拒绝该截点。",
    );
  }
  if (actualTick > requestedTick) {
    throw new LocalParserUnsupportedError(
      `浏览器本地 parser 返回了未来 sample tick ${actualTick}，请求 tick 是 ${requestedTick}；已拒绝该截点。`,
    );
  }
  if (actualTick !== requestedTick) {
    throw new LocalParserUnsupportedError(
      `浏览器本地 parser 返回的 sample tick ${actualTick} 与请求 tick ${requestedTick} 不一致；已拒绝该截点。`,
    );
  }
  if (
    actualTick < round.minSelectableTick ||
    actualTick > round.maxSelectableTick ||
    actualTick % (round.tickStep ?? 1) !== 0
  ) {
    throw new LocalParserUnsupportedError(
      "浏览器本地 parser 返回的实际 tick 不在可信可选范围内；已拒绝该截点。",
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
  private activeWorker: DemoImportWorkerLike | null = null;
  private generation = 0;
  private pendingReject: ((error: Error) => void) | null = null;
  private pendingCleanup: (() => void) | null = null;

  constructor(options: DemoImportClientOptions = {}) {
    this.workerFactory = options.workerFactory ?? defaultWorkerFactory;
    this.workerTimeoutMs = options.workerTimeoutMs ?? 180_000;
    this.onProgress = options.onProgress ?? (() => undefined);
  }

  async load(file: File): Promise<DemoImportLoadResult> {
    this.validateFile(file);
    this.reset();
    const generation = this.generation;
    this.emit({
      status: "reading",
      message: "正在浏览器本地读取 Demo…",
      mode: "browser-local",
    });
    let worker: DemoImportWorkerLike | null = null;
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
      const baseInput = workerBaseInput(message, file);
      const inspection = buildDemoImportInspection(baseInput);
      this.loadedDemo = {
        file,
        inspection,
        mode: "browser-local",
        baseInput,
        worker,
      };
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
      worker?.terminate();
      if (this.activeWorker === worker) {
        this.activeWorker = null;
      }
      const parserError = this.asParserError(error);
      this.emit({
        status: "unsupported",
        message: parserError.message,
        mode: "browser-local",
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
      const normalizedMatchState = buildDemoImportNormalizedState(selectionInput);
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
        status: "unsupported",
        message: parserError.message,
        mode: "browser-local",
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
    this.activeWorker = null;
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

  private asParserError(error: unknown): LocalParserUnsupportedError {
    if (error instanceof LocalParserUnsupportedError) {
      return error;
    }
    const detail = error instanceof Error ? error.message : String(error);
    const detailSuffix =
      detail && detail !== "undefined"
        ? `（${detail.slice(0, 240)}）`
        : "";
    return new LocalParserUnsupportedError(
      detail.includes("超时")
        ? "浏览器本地 parser 超时；未上传原始文件。"
        : `浏览器本地 parser 无法读取当前 Demo；未上传原始文件。${detailSuffix}`,
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
          const detail =
            typeof (message as { message?: unknown }).message === "string"
              ? (message as { message: string }).message
              : undefined;
          settleReject(
            new LocalParserUnsupportedError(
              detail ?? "浏览器本地 parser 无法读取当前 Demo；未上传原始文件。",
            ),
          );
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
