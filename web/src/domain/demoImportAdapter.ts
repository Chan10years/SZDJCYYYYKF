import {
  DemoImportInspectionSchema,
  DemoImportRoundSchema,
  assertSelectableTick,
  formatDemoClock,
  getSelectableRound,
  type DemoImportInspection,
  type DemoImportMarker,
  type DemoImportRound,
} from "./demoImport";
import {
  parseNormalizedMatchState,
  type NormalizedMatchState,
} from "./normalizedMatchState";
import {
  MIRAGE_RADAR_METADATA,
  type RadarMapMetadata,
} from "./coordinateAdapter";

export const DEMO_IMPORT_PARSER = "demoparser2" as const;
export const DEMO_IMPORT_PARSER_VERSION = "0.42.0" as const;
export const DEMO_IMPORT_ROUND_DURATION_SECONDS = 115;

export type ParserRecord = Record<string, unknown>;

export type DemoParserInspectionInput = {
  fileName: string;
  fileSize: number;
  demoSha256: string;
  header: unknown;
  playerFirstConnectEvents: readonly unknown[];
  roundStartEvents: readonly unknown[];
  roundFreezeEndEvents: readonly unknown[];
  roundEndEvents: readonly unknown[];
  killEvents?: readonly unknown[];
  bombEvents?: readonly unknown[];
};

export type DemoParserSelectionInput = DemoParserInspectionInput & {
  roundNumber: number;
  tick: number;
  tickRows: readonly unknown[];
  /** Full-player snapshot at freeze end; dead selected-tick rows may omit team. */
  sideRows?: readonly unknown[];
};

type RoundEvent = ParserRecord & {
  tick: number;
  roundNumber: number;
  parserRound: number;
  gameTime: number;
};

type Header = {
  mapName: string;
  demoVersion: string;
  patchVersion: string;
  serverName: string;
};

const MAP_OVERVIEWS: Record<string, RadarMapMetadata> = {
  de_mirage: MIRAGE_RADAR_METADATA,
  de_overpass: {
    posX: -4831,
    posY: 1781,
    scale: 5.2,
    radarWidth: 1024,
    radarHeight: 1024,
    source:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/data/radar_info/de_overpass.txt",
  },
  de_dust2: {
    posX: -2476,
    posY: 3239,
    scale: 4.4,
    radarWidth: 1024,
    radarHeight: 1024,
    source:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/data/radar_info/de_dust2.txt",
  },
};

function asRecord(input: unknown, label: string): ParserRecord {
  if (input instanceof Map) {
    return Object.fromEntries(input.entries());
  }
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as ParserRecord;
  }
  throw new Error(`${label} must be a parser record`);
}

function asRecords(input: readonly unknown[], label: string): ParserRecord[] {
  return input.map((item, index) => asRecord(item, `${label}[${index}]`));
}

function readString(
  record: ParserRecord,
  keys: readonly string[],
  label: string,
): string;
function readString(
  record: ParserRecord,
  keys: readonly string[],
  label: string,
  options: { required: false },
): string | null;
function readString(
  record: ParserRecord,
  keys: readonly string[],
  label: string,
  options: { required?: boolean } = {},
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  if (options.required === false) {
    return null;
  }
  throw new Error(`${label} is unavailable in parser output`);
}

function readNumber(
  record: ParserRecord,
  keys: readonly string[],
  label: string,
): number;
function readNumber(
  record: ParserRecord,
  keys: readonly string[],
  label: string,
  options: { required: false; integer?: boolean },
): number | null;
function readNumber(
  record: ParserRecord,
  keys: readonly string[],
  label: string,
  options: { required?: true; integer?: boolean },
): number;
function readNumber(
  record: ParserRecord,
  keys: readonly string[],
  label: string,
  options: { required?: boolean; integer?: boolean } = {},
): number | null {
  for (const key of keys) {
    const value = record[key];
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim().length > 0
          ? Number(value)
          : Number.NaN;
    if (Number.isFinite(numeric) && (!options.integer || Number.isInteger(numeric))) {
      return numeric;
    }
  }
  if (options.required === false) {
    return null;
  }
  throw new Error(`${label} is unavailable in parser output`);
}

function readBoolean(
  record: ParserRecord,
  keys: readonly string[],
  label: string,
): boolean {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (value === "true" || value === "false") {
      return value === "true";
    }
  }
  throw new Error(`${label} is unavailable in parser output`);
}

