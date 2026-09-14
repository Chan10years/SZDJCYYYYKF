import {
  parseEvents,
  parseHeader,
  parseTicks,
} from "@laihoe/demoparser2";
import { z } from "zod";
import {
  parseDemoImportBuffer,
} from "@/lib/demoImportServer";
import { MAX_DEMO_FILE_SIZE_BYTES } from "@/domain/demoImport";
import type { DemoParserBindings } from "@/lib/demoParserRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ImportActionSchema = z.enum(["inspect", "select"]);

type ErrorCode = "invalid-request" | "unsupported" | "parse-failed";

function nativeParserBindings(): DemoParserBindings {
  return {
    parseHeader: (file) => parseHeader(file as Buffer),
    parseEvents: (file, eventNames, playerExtra, otherExtra) =>
      parseEvents(
        file as Buffer,
        [...eventNames],
        [...playerExtra],
        [...otherExtra],
      ),
    parseTicks: (file, wantedProps, wantedTicks) =>
      parseTicks(file as Buffer, [...wantedProps], [...wantedTicks]),
  };
}

function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
): Response {
  return Response.json(
    {
      kind: "error",
      code,
      message,
    },
    { status },
  );
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return (
    value !== null &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    "name" in value &&
    typeof value.name === "string" &&
    "size" in value &&
    typeof value.size === "number"
  );
}

function parseIntegerField(form: FormData, name: string): number | undefined {
  const value = form.get(name);
  if (value === null || typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("invalid-request", "无法读取 Demo 上传内容。", 400);
  }

  const action = ImportActionSchema.safeParse(form.get("action"));
  if (!action.success) {
    return errorResponse("invalid-request", "导入操作无效。", 400);
  }
  const file = form.get("demo");
  if (!isFileLike(file)) {
    return errorResponse("invalid-request", "请选择一个 .dem 文件。", 400);
  }
  if (!file.name.toLowerCase().endsWith(".dem")) {
    return errorResponse("unsupported", "当前只支持 CS2 .dem 文件。", 415);
  }
  if (file.size <= 0) {
    return errorResponse("unsupported", "Demo 文件为空。", 422);
  }
  if (file.size > MAX_DEMO_FILE_SIZE_BYTES) {
    return errorResponse("unsupported", "Demo 文件超过当前 1 GB 导入上限。", 413);
  }

  let roundNumber: number | undefined;
  let tick: number | undefined;
  try {
    roundNumber = parseIntegerField(form, "roundNumber");
    tick = parseIntegerField(form, "tick");
  } catch {
    return errorResponse("invalid-request", "Round 与 tick 必须是整数。", 400);
  }
  if (action.data === "select" && (roundNumber === undefined || tick === undefined)) {
    return errorResponse("invalid-request", "选择状态需要 Round 与 tick。", 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = parseDemoImportBuffer(
      {
        action: action.data,
        buffer,
        fileName: file.name,
        fileSize: file.size,
        roundNumber,
        tick,
      },
      nativeParserBindings(),
    );
    return Response.json(result, { status: 200 });
  } catch {
    return errorResponse(
      "parse-failed",
      "这场 Demo 当前无法读取。请确认文件完整，并来自受支持的 CS2 版本。",
      422,
    );
  }
}
