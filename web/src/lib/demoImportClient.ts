import { z } from "zod";
import {
  assertSelectableTick,
  DemoImportInspectionSchema,
  getSelectableRound,
  MAX_DEMO_FILE_SIZE_BYTES,
  type DemoImportInspection,
  type DemoImportStatus,
} from "@/domain/demoImport";
import {
  buildDemoImportInspection,
  buildDemoImportNormalizedState,
  type DemoParserInspectionInput,
  type DemoParserSelectionInput,
} from "@/domain/demoImportAdapter";
import { NormalizedMatchStateSchema } from "@/domain/normalizedMatchState";

export type DemoImportClientMode = "browser-local" | "compatibility";

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

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type DemoImportClientOptions = {
  workerFactory?: () => DemoImportWorkerLike;
  fetchImpl?: FetchImplementation;
  endpoint?: string;
  workerTimeoutMs?: number;
  onProgress?: (progress: DemoImportProgress) => void;
};

export type DemoImportClientLike = Pick<
  DemoImportClient,
  "load" | "select" | "reset"
>;

type LoadedDemo = {
  file: File;
  inspection: DemoImportInspection;
  mode: DemoImportClientMode;
  baseInput: DemoParserInspectionInput;
  worker: DemoImportWorkerLike | null;
};

const CompatibilityErrorSchema = z
  .object({
    kind: z.literal("error"),
    code: z.enum(["invalid-request", "unsupported", "parse-failed"]),
    message: z.string().trim().min(1),
  })
  .strict();

const CompatibilityInspectionSchema = z
  .object({
    kind: z.literal("inspection"),
    inspection: DemoImportInspectionSchema,
  })
  .strict();

const CompatibilitySelectionSchema = z
  .object({
    kind: z.literal("selection"),
    inspection: DemoImportInspectionSchema,
    normalizedMatchState: NormalizedMatchStateSchema,
  })
  .strict();

const CompatibilitySuccessSchema = z.union([
  CompatibilityInspectionSchema,
  CompatibilitySelectionSchema,
]);

class LocalParserUnsupportedError extends Error {
  constructor() {
    super("browser-local parser unsupported");
    this.name = "LocalParserUnsupportedError";
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
  };
}

function workerSelectionInput(
  messageInput: unknown,
  baseInput: DemoParserInspectionInput,
  roundNumber: number,
  tick: number,
): DemoParserSelectionInput {
  const message = asRecord(messageInput);
  const raw = asRecord(message.raw);
  return {
    ...baseInput,
    roundNumber,
    tick,
    tickRows: asArray(raw.tickRows),
    sideRows: Array.isArray(raw.sideRows) ? raw.sideRows : undefined,
  };
}