function normalizeMapName(record: ParserRecord): string {
  const value = readString(record, ["map_name", "mapName"], "map_name");
  const normalized = value.toLowerCase();
  return normalized.startsWith("de_") ? normalized : `de_${normalized}`;
}

function readSide(record: ParserRecord, label: string): "CT" | "T" {
  const named = readString(record, ["team", "side"], label, { required: false });
  if (named === "CT" || named === "ct" || named === "3") {
    return "CT";
  }
  if (named === "T" || named === "t" || named === "2") {
    return "T";
  }
  const teamNum = readNumber(record, ["m_iTeamNum", "team_num", "teamNum"], label, {
    required: false,
    integer: true,
  });
  if (teamNum === 3) {
    return "CT";
  }
  if (teamNum === 2) {
    return "T";
  }
  throw new Error(`${label} does not contain a supported CT/T team value`);
}

function readEventRound(
  record: ParserRecord,
  fallbackRoundNumber: number | null = null,
): { roundNumber: number; parserRound: number } {
  const round = readNumber(record, ["round"], "round", {
    required: false,
    integer: true,
  });
  const parserRound = readNumber(
    record,
    ["total_rounds_played", "parserRound"],
    "total_rounds_played",
    { required: false, integer: true },
  );
  const roundNumber =
    round !== null && round >= 1
      ? round
      : parserRound !== null && parserRound >= 0
        ? parserRound + 1
        : fallbackRoundNumber;
  if (roundNumber === null || roundNumber < 1) {
    throw new Error("parser event does not identify a human Round");
  }
  return {
    roundNumber,
    parserRound:
      parserRound !== null && parserRound >= 0 ? parserRound : roundNumber - 1,
  };
}

function normalizeEvent(
  record: ParserRecord,
  label: string,
  fallbackRoundNumber: number | null = null,
): RoundEvent {
  const tick = readNumber(record, ["tick"], `${label}.tick`, {
    integer: true,
  });
  const gameTime = readNumber(
    record,
    ["game_time", "gameTime"],
    `${label}.game_time`,
  );
  return {
    ...record,
    tick,
    gameTime,
    ...readEventRound(record, fallbackRoundNumber),
  };
}

function inferTickrate(roundStarts: readonly RoundEvent[]): number {
  const samples: number[] = [];
  for (let index = 1; index < roundStarts.length; index += 1) {
    const previous = roundStarts[index - 1];
    const current = roundStarts[index];
    const tickDelta = current.tick - previous.tick;
    const timeDelta = current.gameTime - previous.gameTime;
    if (tickDelta > 0 && timeDelta > 0) {
      const candidate = tickDelta / timeDelta;
      if (Number.isFinite(candidate) && candidate >= 16 && candidate <= 256) {
        samples.push(candidate);
      }
    }
  }
  if (samples.length === 0) {
    return 64;
  }
  samples.sort((a, b) => a - b);
  const middle = Math.floor(samples.length / 2);
  return Math.round(
    (samples.length % 2 === 0
      ? (samples[middle - 1] + samples[middle]) / 2
      : samples[middle]) * 100,
  ) / 100;
}

function matchRoundEvent(
  events: readonly RoundEvent[],
  round: RoundEvent,
  fallbackIndex: number,
): RoundEvent | null {
  return (
    events.find(
      (event) =>
        event.tick > round.tick &&
        event.roundNumber === round.roundNumber,
    ) ??
    events.find(
      (event) =>
        event.tick > round.tick && event.parserRound === round.parserRound,
    ) ?? events[fallbackIndex] ?? null
  );
}

