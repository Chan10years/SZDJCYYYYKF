import {
  DemoImportInspectionSchema,
  DemoImportRosterConfirmationSchema,
  DemoImportRoundSchema,
  assertSelectableTick,
  formatDemoClock,
  getSelectableRound,
  type DemoImportCompetitiveParticipationEvidence,
  type DemoImportInspection,
  type DemoImportMatchRosterPlayer,
  type DemoImportMarker,
  type DemoImportPlayerIdentity,
  type DemoImportRosterConfirmation,
  type DemoImportRosterResolution,
  type DemoImportRoundSidePlayer,
  type DemoImportRoundSideSnapshot,
  type DemoImportRound,
  DEMO_IMPORT_DIRECT_COMPETITIVE_EVENT_KINDS,
} from "./demoImport";
import {
  DemoMapMetadataError,
  DemoRosterRecoveryError,
  DemoRosterValidationError,
  type DemoRosterIdentityOption,
} from "./demoImportErrors";
import {
  parseNormalizedMatchState,
  type NormalizedMatchState,
} from "./normalizedMatchState";
import {
  ANCIENT_RADAR_METADATA,
  MIRAGE_RADAR_METADATA,
  type RadarMapMetadata,
} from "./coordinateAdapter";

export const DEMO_IMPORT_PARSER = "demoparser2" as const;
export const DEMO_IMPORT_PARSER_VERSION = "browser-patched-ba39cc4" as const;
export const DEMO_IMPORT_ROUND_DURATION_SECONDS = 115;

export type ParserRecord = Record<string, unknown>;

export type DemoParserInspectionInput = {
  fileName: string;
  fileSize: number;
  demoSha256: string;
  header: unknown;
  /** Parser header identities. `finalSide` is metadata, never roster truth. */
  playerIdentities: readonly unknown[];
  /** Positive parser event references; not a role guess or roster override. */
  competitiveParticipationEvidence: readonly unknown[];
  /** Round freeze-end side evidence used to recover the match roster. */
  roundSideSnapshots: readonly unknown[];
  roundStartEvents: readonly unknown[];
  roundFreezeEndEvents: readonly unknown[];
  roundEndEvents: readonly unknown[];
  killEvents?: readonly unknown[];
  bombEvents?: readonly unknown[];
  /** Browser parser sample interval, expressed in source ticks. */
  selectionTickStep?: number;
};

export type DemoParserSelectionInput = DemoParserInspectionInput & {
  roundNumber: number;
  tick: number;
  tickRows: readonly unknown[];
  /** Round-specific freeze-end side evidence; selected-tick rows may omit team. */
  sideRows?: readonly unknown[];
};

type RoundEvent = ParserRecord & {
  tick: number;
  roundNumber: number | null;
  parserRound: number | null;
  gameTime: number;
};

type Header = {
  mapName: string;
  demoVersion: string;
  patchVersion: string;
  serverName: string;
};

type RosterEvidence = {
  playerIdentities: DemoImportPlayerIdentity[];
  competitiveParticipationEvidence: DemoImportCompetitiveParticipationEvidence[];
  rosterResolution: DemoImportRosterResolution;
  matchRoster: DemoImportMatchRosterPlayer[];
  roundSideSnapshots: DemoImportRoundSideSnapshot[];
};

export type DemoImportRosterResolutionOptions = {
  rosterConfirmation?: DemoImportRosterConfirmation;
};

const MAP_OVERVIEWS: Record<string, RadarMapMetadata> = {
  de_mirage: MIRAGE_RADAR_METADATA,
  de_ancient: ANCIENT_RADAR_METADATA,
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

const DIRECT_COMPETITIVE_EVENT_KIND_SET = new Set<string>(
  DEMO_IMPORT_DIRECT_COMPETITIVE_EVENT_KINDS,
);

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

function readSteamId(
  record: ParserRecord,
  keys: readonly string[],
  label: string,
): string {
  const key = keys.find((candidate) => typeof record[candidate] === "string");
  if (!key) {
    throw new Error(`${label} must be a string to preserve SteamID precision`);
  }
  const value = (record[key] as string).trim();
  if (!/^[1-9]\d{0,19}$/.test(value)) {
    throw new Error(`${label} is not a stable numeric SteamID`);
  }
  return value;
}

function readOptionalSteamId(
  record: ParserRecord,
  keys: readonly string[],
  label: string,
): string | null {
  if (!keys.some((key) => record[key] !== undefined && record[key] !== null)) {
    return null;
  }
  return readSteamId(record, keys, label);
}

function parserInstanceKey(id: string, slot: number): string {
  return `${id}@slot:${slot}`;
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

function readOptionalSide(
  record: ParserRecord,
  label: string,
  namedKeys: readonly string[] = ["team", "side"],
): "CT" | "T" | null {
  const named = readString(record, namedKeys, label, { required: false });
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
  // Unknown values (for example spectator/observer team codes) are not
  // evidence of either competitive side. Required callers use readSide and
  // still fail closed; optional metadata callers keep the value unresolved.
  return null;
}

function readSide(
  record: ParserRecord,
  label: string,
  namedKeys: readonly string[] = ["team", "side"],
): "CT" | "T" {
  const side = readOptionalSide(record, label, namedKeys);
  if (side === null) {
    throw new Error(`${label} does not contain a supported CT/T team value`);
  }
  return side;
}

function readSlot(record: ParserRecord, label: string): number {
  const slot = readNumber(record, ["slot", "player_slot"], label, {
    integer: true,
  });
  if (slot < 0) {
    throw new Error(`${label} must be a non-negative player slot`);
  }
  return slot;
}

function readStringArray(
  record: ParserRecord,
  keys: readonly string[],
  label: string,
): string[] {
  const key = keys.find((candidate) => Array.isArray(record[candidate]));
  if (!key) {
    throw new Error(`${label} is unavailable in parser output`);
  }
  const values = record[key];
  if (!Array.isArray(values)) {
    throw new Error(`${label} must be an array`);
  }
  return values.map((value, index) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`${label}[${index}] must be a non-empty string`);
    }
    return value.trim();
  });
}

