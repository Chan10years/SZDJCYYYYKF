/* global crypto, importScripts, self, wasm_bindgen */

const EVENT_NAMES = [
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
];

const EVENT_EXTRA = [
  "game_time",
  "total_rounds_played",
  "round",
  "is_warmup_period",
];

const TICK_PROPS = [
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
];

let bytes = null;
let baseRaw = null;
let parserReady = false;

function postProgress(message) {
  self.postMessage(message);
}

function cloneParserValue(value) {
  if (value instanceof Map) {
    return Object.fromEntries(
      [...value.entries()].map(([key, entry]) => [key, cloneParserValue(entry)]),
    );
  }
  if (Array.isArray(value)) {
    return value.map(cloneParserValue);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneParserValue(entry)]),
    );
  }
  return value;
}

function parserRecords(value, label) {
  const cloned = cloneParserValue(value);
  if (!Array.isArray(cloned)) {
    throw new Error(`${label} parser result must be an array`);
  }
  return cloned;
}

function getEventName(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const value = entry.event_name ?? entry.event;
  return typeof value === "string" ? value : null;
}

function groupEvents(events) {
  const byName = (name) => events.filter((entry) => getEventName(entry) === name);
  return {
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
      ].includes(getEventName(entry)),
    ),
  };
}

async function ensureParser() {
  if (parserReady) return;
  importScripts("/vendor/demoparser2/demoparser2.js");
  await wasm_bindgen({
    module_or_path: "/vendor/demoparser2/demoparser2_bg.wasm",
  });
  parserReady = true;
}

async function digestSha256(input) {
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function postError(error) {
  postProgress({
    type: "error",
    code: "unsupported",
    message: "浏览器本地 parser 无法读取这场 Demo，正在切换兼容 parser。",
    detail: error instanceof Error ? error.message : String(error),
  });
}

self.onmessage = async (event) => {
  const message = event.data;
  try {
    if (message?.type === "reset") {
      bytes = null;
      baseRaw = null;
      return;
    }
    if (message?.type === "load") {
      if (!(message.buffer instanceof ArrayBuffer)) {
        throw new Error("Demo worker load requires an ArrayBuffer");
      }
      bytes = new Uint8Array(message.buffer);
      baseRaw = null;
      postProgress({ type: "reading", fileSize: message.fileSize });
      await ensureParser();
      postProgress({ type: "parsing", stage: "events" });
      const events = parserRecords(
        wasm_bindgen.parseEvents(bytes, EVENT_NAMES, [], EVENT_EXTRA),
        "parseEvents",
      );
      baseRaw = {
        header: cloneParserValue(wasm_bindgen.parseHeader(bytes)),
        ...groupEvents(events),
      };
      postProgress({
        type: "inspection",
        fileName: message.fileName,
        fileSize: message.fileSize,
        demoSha256: await digestSha256(bytes),
        raw: baseRaw,
      });
      return;
    }
    if (message?.type === "select") {
      if (!bytes || !baseRaw) {
        throw new Error("Demo worker has no inspected Demo");
      }
      postProgress({ type: "parsing", stage: "selected-tick", tick: message.tick });
      const tickRows = parserRecords(
        wasm_bindgen.parseTicks(
          bytes,
          TICK_PROPS,
          new Int32Array([message.tick]),
          undefined,
          false,
        ),
        "parseTicks",
      );
      const sideRows =
        message.sideTick === message.tick
          ? tickRows
          : parserRecords(
              wasm_bindgen.parseTicks(
                bytes,
                TICK_PROPS,
                new Int32Array([message.sideTick]),
                undefined,
                false,
              ),
              "freeze-end parseTicks",
            );
      postProgress({
        type: "selection",
        roundNumber: message.roundNumber,
        tick: message.tick,
        raw: {
          ...baseRaw,
          roundNumber: message.roundNumber,
          tick: message.tick,
          tickRows,
          sideRows,
        },
      });
      return;
    }
    throw new Error("unknown Demo worker message");
  } catch (error) {
    postError(error);
  }
};