function createRoundDescriptors(
  input: DemoParserInspectionInput,
): DemoImportRound[] {
  const starts = asRecords(input.roundStartEvents, "round_start")
    .filter((event) => event.is_warmup_period !== true)
    .map((event) => normalizeEvent(event, "round_start"))
    .filter((event) => event.roundNumber >= 1)
    .sort((a, b) => a.tick - b.tick);
  const freezes = asRecords(input.roundFreezeEndEvents, "round_freeze_end")
    .map((event) => normalizeEvent(event, "round_freeze_end"))
    .sort((a, b) => a.tick - b.tick);
  const ends = asRecords(input.roundEndEvents, "round_end")
    .filter((event) => event.is_warmup_period !== true)
    .map((event) => normalizeEvent(event, "round_end"))
    .sort((a, b) => a.tick - b.tick);

  if (starts.length === 0 || freezes.length === 0) {
    throw new Error("Demo does not contain enough round boundary events");
  }

  const tickrate = inferTickrate(starts);
  const rounds = starts.flatMap((start, index) => {
    const freeze = matchRoundEvent(freezes, start, index);
    if (!freeze || freeze.tick < start.tick) {
      return [];
    }
    const end = matchRoundEvent(ends, start, index);
    const nextStart = starts[index + 1];
    const maxSelectableTick = end
      ? end.tick - 1
      : nextStart
        ? nextStart.tick - 1
        : freeze.tick +
          Math.floor(DEMO_IMPORT_ROUND_DURATION_SECONDS * tickrate) -
          1;
    if (maxSelectableTick < freeze.tick) {
      return [];
    }
    return [
      DemoImportRoundSchema.parse({
        number: start.roundNumber,
        parserRound: start.parserRound,
        startTick: start.tick,
        freezeEndTick: freeze.tick,
        endTick: end?.tick ?? null,
        minSelectableTick: freeze.tick,
        maxSelectableTick,
        startGameTime: start.gameTime,
        freezeEndGameTime: freeze.gameTime,
        endGameTime: end?.gameTime ?? null,
        tickrate,
        durationSeconds: DEMO_IMPORT_ROUND_DURATION_SECONDS,
      }),
    ];
  });

  if (rounds.length === 0) {
    throw new Error("Demo does not contain a selectable Round");
  }
  return rounds;
}

function buildInspectionMarkers(
  input: DemoParserInspectionInput,
  rounds: readonly DemoImportRound[],
): DemoImportMarker[] {
  const entries: Array<{ kind: DemoImportMarker["kind"]; record: ParserRecord }> = [];
  for (const record of asRecords(input.killEvents ?? [], "player_death")) {
    entries.push({ kind: "kill", record });
  }
  for (const record of asRecords(input.bombEvents ?? [], "bomb events")) {
    const eventName = readString(record, ["event_name", "event"], "bomb event", {
      required: false,
    });
    if (
      eventName === "bomb_pickup" ||
      eventName === "bomb_dropped" ||
      eventName === "bomb_planted" ||
      eventName === "bomb_defused" ||
      eventName === "bomb_exploded"
    ) {
      entries.push({ kind: eventName, record });
    }
  }
  return entries
    .flatMap(({ kind, record }) => {
      const event = normalizeEvent(record, kind);
      const round = rounds.find(
        (candidate) => candidate.number === event.roundNumber,
      );
      if (
        !round ||
        event.tick < round.startTick ||
        (round.endTick !== null && event.tick >= round.endTick)
      ) {
        return [];
      }
      const labels: Record<DemoImportMarker["kind"], string> = {
        round_start: "回合开始 · 仅用于定位",
        kill: "击杀事件 · 仅用于定位",
        bomb_pickup: "拾取 C4 · 仅用于定位",
        bomb_dropped: "掉落 C4 · 仅用于定位",
        bomb_planted: "下包事件 · 仅用于定位",
        bomb_defused: "拆包事件 · 仅用于定位",
        bomb_exploded: "爆炸事件 · 仅用于定位",
        round_end: "回合结束 · 仅用于定位",
      };
      return [
        {
          kind,
          roundNumber: event.roundNumber,
          tick: event.tick,
          label: labels[kind],
          navigationOnly: true as const,
        },
      ];
    })
    .sort((a, b) => a.tick - b.tick);
}

function readHeader(input: unknown): Header {
  const header = asRecord(input, "header");
  return {
    mapName: normalizeMapName(header),
    demoVersion: readString(
      header,
      ["demo_version_name", "demoVersion"],
      "demo_version_name",
    ),
    patchVersion: readString(
      header,
      ["patch_version", "network_protocol", "patchVersion"],
      "patch_version",
    ),
    serverName:
      readString(header, ["server_name", "serverName"], "server_name", {
        required: false,
      }) ?? "未命名 Demo 录制",
  };
}