function readEventRound(
  record: ParserRecord,
  fallbackRoundNumber: number | null = null,
): { roundNumber: number | null; parserRound: number | null } {
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
  return {
    roundNumber: roundNumber !== null && roundNumber >= 1 ? roundNumber : null,
    parserRound:
      parserRound !== null && parserRound >= 0
        ? parserRound
        : roundNumber !== null && roundNumber >= 1
          ? roundNumber - 1
          : null,
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

function firstEventBetween(
  events: readonly RoundEvent[],
  lowerExclusive: number,
  upperExclusive: number,
): RoundEvent | null {
  return (
    events.find(
      (event) =>
        event.tick > lowerExclusive && event.tick < upperExclusive,
    ) ?? null
  );
}

function dedupeBoundaryEvents(events: readonly RoundEvent[]): RoundEvent[] {
  const deduped: RoundEvent[] = [];
  const ordered = [...events].sort((a, b) => a.tick - b.tick);
  for (const event of ordered) {
    const previous = deduped[deduped.length - 1];
    if (!previous || previous.tick !== event.tick) {
      deduped.push(event);
      continue;
    }
    // Duplicate parser notifications can carry different optional metadata.
    // Keep the record with the most useful round identity, never duplicate a
    // human boundary at the same tick.
    if (previous.roundNumber === null && event.roundNumber !== null) {
      deduped[deduped.length - 1] = event;
    }
  }
  return deduped;
}

function selectableTickRange(
  freezeTick: number,
  endTick: number | null,
  nextStartTick: number | null,
  tickStep: number,
  tickrate: number,
): { min: number; max: number } {
  const min = Math.ceil(freezeTick / tickStep) * tickStep;
  const lastAllowed = endTick
    ? endTick - 1
    : nextStartTick
      ? nextStartTick - 1
      : freezeTick +
        Math.floor(DEMO_IMPORT_ROUND_DURATION_SECONDS * tickrate) -
        1;
  const max = Math.floor(lastAllowed / tickStep) * tickStep;
  return { min, max };
}

function createRoundDescriptors(
  input: DemoParserInspectionInput,
): DemoImportRound[] {
  const starts = dedupeBoundaryEvents(
    asRecords(input.roundStartEvents, "round_start")
      .filter((event) => event.is_warmup_period !== true)
      .map((event) => normalizeEvent(event, "round_start")),
  );
  const freezes = dedupeBoundaryEvents(
    asRecords(input.roundFreezeEndEvents, "round_freeze_end").map((event) =>
      normalizeEvent(event, "round_freeze_end"),
    ),
  );
  const ends = dedupeBoundaryEvents(
    asRecords(input.roundEndEvents, "round_end")
      .filter((event) => event.is_warmup_period !== true)
      .map((event) => normalizeEvent(event, "round_end")),
  );

  if (starts.length === 0 || freezes.length === 0) {
    throw new Error("Demo does not contain enough round boundary events");
  }

  const tickrate = inferTickrate(starts);
  const tickStep = input.selectionTickStep ?? 1;
  if (!Number.isInteger(tickStep) || tickStep < 1) {
    throw new Error("selectionTickStep must be a positive integer");
  }

  // A valid round start must own a freeze-end before the next raw start. This
  // removes the duplicate `round_start`/`round_end` notifications seen in
  // current CS2 demos without trusting their optional round fields.
  const candidates = starts.flatMap((start, index) => {
    const nextRawStartTick = starts[index + 1]?.tick ?? Number.POSITIVE_INFINITY;
    const freeze = freezes.find(
      (event) =>
        event.tick >= start.tick && event.tick < nextRawStartTick,
    );
    return freeze ? [{ start, freeze }] : [];
  });

  const rounds = candidates.flatMap(({ start, freeze }, index) => {
    const previousRound = index > 0 ? candidates[index - 1].start : null;
    const roundNumber =
      start.roundNumber ??
      (start.parserRound !== null ? start.parserRound + 1 : null) ??
      ((previousRound?.roundNumber ?? index) + 1);
    const parserRound = start.parserRound ?? roundNumber - 1;
    const nextStartTick = candidates[index + 1]?.start.tick ?? null;
    const end = firstEventBetween(
      ends,
      freeze.tick,
      nextStartTick ?? Number.POSITIVE_INFINITY,
    );
    const range = selectableTickRange(
      freeze.tick,
      end?.tick ?? null,
      nextStartTick,
      tickStep,
      tickrate,
    );
    if (range.max < range.min) {
      return [];
    }
    return [
      DemoImportRoundSchema.parse({
        number: roundNumber,
        parserRound,
        startTick: start.tick,
        freezeEndTick: freeze.tick,
        endTick: end?.tick ?? null,
        minSelectableTick: range.min,
        maxSelectableTick: range.max,
        startGameTime: start.gameTime,
        freezeEndGameTime: freeze.gameTime,
        endGameTime: end?.gameTime ?? null,
        tickrate,
        ...(tickStep > 1 ? { tickStep } : {}),
        durationSeconds: DEMO_IMPORT_ROUND_DURATION_SECONDS,
      }),
    ];
  });

  if (rounds.length === 0) {
    throw new Error("Demo does not contain a selectable Round");
  }
  return rounds;
}

function findRoundForTick(
  rounds: readonly DemoImportRound[],
  tick: number,
): DemoImportRound | null {
  for (let index = rounds.length - 1; index >= 0; index -= 1) {
    const round = rounds[index];
    const nextRound = rounds[index + 1];
    const upperBound = round.endTick ?? nextRound?.startTick ?? Number.POSITIVE_INFINITY;
    if (tick >= round.startTick && tick < upperBound) {
      return round;
    }
  }
  return null;
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
      const round = findRoundForTick(rounds, event.tick) ??
        (event.roundNumber === null
          ? null
          : rounds.find((candidate) => candidate.number === event.roundNumber) ?? null);
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
          roundNumber: round.number,
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
      { required: false },
    ) ?? "未由浏览器 parser 提供",
    patchVersion: readString(
      header,
      ["patch_version", "network_protocol", "patchVersion"],
      "patch_version",
      { required: false },
    ) ?? "未由浏览器 parser 提供",
    serverName:
      readString(header, ["server_name", "serverName"], "server_name", {
        required: false,
      }) ?? "未命名 Demo 录制",
  };
}

