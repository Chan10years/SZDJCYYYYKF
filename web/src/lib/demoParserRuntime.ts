import type {
  DemoParserInspectionInput,
  DemoParserSelectionInput,
  ParserRecord,
} from "@/domain/demoImportAdapter";

export const DEMO_IMPORT_EVENT_NAMES = [
  "player_first_connect",
  "round_start",
  "round_freeze_end",
  "round_end",
  "player_death",
  "bomb_pickup",
  "bomb_dropped",
  "bomb_planted",
  "bomb_defused",
  "bomb_exploded",
] as const;

export const DEMO_IMPORT_TICK_PROPS = [
  "X",
  "Y",
  "Z",
  "steamid",
  "name",
  "health",
  "is_alive",
  "m_iTeamNum",
  "active_weapon_name",
  "last_place_name",
  "game_time",
  "total_rounds_played",
] as const;

export type DemoParserFile = string | Uint8Array;

export type DemoParserBindings = {
  parseHeader: (file: DemoParserFile) => unknown;
  parseEvents: (
    file: DemoParserFile,
    eventNames: readonly string[],
    playerExtra: readonly string[],
    otherExtra: readonly string[],
  ) => unknown;
  parseTicks: (
    file: DemoParserFile,
    wantedProps: readonly string[],
    wantedTicks: readonly number[],
  ) => unknown;
};

type DemoFileMeta = {
  fileName: string;
  fileSize: number;
  demoSha256: string;
};

function asParserRecords(input: unknown, label: string): ParserRecord[] {
  if (!Array.isArray(input)) {
    throw new Error(`${label} parser result must be an array`);
  }
  return input.filter(
    (entry): entry is ParserRecord =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  );
}

function eventName(entry: ParserRecord): string | null {
  const value = entry.event_name ?? entry.event;
  return typeof value === "string" ? value : null;
}

function collectBaseInput(
  parser: DemoParserBindings,
  file: DemoParserFile,
  meta: DemoFileMeta,
): DemoParserInspectionInput {
  const events = asParserRecords(
    parser.parseEvents(file, DEMO_IMPORT_EVENT_NAMES, [], [
      "game_time",
      "total_rounds_played",
      "round",
      "is_warmup_period",
    ]),
    "parseEvents",
  );
  const byName = (name: string) =>
    events.filter((entry) => eventName(entry) === name);

  return {
    ...meta,
    header: parser.parseHeader(file),
    playerFirstConnectEvents: byName("player_first_connect"),
    roundStartEvents: byName("round_start"),
    roundFreezeEndEvents: byName("round_freeze_end"),
    roundEndEvents: byName("round_end"),
    killEvents: byName("player_death"),
    bombEvents: events.filter((entry) =>
      [
        "bomb_pickup",
        "bomb_dropped",
        "bomb_planted",
        "bomb_defused",
        "bomb_exploded",
      ].includes(eventName(entry) ?? ""),
    ),
  };
}

export function collectDemoParserInput(
  parser: DemoParserBindings,
  file: DemoParserFile,
  meta: DemoFileMeta,
): DemoParserInspectionInput {
  return collectBaseInput(parser, file, meta);
}

export function collectDemoParserSelectionInput(
  parser: DemoParserBindings,
  file: DemoParserFile,
  input: DemoFileMeta & { roundNumber: number; tick: number },
): DemoParserSelectionInput {
  const base = collectBaseInput(parser, file, input);
  const tickRows = asParserRecords(
    parser.parseTicks(file, DEMO_IMPORT_TICK_PROPS, [input.tick]),
    "parseTicks",
  );
  return {
    ...base,
    roundNumber: input.roundNumber,
    tick: input.tick,
    tickRows,
  };
}