function buildInspectionPlayers(input: DemoParserInspectionInput) {
  const seen = new Map<string, { id: string; name: string; side: "CT" | "T" }>();
  for (const [index, record] of asRecords(
    input.playerFirstConnectEvents,
    "player_first_connect",
  ).entries()) {
    const id = readString(
      record,
      ["steamid", "user_steamid", "id"],
      `player_first_connect[${index}].steamid`,
    );
    const name = readString(
      record,
      ["name", "user_name", "player_name"],
      `player_first_connect[${index}].name`,
    );
    if (!seen.has(id)) {
      seen.set(id, {
        id,
        name,
        side: readSide(record, `player_first_connect[${index}].team`),
      });
    }
  }
  const players = [...seen.values()];
  if (
    players.length !== 10 ||
    players.filter((player) => player.side === "CT").length !== 5 ||
    players.filter((player) => player.side === "T").length !== 5
  ) {
    throw new Error("Demo does not contain ten unique players with five CT and five T");
  }
  return players;
}

export function buildDemoImportInspection(
  input: DemoParserInspectionInput,
): DemoImportInspection {
  const header = readHeader(input.header);
  const players = buildInspectionPlayers(input);
  const rounds = createRoundDescriptors(input);
  const overview = MAP_OVERVIEWS[header.mapName] ?? null;
  const warnings = [
    "队伍组织名未从 Demo 原生恢复，以下使用阵营标签",
    "机器事件 marker 仅用于定位，不代表关键决策或推荐复盘时刻",
    "Round 结束 tick 不在可选择范围内，避免把比赛结果带入决策截点",
  ];
  if (!overview) {
    warnings.push("该地图缺少已批准的 overview metadata，当前只能检查边界，不能生成 normalized state");
  }
  warnings.push("当前 Demo 没有自动附带可用于战术语义的地图 raster；空间预览需 Human QA 明确确认");

  return DemoImportInspectionSchema.parse({
    schemaVersion: 1,
    fileName: input.fileName,
    fileSize: input.fileSize,
    source: {
      kind: "local-demo",
      demoSha256: input.demoSha256,
      parser: DEMO_IMPORT_PARSER,
      parserVersion: DEMO_IMPORT_PARSER_VERSION,
      demoVersion: header.demoVersion,
      patchVersion: header.patchVersion,
    },
    matchLabel: header.serverName,
    map: {
      name: header.mapName,
      overview,
      renderAvailable: false,
    },
    teams: [
      { label: "T side", side: "T", playerCount: 5 },
      { label: "CT side", side: "CT", playerCount: 5 },
    ],
    players,
    rounds,
    markers: buildInspectionMarkers(input, rounds),
    warnings,
  });
}

function readOptionalString(record: ParserRecord, keys: readonly string[]): string | null {
  return readString(record, keys, keys[0], { required: false });
}

function normalizeTickRows(
  rows: readonly unknown[],
  roster: readonly DemoImportInspection["players"][number][],
  sideRows: readonly unknown[] = [],
) {
  const rosterById = new Map(roster.map((player) => [player.id, player]));
  const sideById = new Map<string, "CT" | "T">();
  for (const [index, row] of asRecords(sideRows, "freeze-end parseTicks").entries()) {
    const id = readString(row, ["steamid", "user_steamid", "id"], `freeze-end parseTicks[${index}].steamid`);
    const namedSide = readString(row, ["team", "side"], "freeze-end team", { required: false });
    const teamNumber = readNumber(row, ["m_iTeamNum", "team_num", "teamNum"], "freeze-end team", { required: false, integer: true });
    if (namedSide !== null || teamNumber !== null) {
      sideById.set(id, readSide(row, `freeze-end parseTicks[${index}].team`));
    }
  }
  const normalized = asRecords(rows, "parseTicks").map((record, index) => {
    const id = readString(record, ["steamid", "user_steamid", "id"], `parseTicks[${index}].steamid`);
    const name = readString(record, ["name", "user_name", "player_name"], `parseTicks[${index}].name`);
    const rosterPlayer = rosterById.get(id);
    const side =
      sideById.get(id) ??
      rosterPlayer?.side ??
      readSide(record, `parseTicks[${index}].team`);
    return {
      id,
      name,
      side,
      health: readNumber(record, ["health", "m_iHealth"], `parseTicks[${index}].health`, {
        integer: true,
      }),
      alive: readBoolean(record, ["is_alive", "isAlive"], `parseTicks[${index}].is_alive`),
      worldPosition: {
        x: readNumber(record, ["X", "x"], `parseTicks[${index}].X`),
        y: readNumber(record, ["Y", "y"], `parseTicks[${index}].Y`),
        z: readNumber(record, ["Z", "z"], `parseTicks[${index}].Z`),
      },
      weapon: readOptionalString(record, ["active_weapon_name", "weapon"]),
      place: readOptionalString(record, ["last_place_name", "place"]),
      gameTime: readNumber(record, ["game_time", "gameTime"], `parseTicks[${index}].game_time`),
    };
  });
  const ids = new Set(normalized.map((player) => player.id));
  if (
    normalized.length !== 10 ||
    ids.size !== normalized.length ||
    normalized.filter((player) => player.side === "CT").length !== 5 ||
    normalized.filter((player) => player.side === "T").length !== 5
  ) {
    throw new Error("exact tick does not contain ten unique players with five CT and five T");
  }
  const gameTimes = normalized.map((player) => player.gameTime);
  const gameTime = gameTimes[0];
  if (gameTimes.some((candidate) => Math.abs(candidate - gameTime) > 0.2)) {
    throw new Error("exact tick contains inconsistent game_time values");
  }
  return { players: normalized, gameTime };
}