function parseCompetitiveParticipationEvidence(
  input: DemoParserInspectionInput,
  playerIdentities: readonly DemoImportPlayerIdentity[],
): DemoImportCompetitiveParticipationEvidence[] {
  const records = asRecords(
    input.competitiveParticipationEvidence,
    "competitive participation evidence",
  );
  if (records.length !== playerIdentities.length) {
    throw new Error(
      `parser returned ${records.length} competitive participation evidence records for ${playerIdentities.length} identities`,
    );
  }
  const identityByParserInstance = new Map(
    playerIdentities.map((identity) => [
      parserInstanceKey(identity.id, identity.slot),
      identity,
    ]),
  );
  const seenIds = new Set<string>();
  const seenSlots = new Set<number>();
  return records.map((record, index) => {
    const label = `competitive participation evidence[${index}]`;
    const id = readSteamId(
      record,
      ["steamid", "user_steamid", "id"],
      `${label}.id`,
    );
    const slot = readSlot(record, `${label}.slot`);
    const competitiveEventReferenceCount = readNumber(
      record,
      ["competitiveEventReferenceCount", "competitive_event_reference_count"],
      `${label}.competitiveEventReferenceCount`,
      { integer: true },
    );
    if (competitiveEventReferenceCount < 0) {
      throw new Error(
        `${label}.competitiveEventReferenceCount must be non-negative`,
      );
    }
    const competitiveEventKinds = readStringArray(
      record,
      ["competitiveEventKinds", "competitive_event_kinds"],
      `${label}.competitiveEventKinds`,
    );
    const identity = identityByParserInstance.get(parserInstanceKey(id, slot));
    if (!identity) {
      throw new Error(
        `${label} does not match one parser instance by SteamID and slot`,
      );
    }
    if (seenIds.has(id) || seenSlots.has(slot)) {
      throw new Error(`${label} contains duplicate player identity or slot`);
    }
    if (
      (competitiveEventReferenceCount === 0 && competitiveEventKinds.length > 0) ||
      (competitiveEventReferenceCount > 0 && competitiveEventKinds.length === 0)
    ) {
      throw new Error(
        `${label} has inconsistent competitive event evidence`,
      );
    }
    if (
      new Set(competitiveEventKinds).size !== competitiveEventKinds.length
    ) {
      throw new Error(`${label} contains duplicate competitive event kinds`);
    }
    const unsupportedKinds = competitiveEventKinds.filter(
      (kind) => !DIRECT_COMPETITIVE_EVENT_KIND_SET.has(kind),
    );
    if (unsupportedKinds.length > 0) {
      throw new Error(
        `${label} contains event kinds outside the direct competitive evidence contract: ${unsupportedKinds.join(", ")}`,
      );
    }
    const approvedCompetitiveEventKinds = competitiveEventKinds as DemoImportCompetitiveParticipationEvidence["competitiveEventKinds"];
    seenIds.add(id);
    seenSlots.add(slot);
    return {
      id,
      slot,
      competitiveEventReferenceCount,
      competitiveEventKinds: approvedCompetitiveEventKinds,
    };
  });
}

