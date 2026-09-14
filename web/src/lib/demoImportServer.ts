import { createHash } from "node:crypto";
import {
  assertSelectableTick,
  getSelectableRound,
  MAX_DEMO_FILE_SIZE_BYTES,
  type DemoImportInspection,
} from "@/domain/demoImport";
import {
  buildDemoImportInspection,
  buildDemoImportNormalizedState,
  type DemoParserInspectionInput,
  type DemoParserSelectionInput,
} from "@/domain/demoImportAdapter";
import {
  collectDemoParserInput,
  DEMO_IMPORT_TICK_PROPS,
  type DemoParserBindings,
} from "@/lib/demoParserRuntime";
import type { NormalizedMatchState } from "@/domain/normalizedMatchState";

export type DemoImportServerAction = "inspect" | "select";

type DemoImportBufferBase = {
  /** Server compatibility parsing intentionally accepts bytes, never a path. */
  buffer: Uint8Array;
  fileName: string;
  fileSize: number;
  demoSha256?: string;
};

export type DemoImportBufferRequest = DemoImportBufferBase & {
  action: DemoImportServerAction;
  roundNumber?: number;
  tick?: number;
};

export type DemoImportInspectionResponse = {
  kind: "inspection";
  inspection: DemoImportInspection;
};

export type DemoImportSelectionResponse = {
  kind: "selection";
  inspection: DemoImportInspection;
  normalizedMatchState: NormalizedMatchState;
};

export type DemoImportServerResponse =
  | DemoImportInspectionResponse
  | DemoImportSelectionResponse;

export function sha256DemoBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function assertRequest(request: DemoImportBufferRequest): void {
  if (!request.fileName.toLowerCase().endsWith(".dem")) {
    throw new Error("只支持 .dem Demo 文件");
  }
  if (!Number.isInteger(request.fileSize) || request.fileSize <= 0) {
    throw new Error("Demo 文件为空或大小无效");
  }
  if (request.fileSize > MAX_DEMO_FILE_SIZE_BYTES) {
    throw new Error("Demo 文件超过当前 1 GB 导入上限");
  }
  if (request.buffer.byteLength !== request.fileSize) {
    throw new Error("Demo 文件读取长度与声明大小不一致");
  }
  if (request.demoSha256 !== undefined && !/^[A-F0-9]{64}$/.test(request.demoSha256)) {
    throw new Error("Demo SHA-256 不符合格式");
  }
}

function collectTickRows(
  parser: DemoParserBindings,
  file: Uint8Array,
  tick: number,
): readonly unknown[] {
  const result = parser.parseTicks(file, DEMO_IMPORT_TICK_PROPS, [tick]);
  if (!Array.isArray(result)) {
    throw new Error("parseTicks parser result must be an array");
  }
  return result;
}

function buildSelectionInput(
  base: DemoParserInspectionInput,
  parser: DemoParserBindings,
  file: Uint8Array,
  roundNumber: number,
  tick: number,
): DemoParserSelectionInput {
  const inspection = buildDemoImportInspection(base);
  const round = getSelectableRound(inspection, roundNumber);
  assertSelectableTick(round, tick);
  const tickRows = collectTickRows(parser, file, tick);
  return {
    ...base,
    roundNumber,
    tick,
    tickRows,
    sideRows:
      round.freezeEndTick === tick
        ? tickRows
        : collectTickRows(parser, file, round.freezeEndTick),
  };
}

/**
 * Compatibility parser boundary for the existing Next application runtime.
 * It accepts bytes only, computes provenance from those bytes, and never
 * reads a repository fixture or writes generated output.
 */
export function parseDemoImportBuffer(
  request: DemoImportBufferRequest,
  parser: DemoParserBindings,
): DemoImportServerResponse {
  assertRequest(request);
  const demoSha256 = request.demoSha256 ?? sha256DemoBytes(request.buffer);
  const base = collectDemoParserInput(parser, request.buffer, {
    fileName: request.fileName,
    fileSize: request.fileSize,
    demoSha256,
  });
  const inspection = buildDemoImportInspection(base);
  if (request.action === "inspect") {
    return { kind: "inspection", inspection };
  }

  const roundNumber = request.roundNumber;
  const tick = request.tick;
  if (
    typeof roundNumber !== "number" ||
    typeof tick !== "number" ||
    !Number.isInteger(roundNumber) ||
    !Number.isInteger(tick)
  ) {
    throw new Error("Round 与 tick 必须是整数");
  }
  const selectionInput = buildSelectionInput(
    base,
    parser,
    request.buffer,
    roundNumber,
    tick,
  );
  return {
    kind: "selection",
    inspection,
    normalizedMatchState: buildDemoImportNormalizedState(selectionInput),
  };
}