type BombState = {
  status: "carried" | "dropped" | "planted" | "defused" | "exploded" | "unavailable";
  carrierId: string | null;
  carrierName: string | null;
  plantGameTime: number | null;
};

function foldBombState(
  input: DemoParserSelectionInput,
  selectedRound: DemoImportRound,
): BombState {
  let state: BombState = {
    status: "unavailable",
    carrierId: null,
    carrierName: null,
    plantGameTime: null,
  };
  const events = asRecords(input.bombEvents ?? [], "bomb events")
    .map((record) => {
      const event = normalizeEvent(record, "bomb event", selectedRound.number);
      return {
        record,
        event,
      };
    })
    .filter(
      ({ event }) =>
        event.roundNumber === selectedRound.number &&
        event.tick <= input.tick,
    )
    .sort((a, b) => a.event.tick - b.event.tick);

  for (const { record, event } of events) {
    const eventName = readString(record, ["event_name", "event"], "bomb event");
    if (eventName === "bomb_pickup") {
      state = {
        status: "carried",
        carrierId: readOptionalString(record, ["user_steamid", "steamid"]),
        carrierName: readOptionalString(record, ["user_name", "name"]),
        plantGameTime: null,
      };
    } else if (eventName === "bomb_dropped") {
      state = {
        status: "dropped",
        carrierId: null,
        carrierName: null,
        plantGameTime: null,
      };
    } else if (eventName === "bomb_planted") {
      state = {
        status: "planted",
        carrierId: null,
        carrierName: null,
        plantGameTime: event.gameTime,
      };
    } else if (eventName === "bomb_defused") {
      state = {
        status: "defused",
        carrierId: null,
        carrierName: null,
        plantGameTime: state.plantGameTime,
      };
    } else if (eventName === "bomb_exploded") {
      state = {
        status: "exploded",
        carrierId: null,
        carrierName: null,
        plantGameTime: state.plantGameTime,
      };
    }
  }
  return state;
}

function buildScore(
  input: DemoParserSelectionInput,
  selectedRound: DemoImportRound,
): Record<string, number> {
  const score: Record<string, number> = { "T side": 0, "CT side": 0 };
  for (const record of asRecords(input.roundEndEvents, "round_end")) {
    const event = normalizeEvent(record, "round_end");
    if (event.roundNumber >= selectedRound.number) {
      continue;
    }
    const winner = readString(record, ["winner"], "round_end.winner", {
      required: false,
    });
    if (winner === "T" || winner === "CT") {
      score[`${winner} side`] += 1;
    }
  }
  return score;
}