function recoverRosterEvidence(
  input: DemoParserInspectionInput,
  options: DemoImportRosterResolutionOptions = {},
): RosterEvidence {
  let playerIdentities: DemoImportPlayerIdentity[];
  try {
    const identityRecords = asRecords(input.playerIdentities, "player identities");
    if (identityRecords.length === 0) {
      throw new Error("parser returned no player identities");
    }
    const identitiesById = new Map<string, DemoImportPlayerIdentity>();
    const identitiesBySlot = new Map<number, DemoImportPlayerIdentity>();
    for (const [index, record] of identityRecords.entries()) {
      const label = `player identities[${index}]`;
      const identity: DemoImportPlayerIdentity = {
        id: readSteamId(record, ["steamid", "user_steamid", "id"], `${label}.id`),
        name: readString(record, ["name", "user_name", "player_name"], `${label}.name`),
        slot: readSlot(record, `${label}.slot`),
        finalSide: readOptionalSide(record, `${label}.finalSide`, [
          "final_side",
          "finalSide",
          "team",
          "side",
        ]),
      };
      const previousById = identitiesById.get(identity.id);
      if (previousById) {
        throw new Error(
          `parser returned duplicate logical SteamID ${identity.id} across parser instances at slots ${previousById.slot} and ${identity.slot}; reconnect identity cannot be resolved without connection evidence`,
        );
      }
      const previousBySlot = identitiesBySlot.get(identity.slot);
      if (previousBySlot) {
        throw new Error(
          `parser slot ${identity.slot} is reused by multiple parser instances; connection epoch evidence is unavailable`,
        );
      }
      identitiesById.set(identity.id, identity);
      identitiesBySlot.set(identity.slot, identity);
    }
    playerIdentities = [...identitiesById.values()];
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new DemoRosterRecoveryError(
      `浏览器本地已解析 Demo，但 parser participant identities 无法作为可靠身份记录使用。（${detail}）`,
    );
  }

  const identityById = new Map(
    playerIdentities.map((identity) => [identity.id, identity]),
  );
  // `(SteamID, slot)` identifies the parser instance used to join its
  // identity, evidence and round-side records. It is not the logical roster
  // identity; the latter is the stable SteamID after duplicate checks pass.
  const identityByParserInstance = new Map(
    playerIdentities.map((identity) => [
      parserInstanceKey(identity.id, identity.slot),
      identity,
    ]),
  );
  let competitiveParticipationEvidence: DemoImportCompetitiveParticipationEvidence[];
  try {
    competitiveParticipationEvidence = parseCompetitiveParticipationEvidence(
      input,
      playerIdentities,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new DemoRosterRecoveryError(
      `浏览器本地已解析 Demo，但 parser competitive-participant evidence 无法与 player identity 可靠对应。（${detail}）`,
      { unresolvedIdentityIds: playerIdentities.map((identity) => identity.id) },
    );
  }
  let roundSideSnapshots: DemoImportRoundSideSnapshot[];
  try {
    const snapshotRecords = asRecords(
      input.roundSideSnapshots,
      "round-side snapshots",
    );
    if (snapshotRecords.length === 0) {
      throw new Error("parser returned no round-specific side snapshots");
    }
    const seenRounds = new Set<number>();
    roundSideSnapshots = snapshotRecords.map((record, snapshotIndex) => {
      const snapshotLabel = `round-side snapshots[${snapshotIndex}]`;
      const roundNumber = readNumber(
        record,
        ["roundNumber", "round", "number"],
        `${snapshotLabel}.roundNumber`,
        { integer: true },
      );
      const freezeEndTick = readNumber(
        record,
        ["freezeEndTick", "freeze_end_tick", "tick"],
        `${snapshotLabel}.freezeEndTick`,
        { integer: true },
      );
      if (roundNumber < 1 || freezeEndTick < 0) {
        throw new Error(`${snapshotLabel} has an invalid round boundary`);
      }
      if (seenRounds.has(roundNumber)) {
        throw new Error(
          `parser returned more than one round-side snapshot for Round ${roundNumber}`,
        );
      }
      seenRounds.add(roundNumber);
      const playerRecords = asRecords(
        asArrayValue(record.players, `${snapshotLabel}.players`),
        `${snapshotLabel}.players`,
      );
      if (playerRecords.length === 0) {
        throw new Error(`${snapshotLabel} contains no round-side player evidence`);
      }
      const seenIds = new Set<string>();
      const seenSlots = new Set<number>();
      const snapshotPlayers: DemoImportRoundSidePlayer[] = playerRecords.map(
        (playerRecord, playerIndex) => {
          const playerLabel = `${snapshotLabel}.players[${playerIndex}]`;
          const id = readSteamId(
            playerRecord,
            ["steamid", "user_steamid", "id"],
            `${playerLabel}.id`,
          );
          const name = readString(
            playerRecord,
            ["name", "user_name", "player_name"],
            `${playerLabel}.name`,
          );
          const slot = readSlot(playerRecord, `${playerLabel}.slot`);
          const side = readSide(playerRecord, `${playerLabel}.side`, [
            "side",
            "team",
            "m_iTeamNum",
            "team_num",
            "teamNum",
          ]);
          const identity = identityByParserInstance.get(
            parserInstanceKey(id, slot),
          );
          if (!identity) {
            throw new Error(
              `${playerLabel} does not match one parser instance by SteamID and slot`,
            );
          }
          if (seenIds.has(id) || seenSlots.has(slot)) {
            throw new Error(
              `${snapshotLabel} contains duplicate player identity or slot`,
            );
          }
          seenIds.add(id);
          seenSlots.add(slot);
          return { id, name, slot, side };
        },
      );
      return { roundNumber, freezeEndTick, players: snapshotPlayers };
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new DemoRosterRecoveryError(
      `浏览器本地已解析 Demo，但回合阵营证据无法与 player identity 可靠对应。（${detail}）`,
    );
  }

  const evidenceById = new Map(
    competitiveParticipationEvidence.map((evidence) => [evidence.id, evidence]),
  );
  const identityOptions: DemoRosterIdentityOption[] = playerIdentities.map(
    (identity) => {
      const evidence = evidenceById.get(identity.id);
      const roundSideEvidenceRoundCount = roundSideSnapshots.filter((snapshot) =>
        snapshot.players.some(
          (player) =>
            player.id === identity.id && player.slot === identity.slot,
        ),
      ).length;
      return {
        id: identity.id,
        name: identity.name,
        slot: identity.slot,
        directEvidenceReferenceCount:
          evidence?.competitiveEventReferenceCount ?? 0,
        directEvidenceKinds: [...(evidence?.competitiveEventKinds ?? [])],
        roundSideEvidenceRoundCount,
      };
    },
  );
  let confirmedRosterIds: readonly string[] | undefined;
  if (options.rosterConfirmation) {
    try {
      confirmedRosterIds = DemoImportRosterConfirmationSchema.parse(
        options.rosterConfirmation,
      ).matchRosterIds;
    } catch {
      throw new DemoRosterValidationError(
        "用户确认的 match roster 必须包含 10 个唯一玩家身份。",
      );
    }
  }
  let candidateIds: Set<string>;
  let resolutionMode: DemoImportRosterResolution["mode"];
  let unresolvedIdentityIds: string[];
  let confirmedNonRosterIdentityIds: string[];
  if (confirmedRosterIds) {
    const confirmedIdSet = new Set(confirmedRosterIds);
    if (
      confirmedRosterIds.length !== 10 ||
      confirmedIdSet.size !== confirmedRosterIds.length ||
      [...confirmedIdSet].some((id) => !identityById.has(id))
    ) {
      throw new DemoRosterValidationError(
        "用户确认的 match roster 必须包含 10 个来自 parser identity 的唯一玩家。",
      );
    }
    candidateIds = confirmedIdSet;
    resolutionMode = "user-confirmed";
    unresolvedIdentityIds = [];
    confirmedNonRosterIdentityIds = playerIdentities
      .filter((identity) => !candidateIds.has(identity.id))
      .map((identity) => identity.id);
  } else {
    const competitiveIdentities = playerIdentities.filter(
      (identity) =>
        (evidenceById.get(identity.id)?.competitiveEventReferenceCount ?? 0) >
        0,
    );
    candidateIds = new Set(competitiveIdentities.map((identity) => identity.id));
    unresolvedIdentityIds = playerIdentities
      .filter((identity) => !candidateIds.has(identity.id))
      .map((identity) => identity.id);
    if (candidateIds.size !== 10 || unresolvedIdentityIds.length > 0) {
      const candidateNames = competitiveIdentities
        .map((identity) => `${identity.name} [${identity.id}]`)
        .join("、");
      const unresolvedNames = playerIdentities
        .filter((identity) => unresolvedIdentityIds.includes(identity.id))
        .map((identity) => `${identity.name} [${identity.id}]`)
        .join("、");
      throw new DemoRosterRecoveryError(
        `浏览器本地已解析 Demo，但 parser 证据无法无歧义地建立 10 人 match roster；直接 competitive evidence 候选 ${candidateIds.size} 人，未解析 identity ${unresolvedIdentityIds.length} 人。候选：${candidateNames || "无"}；unresolved：${unresolvedNames || "无"}。`,
        {
          unresolvedIdentityIds,
          candidateIdentityIds: [...candidateIds],
          canConfirm: playerIdentities.length >= 10,
          identityOptions,
        },
      );
    }
    resolutionMode = "automatic";
    confirmedNonRosterIdentityIds = [];
  }

  const rosterSnapshotPlayers = (snapshot: DemoImportRoundSideSnapshot) =>
    snapshot.players.filter((player) => candidateIds.has(player.id));
  const matchingSnapshots = roundSideSnapshots.filter((snapshot) => {
    const players = rosterSnapshotPlayers(snapshot);
    const ids = new Set(players.map((player) => player.id));
    const ctCount = players.filter((player) => player.side === "CT").length;
    const tCount = players.filter((player) => player.side === "T").length;
    return (
      players.length === 10 &&
      ids.size === 10 &&
      ctCount === 5 &&
      tCount === 5 &&
      [...candidateIds].every((id) => ids.has(id))
    );
  });
  if (
    matchingSnapshots.length > 0 &&
    matchingSnapshots.length !== roundSideSnapshots.length
  ) {
    const incompleteRounds = roundSideSnapshots
      .filter((snapshot) => !matchingSnapshots.includes(snapshot))
      .map((snapshot) => {
        const players = rosterSnapshotPlayers(snapshot);
        const ctCount = players.filter((player) => player.side === "CT").length;
        const tCount = players.filter((player) => player.side === "T").length;
        return `R${snapshot.roundNumber}: roster evidence ${players.length} 人（${ctCount} CT / ${tCount} T）`;
      })
      .join("、");
    throw new DemoRosterValidationError(
      `浏览器本地已恢复 match roster，但部分回合缺少完整的 round-specific 5 CT / 5 T evidence：${incompleteRounds}。`,
    );
  }
  if (matchingSnapshots.length === 0) {
    const shapes = roundSideSnapshots
      .map((snapshot) => {
        const players = rosterSnapshotPlayers(snapshot);
        const ctCount = players.filter((player) => player.side === "CT").length;
        const tCount = players.filter((player) => player.side === "T").length;
        return `R${snapshot.roundNumber}: roster evidence ${players.length} 人（${ctCount} CT / ${tCount} T），raw ${snapshot.players.length} 人`;
      })
      .join("、");
    const message =
      `浏览器本地已解析 Demo，但恢复出的 match roster 没有任何回合能提供完整的 5 CT / 5 T round-specific evidence。观测到：${shapes}。`;
    if (resolutionMode === "user-confirmed") {
      throw new DemoRosterValidationError(message);
    }
    throw new DemoRosterRecoveryError(message, {
      unresolvedIdentityIds,
      candidateIdentityIds: [...candidateIds],
    });
  }

  const matchRoster = [...candidateIds]
    .map((id) => {
      const identity = identityById.get(id);
      if (!identity) {
        throw new DemoRosterRecoveryError(
          `浏览器本地已解析 Demo，但 match roster 中的 ${id} 无法回溯到稳定 parser identity。`,
          { unresolvedIdentityIds, candidateIdentityIds: [...candidateIds] },
        );
      }
      return {
        id: identity.id,
        name: identity.name,
        slot: identity.slot,
      } satisfies DemoImportMatchRosterPlayer;
    })
    .sort((a, b) => a.slot - b.slot);

  validateMatchRoster(matchRoster, rosterSnapshotPlayers(matchingSnapshots[0]));
  const rosterResolution: DemoImportRosterResolution = {
    mode: resolutionMode,
    matchRosterIds: matchRoster.map((player) => player.id),
    unresolvedIdentityIds,
    confirmedNonRosterIdentityIds,
  };
  return {
    playerIdentities,
    competitiveParticipationEvidence,
    rosterResolution,
    matchRoster,
    roundSideSnapshots,
  };
}

function asArrayValue(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function validateMatchRoster(
  roster: readonly DemoImportMatchRosterPlayer[],
  sideEvidence: readonly DemoImportRoundSidePlayer[],
): void {
  const ids = new Set(roster.map((player) => player.id));
  const slots = new Set(roster.map((player) => player.slot));
  const sideIds = new Set(sideEvidence.map((player) => player.id));
  const ctCount = sideEvidence.filter((player) => player.side === "CT").length;
  const tCount = sideEvidence.filter((player) => player.side === "T").length;
  if (
    roster.length !== 10 ||
    ids.size !== roster.length ||
    slots.size !== roster.length ||
    sideEvidence.length !== 10 ||
    sideIds.size !== sideEvidence.length ||
    sideIds.size !== ids.size ||
    [...ids].some((id) => !sideIds.has(id)) ||
    ctCount !== 5 ||
    tCount !== 5
  ) {
    throw new DemoRosterValidationError(
      `浏览器本地已恢复 match roster，但校验失败：需要 10 个唯一玩家、5 CT、5 T；实际为 ${roster.length} 个 roster 玩家、${ctCount} CT、${tCount} T。`,
    );
  }
}

export function buildDemoImportInspection(
  input: DemoParserInspectionInput,
  options: DemoImportRosterResolutionOptions = {},
): DemoImportInspection {
  const header = readHeader(input.header);
  const rosterEvidence = recoverRosterEvidence(input, options);
  const rounds = createRoundDescriptors(input);
  const snapshotRoundNumbers = new Set(
    rosterEvidence.roundSideSnapshots.map((snapshot) => snapshot.roundNumber),
  );
  const missingSideEvidenceRounds = rounds
    .filter((round) => !snapshotRoundNumbers.has(round.number))
    .map((round) => `R${round.number}`);
  if (missingSideEvidenceRounds.length > 0) {
    throw new DemoRosterValidationError(
      `浏览器本地已恢复 match roster，但以下可选回合缺少 round-specific CT/T side evidence：${missingSideEvidenceRounds.join(", ")}；原始文件未上传。`,
    );
  }
  const overview = MAP_OVERVIEWS[header.mapName] ?? null;
  const warnings = [
    "队伍组织名未从 Demo 原生恢复，以下使用阵营标签",
    "机器事件 marker 仅用于定位，不代表关键决策或推荐复盘时刻",
    "Round 结束 tick 不在可选择范围内，避免把比赛结果带入决策截点",
    "player identity 来自 parser header；match roster 仅在 competitive-participant evidence 与 round-specific CT/T evidence 一致时恢复",
    "当前 browser parser 未提供 spectator / observer / coach 的独立 role 或 lifecycle evidence；无法确定的 identity 保持 unresolved，不由 economy、track 或数组顺序补齐",
  ];
  if (rosterEvidence.rosterResolution.unresolvedIdentityIds.length > 0) {
    const unresolvedNames = rosterEvidence.rosterResolution.unresolvedIdentityIds
      .map(
        (id) =>
          rosterEvidence.playerIdentities.find((identity) => identity.id === id)
            ?.name ?? id,
      )
      .join("、");
    warnings.push(
      `${rosterEvidence.rosterResolution.unresolvedIdentityIds.length} 个 parser participant identity 尚未被自动分类为选手或非参赛身份（${unresolvedNames}）；未将其强行写入 match roster。`,
    );
  }
  if (!overview) {
    warnings.push("该地图缺少已批准的 overview metadata，当前只能检查边界，不能生成 normalized state");
  }
  warnings.push("当前 Demo 没有自动附带可用于战术语义的地图 raster；空间预览需 Human QA 明确确认");

  return DemoImportInspectionSchema.parse({
    schemaVersion: 3,
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
    playerIdentities: rosterEvidence.playerIdentities,
    competitiveParticipationEvidence:
      rosterEvidence.competitiveParticipationEvidence,
    rosterResolution: rosterEvidence.rosterResolution,
    matchRoster: rosterEvidence.matchRoster,
    roundSideSnapshots: rosterEvidence.roundSideSnapshots,
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
  roster: readonly DemoImportInspection["matchRoster"][number][],
  sideRows: readonly unknown[] = [],
  selectedTick: number,
  fallbackSideRows: readonly DemoImportRoundSidePlayer[] = [],
) {
  // A logical roster identity is a stable SteamID. The parser slot is still
  // required at this boundary to prove that a selected row belongs to the
  // same parser instance that produced the validated roster/side evidence.
  const rosterByParserInstance = new Map(
    roster.map((player) => [
      parserInstanceKey(player.id, player.slot),
      player,
    ]),
  );
  const rosterById = new Map(roster.map((player) => [player.id, player]));
  const canonicalSideByParserInstance = new Map(
    fallbackSideRows.map((player) => [
      parserInstanceKey(player.id, player.slot),
      player.side,
    ]),
  );
  if (fallbackSideRows.length === 0) {
    throw new DemoRosterValidationError(
      "selected Round lacks validated selected-round CT/T side evidence for the recovered match roster;原始文件未上传。",
    );
  }
  const providedSideByParserInstance = new Map<string, "CT" | "T">();
  for (const [index, row] of asRecords(sideRows, "freeze-end parseTicks").entries()) {
    const id = readSteamId(
      row,
      ["steamid", "user_steamid", "id"],
      `freeze-end parseTicks[${index}].steamid`,
    );
    const slot = readSlot(row, `freeze-end parseTicks[${index}].slot`);
    const side = readOptionalSide(row, `freeze-end parseTicks[${index}].team`, [
      "side",
      "team",
      "m_iTeamNum",
      "team_num",
      "teamNum",
    ]);
    if (side !== null) {
      const parserKey = parserInstanceKey(id, slot);
      const rosterPlayer = rosterById.get(id);
      if (rosterPlayer && rosterPlayer.slot !== slot) {
        throw new DemoRosterValidationError(
          `round-specific side evidence pairs recovered match roster player ${id} with parser slot ${slot}, expected slot ${rosterPlayer.slot};原始文件未上传。`,
        );
      }
      if (providedSideByParserInstance.has(parserKey)) {
        throw new DemoRosterValidationError(
          `round-specific side evidence contains duplicate parser instance ${id} at slot ${slot};原始文件未上传。`,
        );
      }
      providedSideByParserInstance.set(parserKey, side);
    }
  }
  const sideByParserInstance = new Map<string, "CT" | "T">();
  for (const player of roster) {
    const parserKey = parserInstanceKey(player.id, player.slot);
    const canonicalSide = canonicalSideByParserInstance.get(parserKey);
    if (canonicalSide === undefined) {
      throw new DemoRosterValidationError(
        `selected Round side snapshot lacks recovered match roster parser instance ${player.id} at slot ${player.slot};原始文件未上传。`,
      );
    }
    if (sideRows.length > 0) {
      const providedSide = providedSideByParserInstance.get(parserKey);
      if (providedSide !== undefined && providedSide !== canonicalSide) {
        throw new DemoRosterValidationError(
          `provided round-specific side evidence conflicts with the canonical selected Round snapshot for recovered match roster parser instance ${player.id} at slot ${player.slot};原始文件未上传。`,
        );
      }
    }
    sideByParserInstance.set(parserKey, canonicalSide);
  }
  const parserRows = asRecords(rows, "parseTicks");
  const normalized = parserRows
    .map((record, index) => {
      const id = readSteamId(
        record,
        ["steamid", "user_steamid", "id"],
        `parseTicks[${index}].steamid`,
      );
      const slot = readSlot(record, `parseTicks[${index}].slot`);
      return {
        record,
        index,
        id,
        slot,
        parserKey: parserInstanceKey(id, slot),
      };
    })
    .filter(({ parserKey }) => rosterByParserInstance.has(parserKey))
    .map(({ record, index, id, slot, parserKey }) => {
    const rowTick = readNumber(record, ["tick"], `parseTicks[${index}].tick`, {
      required: false,
      integer: true,
    });
    if (rowTick !== null && rowTick > selectedTick) {
      throw new Error(
        `parseTicks[${index}] contains a future tick ${rowTick} after selected tick ${selectedTick}`,
      );
    }
    const name = readString(record, ["name", "user_name", "player_name"], `parseTicks[${index}].name`);
    const rowSide = readOptionalSide(record, `parseTicks[${index}].team`, [
      "side",
      "team",
      "m_iTeamNum",
      "team_num",
      "teamNum",
    ]);
    const side = sideByParserInstance.get(parserKey);
    if (side !== undefined && rowSide !== null && side !== rowSide) {
      throw new DemoRosterValidationError(
        `round-specific side evidence conflicts with exact tick side for recovered match roster parser instance ${id} at slot ${slot};原始文件未上传。`,
      );
    }
    if (!rosterByParserInstance.has(parserKey) || side === undefined) {
      throw new DemoRosterValidationError(
        `exact tick lacks selected-round CT/T side evidence for recovered match roster parser instance ${id} at slot ${slot};原始文件未上传。`,
      );
    }
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
    throw new DemoRosterValidationError(
      `exact tick does not contain the recovered 5v5 match roster: expected 10 unique players with five CT and five T, got ${normalized.length} players (${normalized.filter((player) => player.side === "CT").length} CT / ${normalized.filter((player) => player.side === "T").length} T);原始文件未上传。`,
    );
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
      const event = normalizeEvent(record, "bomb event");
      return {
        record,
        event,
      };
    })
    .filter(
      ({ event }) =>
        event.tick >= selectedRound.startTick &&
        (selectedRound.endTick === null || event.tick < selectedRound.endTick) &&
        event.tick <= input.tick,
    )
    .sort((a, b) => a.event.tick - b.event.tick);

  for (const { record, event } of events) {
    const eventName = readString(record, ["event_name", "event"], "bomb event");
    if (eventName === "bomb_pickup") {
      state = {
        status: "carried",
        carrierId: readOptionalSteamId(
          record,
          ["user_steamid", "steamid"],
          "bomb event carrier SteamID",
        ),
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
  rounds: readonly DemoImportRound[],
): Record<string, number> {
  const score: Record<string, number> = { "T side": 0, "CT side": 0 };
  for (const record of asRecords(input.roundEndEvents, "round_end")) {
    const event = normalizeEvent(record, "round_end");
    const temporalRound = findRoundForTick(rounds, event.tick);
    const eventRoundNumber = temporalRound?.number ?? event.roundNumber;
    if (eventRoundNumber === null || eventRoundNumber >= selectedRound.number) {
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
  const elapsedSeconds = Math.max(0, gameTime - selectedRound.freezeEndGameTime);
  if (bomb.status === "planted" && bomb.plantGameTime !== null) {
    const postPlantElapsedSeconds = Math.max(0, gameTime - bomb.plantGameTime);
    return {
      display: `下包后 ${formatDemoClock(postPlantElapsedSeconds)}`,
      semantics: "post_plant_elapsed" as const,
      remainingSeconds: null,
      elapsedSeconds,
      postPlantElapsedSeconds,
      roundDurationSeconds: DEMO_IMPORT_ROUND_DURATION_SECONDS,
      roundStartTick: selectedRound.freezeEndTick,
      roundStartGameTime: selectedRound.freezeEndGameTime,
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
    roundStartTick: selectedRound.freezeEndTick,
    roundStartGameTime: selectedRound.freezeEndGameTime,
    gameTime,
    tickrate: selectedRound.tickrate,
    warningTick: null,
    warningGameTime: null,
  };
}

export function buildDemoImportNormalizedState(
  input: DemoParserSelectionInput,
  options: DemoImportRosterResolutionOptions = {},
): NormalizedMatchState {
  const inspection = buildDemoImportInspection(input, options);
  const selectedRound = getSelectableRound(inspection, input.roundNumber);
  assertSelectableTick(selectedRound, input.tick);
  const overview = inspection.map.overview;
  if (!overview) {
    throw new DemoMapMetadataError(
      `match roster 已成功恢复，但 ${inspection.map.name} 缺少已批准的 overview metadata；无法生成 normalized state。`,
    );
  }
  const { players, gameTime } = normalizeTickRows(
    input.tickRows,
    inspection.matchRoster,
    input.sideRows,
    input.tick,
    inspection.roundSideSnapshots.find(
      (snapshot) => snapshot.roundNumber === selectedRound.number,
    )?.players ?? [],
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
  const score = buildScore(input, selectedRound, inspection.rounds);
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
        "parser header player identity + final-side metadata (not roster truth)",
        "round freeze-end economy side evidence for match roster and selected Round CT/T sides",
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
        "T/CT side label from selected round freeze-end side evidence and exact tick rows",
        "score from round_end winner events before the selected Round",
        "clock from round_start/game_time and the declared 115-second rule",
        "bomb status from ordered bomb_* events through the selected tick",
        "team label as T side / CT side because organization names are unavailable",
      ],
    },
  });
}