function defaultWorkerFactory(): DemoImportWorkerLike {
  if (typeof Worker === "undefined") {
    throw new LocalParserUnsupportedError();
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

function defaultFetchImpl(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return globalThis.fetch(input, init);
}

/**
 * Client-side orchestration for the product import flow. Browser WASM is the
 * first attempt; the compatibility request is only a real-byte parser path,
 * never a fixture fallback.
 */
export class DemoImportClient {
  private readonly workerFactory: () => DemoImportWorkerLike;
  private readonly fetchImpl: FetchImplementation;
  private readonly endpoint: string;
  private readonly workerTimeoutMs: number;
  private readonly onProgress: (progress: DemoImportProgress) => void;
  private loadedDemo: LoadedDemo | null = null;

  constructor(options: DemoImportClientOptions = {}) {
    this.workerFactory = options.workerFactory ?? defaultWorkerFactory;
    this.fetchImpl = options.fetchImpl ?? defaultFetchImpl;
    this.endpoint = options.endpoint ?? "/api/demo-import";
    this.workerTimeoutMs = options.workerTimeoutMs ?? 180_000;
    this.onProgress = options.onProgress ?? (() => undefined);
  }

  async load(file: File): Promise<DemoImportLoadResult> {
    this.validateFile(file);
    this.reset();
    this.emit({ status: "reading", message: "正在读取 Demo…" });
    let worker: DemoImportWorkerLike | null = null;
    try {
      worker = this.workerFactory();
      const resultPromise = this.waitForWorkerMessage(worker, "inspection");
      const buffer = await file.arrayBuffer();
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
      this.emit({
        status: "ready",
        message: "Demo 已解析，选择 Round 与时间截点。",
        mode: "browser-local",
      });
      return { inspection, mode: "browser-local" };
    } catch (error) {
      worker?.terminate();
      if (!(error instanceof LocalParserUnsupportedError)) {
        this.emit({
          status: "unsupported",
          message: "浏览器本地 parser 不支持当前 Demo，正在切换兼容 parser。",
        });
      }
      return this.loadWithCompatibilityParser(file);
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

    if (loaded.mode === "compatibility" || loaded.worker === null) {
      return this.selectWithCompatibilityParser(loaded.file, roundNumber, tick);
    }

    try {
      const resultPromise = this.waitForWorkerMessage(
        loaded.worker,
        "selection",
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
      );
      const normalizedMatchState = buildDemoImportNormalizedState(selectionInput);
      return { normalizedMatchState, mode: "browser-local" };
    } catch {
      loaded.worker.terminate();
      loaded.worker = null;
      loaded.mode = "compatibility";
      this.emit({
        status: "unsupported",
        message: "浏览器本地 parser 无法读取该截点，正在切换兼容 parser。",
        mode: "compatibility",
      });
      return this.selectWithCompatibilityParser(loaded.file, roundNumber, tick);
    }
  }

  reset(): void {
    this.loadedDemo?.worker?.terminate();
    this.loadedDemo = null;
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

  private emit(progress: DemoImportProgress): void {
    this.onProgress(progress);
  }

  private waitForWorkerMessage(
    worker: DemoImportWorkerLike,
    finalType: "inspection" | "selection",
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new LocalParserUnsupportedError());
      }, this.workerTimeoutMs);
      const onMessage = (event: MessageEvent) => {
        const message = event.data;
        if (!message || typeof message !== "object") {
          return;
        }
        const type = (message as { type?: unknown }).type;
        if (type === "reading") {
          this.emit({ status: "reading", message: "正在读取 Demo…" });
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
                ? "正在恢复所选精确 tick…"
                : "正在解析比赛事件…",
            stage,
          });
          return;
        }
        if (type === "error") {
          cleanup();
          reject(new LocalParserUnsupportedError());
          return;
        }
        if (type === finalType) {
          cleanup();
          resolve(message);
        }
      };
      const onError = () => {
        cleanup();
        reject(new LocalParserUnsupportedError());
      };
      const cleanup = () => {
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
      };
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
    });
  }

  private async loadWithCompatibilityParser(
    file: File,
  ): Promise<DemoImportLoadResult> {
    this.emit({
      status: "parsing",
      message: "兼容 parser 正在读取这场真实 Demo…",
      mode: "compatibility",
    });
    const response = await this.requestCompatibility(file, "inspect");
    if (response.kind !== "inspection") {
      throw new Error("兼容 parser 未返回 inspection");
    }
    const baseInput: DemoParserInspectionInput = {
      fileName: response.inspection.fileName,
      fileSize: response.inspection.fileSize,
      demoSha256: response.inspection.source.demoSha256,
      header: {
        map_name: response.inspection.map.name,
        demo_version_name: response.inspection.source.demoVersion,
        patch_version: response.inspection.source.patchVersion,
        server_name: response.inspection.matchLabel,
      },
      playerFirstConnectEvents: [],
      roundStartEvents: [],
      roundFreezeEndEvents: [],
      roundEndEvents: [],
      killEvents: [],
      bombEvents: [],
    };
    this.loadedDemo = {
      file,
      inspection: response.inspection,
      mode: "compatibility",
      baseInput,
      worker: null,
    };
    this.emit({
      status: "ready",
      message: "Demo 已解析，选择 Round 与时间截点。",
      mode: "compatibility",
    });
    return { inspection: response.inspection, mode: "compatibility" };
  }

  private async selectWithCompatibilityParser(
    file: File,
    roundNumber: number,
    tick: number,
  ): Promise<DemoImportSelectionResult> {
    this.emit({
      status: "parsing",
      message: "兼容 parser 正在恢复所选精确 tick…",
      mode: "compatibility",
    });
    const response = await this.requestCompatibility(file, "select", {
      roundNumber,
      tick,
    });
    if (response.kind !== "selection") {
      throw new Error("兼容 parser 未返回 selected state");
    }
    if (this.loadedDemo) {
      this.loadedDemo.inspection = response.inspection;
    }
    return {
      normalizedMatchState: response.normalizedMatchState,
      mode: "compatibility",
    };
  }

  private async requestCompatibility(
    file: File,
    action: "inspect" | "select",
    selection?: { roundNumber: number; tick: number },
  ): Promise<z.infer<typeof CompatibilitySuccessSchema>> {
    const form = new FormData();
    form.set("action", action);
    form.set("demo", file, file.name);
    if (selection) {
      form.set("roundNumber", String(selection.roundNumber));
      form.set("tick", String(selection.tick));
    }
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      body: form,
    });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("兼容 parser response is not JSON");
    }
    if (!response.ok) {
      const error = CompatibilityErrorSchema.safeParse(payload);
      throw new Error(
        error.success ? error.data.message : "兼容 parser request failed",
      );
    }
    const parsed = CompatibilitySuccessSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("兼容 parser response failed schema validation");
    }
    return parsed.data;
  }
}