function buildNormalizedTime(
  selectedRound: DemoImportRound,
  gameTime: number,
  bomb: BombState,
) {
  const elapsedSeconds = Math.max(0, gameTime - selectedRound.startGameTime);
  if (bomb.status === "planted" && bomb.plantGameTime !== null) {
    const postPlantElapsedSeconds = Math.max(0, gameTime - bomb.plantGameTime);
    return {
      display: `爆炸后 ${formatDemoClock(postPlantElapsedSeconds)}`,
      semantics: "post_plant_elapsed" as const,
      remainingSeconds: null,
      elapsedSeconds,
      postPlantElapsedSeconds,
      roundDurationSeconds: DEMO_IMPORT_ROUND_DURATION_SECONDS,
      roundStartTick: selectedRound.startTick,
      roundStartGameTime: selectedRound.startGameTime,
      gameTime,
      tickrate: selectedRound.tickrate,
      warningTick: null,
      warningGameTime: null,
    };
  }
  const remainingSeconds = Math.max(
    0,
    selectedRound.durationSeconds - elapsedSeconds,
  );
  return {
    display: formatDemoClock(remainingSeconds),
    semantics: "round_clock_remaining" as const,
    remainingSeconds,
    elapsedSeconds,
    postPlantElapsedSeconds: null,
    roundDurationSeconds: selectedRound.durationSeconds,
    roundStartTick: selectedRound.startTick,
    roundStartGameTime: selectedRound.startGameTime,
    gameTime,
    tickrate: selectedRound.tickrate,
    warningTick: null,
    warningGameTime: null,
  };
}

export function buildDemoImportNormalizedState(
  input: DemoParserSelectionInput,
): NormalizedMatchState {
  const inspection = buildDemoImportInspection(input);
  const selectedRound = getSelectableRound(inspection, input.roundNumber);
  assertSelectableTick(selectedRound, input.tick);
  const overview = inspection.map.overview;
  if (!overview) {
    throw new Error("map overview metadata is unavailable for normalized state");
  }
  const { players, gameTime } = normalizeTickRows(
    input.tickRows,
    inspection.players,
    input.sideRows,
  );
  const bomb = foldBombState(input, selectedRound);
  const normalizedBomb = {
    status: bomb.status,
    carrierId: bomb.carrierId,
    carrierName: bomb.carrierName,
    derivedFrom: `demoparser2 bomb_* events through tick ${input.tick}`,
    rawState: {
      isPlanted: bomb.status === "planted" ? true : bomb.status === "unavailable" ? null : false,
      isDropped: bomb.status === "dropped" ? true : bomb.status === "unavailable" ? null : false,
    },
  } as const;
  const header = readHeader(input.header);
  const score = buildScore(input, selectedRound);
  return parseNormalizedMatchState({
    schemaVersion: 1,
    source: {
      kind: "offline-demo",
      demoFile: input.fileName,
      demoSha256: input.demoSha256,
      match: header.serverName,
      parser: DEMO_IMPORT_PARSER,
      parserVersion: DEMO_IMPORT_PARSER_VERSION,
      demoVersion: header.demoVersion,
      patchVersion: header.patchVersion,
      selectionEvidence: `header + Round ${selectedRound.number} + exact tick ${input.tick}; player rows and bomb events are limited to the selected tick or earlier`,
    },
    map: {
      name: inspection.map.name,
      asset: null,
      overview,
    },
    round: {
      number: selectedRound.number,
      parserRound: selectedRound.parserRound,
      boundaryTick: selectedRound.freezeEndTick,
      score,
    },
    tick: input.tick,
    time: buildNormalizedTime(selectedRound, gameTime, bomb),
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      team: `${player.side} side`,
      side: player.side,
      alive: player.alive,
      health: player.health,
      weapon: player.weapon,
      worldPosition: player.worldPosition,
      place: player.place,
    })),
    bomb: normalizedBomb,
    extraction: {
      verificationStatus: "draft",
      humanQaRequired: true,
      roundNumberBasis: "demoparser2 round_start + round_freeze_end; human Round is parser round + 1 when only total_rounds_played is available",
      availableFields: [
        "header.map_name / demo version / patch version",
        "round_start / round_freeze_end / round_end",
        "player_first_connect identity + team side",
        "X/Y/Z, health, is_alive, active_weapon_name, last_place_name, game_time",
        "bomb_* events at or before the selected tick",
      ],
      unavailableFields: [
        "队伍组织名称（Demo 未提供）",
        "已选 tick 之后的比赛事件",
        "Human Known / Unknown 与战术语义",
        "未经过 Human QA 的地图 raster / route calibration",
      ],
      derivedFields: [
        "T/CT side label from demoparser2 team value",
        "score from round_end winner events before the selected Round",
        "clock from round_start/game_time and the declared 115-second rule",
        "bomb status from ordered bomb_* events through the selected tick",
        "team label as T side / CT side because organization names are unavailable",
      ],
    },
  });
}
