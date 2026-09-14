/* global Blob, crypto, importScripts, self */

// The generated disalytics worker owns the patched LaihoE parser and WASM
// runtime. This file is deliberately only a protocol/normalization adapter:
// the Demo bytes enter this Worker and never leave it.

const SAMPLE_STEP_FALLBACK = 4;
const FLAG_ALIVE = 1;
const WEAPON_NONE = 255;

const nativePostMessage = self.postMessage.bind(self);
let vendorOnMessage = null;
let parsed = null;
let parserHeader = null;
let currentLoad = null;

function post(message) {
  nativePostMessage(message);
}

function asArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} parser result must be an array`);
  }
  return value;
}

function eventTime(tick, tickRate) {
  return tick / tickRate;
}

function playerBySlot(slot) {
  return parserHeader?.players?.find((player) => player.slot === slot) ?? null;
}

function activePlayersForTrack(track) {
  const players = parserHeader?.players ?? [];
  const activePlayers = players.filter(
    (player) =>
      Number.isInteger(player.slot) &&
      player.slot >= 0 &&
      player.slot < track.slotCount,
  );
  if (activePlayers.length !== track.slotCount) {
    throw new Error(
      `browser parser header has ${activePlayers.length} active players for ${track.slotCount} track slots`,
    );
  }
  return activePlayers;
}

function teamNumber(team) {
  return team === "CT" ? 3 : 2;
}

function makeRoundEvents(rounds, tickRate) {
  return {
    roundStartEvents: rounds.map((round) => ({
      event_name: "round_start",
      tick: round.startTick,
      game_time: eventTime(round.startTick, tickRate),
      round: round.number,
      total_rounds_played: Math.max(0, round.number - 1),
      is_warmup_period: false,
    })),
    // The parser's round object is authoritative for the boundary, but the
    // optional event round fields are intentionally not required here.
    roundFreezeEndEvents: rounds.map((round) => ({
      event_name: "round_freeze_end",
      tick: round.freezeTimeEndTick,
      game_time: eventTime(round.freezeTimeEndTick, tickRate),
    })),
    roundEndEvents: rounds.map((round) => ({
      event_name: "round_end",
      tick: round.endTick,
      game_time: eventTime(round.endTick, tickRate),
      round: round.number,
      total_rounds_played: round.number,
      winner: round.winner,
      is_warmup_period: false,
    })),
  };
}

function makeBombEvents(events, rounds, tickRate) {
  const plants = asArray(events.plants, "plants");
  const bombEvents = [];
  for (const plant of plants) {
    const planter = playerBySlot(plant.planter);
    bombEvents.push({
      event_name: "bomb_planted",
      tick: plant.tick,
      game_time: eventTime(plant.tick, tickRate),
      user_steamid: planter?.steamId,
      user_name: planter?.name,
    });
    if (typeof plant.detonationTick === "number") {
      bombEvents.push({
        event_name: "bomb_exploded",
        tick: plant.detonationTick,
        game_time: eventTime(plant.detonationTick, tickRate),
      });
    }
  }
  for (const defuse of asArray(events.defuses, "defuses")) {
    if (
      defuse.outcome &&
      defuse.outcome.status === "completed" &&
      typeof defuse.outcome.tick === "number"
    ) {
      bombEvents.push({
        event_name: "bomb_defused",
        tick: defuse.outcome.tick,
        game_time: eventTime(defuse.outcome.tick, tickRate),
      });
    }
  }
  for (const round of rounds) {
    if (round.reason === "bomb-exploded") {
      bombEvents.push({
        event_name: "bomb_exploded",
        tick: round.endTick,
        game_time: eventTime(round.endTick, tickRate),
      });
    }
  }
  return bombEvents;
}

function makeSideRows(rounds, roundNumber) {
  const round = rounds.find((candidate) => candidate.number === roundNumber);
  const economyBySlot = new Map(
    (round?.economy ?? []).map((entry) => [entry.slot, entry.team]),
  );
  return parserHeader.players.map((player) => {
    const side = economyBySlot.get(player.slot) ?? player.team;
    return {
      steamid: player.steamId,
      name: player.name,
      team: teamNumber(side),
      m_iTeamNum: teamNumber(side),
    };
  });
}

function makeTickRows(track, tick, roundNumber, rounds) {
  const tickRate = track.tickRate;
  const sampleHz = track.sampleHz;
  const frame = Math.min(
    Math.max(Math.floor((tick / tickRate) * sampleHz), 0),
    Math.max(track.frameCount - 1, 0),
  );
  const actualTick = Math.floor((frame / sampleHz) * tickRate);
  const sideRows = makeSideRows(rounds, roundNumber);
  const sideById = new Map(sideRows.map((row) => [row.steamid, row.m_iTeamNum]));
  const weaponNames = parserHeader.weapons ?? [];
  const rows = parserHeader.players.map((player) => {
    const index = frame * track.slotCount + player.slot;
    const weaponIndex = track.weapon[index];
    return {
      X: track.posX[index] ?? 0,
      Y: track.posY[index] ?? 0,
      Z: track.posZ[index] ?? 0,
      steamid: player.steamId,
      name: player.name,
      m_iTeamNum: sideById.get(player.steamId) ?? teamNumber(player.team),
      health: track.health[index] ?? 0,
      is_alive: ((track.flags[index] ?? 0) & FLAG_ALIVE) !== 0,
      active_weapon_name:
        weaponIndex === undefined || weaponIndex === WEAPON_NONE
          ? null
          : weaponNames[weaponIndex] ?? null,
      last_place_name: null,
      game_time: eventTime(actualTick, tickRate),
      tick: actualTick,
    };
  });
  return { actualTick, tickRows: rows, sideRows };
}

function makeRaw(events, track, header) {
  const tickRate = header.tickRate;
  const rounds = asArray(events.rounds, "rounds");
  const roundEvents = makeRoundEvents(rounds, tickRate);
  return {
    header: {
      map_name: header.map,
    },
    playerFirstConnectEvents: header.players.map((player) => ({
      event_name: "player_first_connect",
      steamid: player.steamId,
      name: player.name,
      team: player.team,
    })),
    ...roundEvents,
    killEvents: asArray(events.kills, "kills").map((kill) => ({
      event_name: "player_death",
      tick: kill.tick,
      game_time: eventTime(kill.tick, tickRate),
    })),
    bombEvents: makeBombEvents(events, rounds, tickRate),
    selectionTickStep: Math.max(
      1,
      Math.round(tickRate / (track.sampleHz || 16)) || SAMPLE_STEP_FALLBACK,
    ),
    roundSideRowsByNumber: Object.fromEntries(
      rounds.map((round) => [String(round.number), makeSideRows(rounds, round.number)]),
    ),
  };
}

async function digestSha256(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function parserError(detail) {
  const detailText = detail instanceof Error ? detail.message : String(detail);
  post({
    type: "error",
    code: "unsupported",
    message:
      detailText && detailText !== "browser parser failed"
        ? `浏览器本地 parser 不支持或无法读取这场 Demo；未上传原始文件。(${detailText})`
        : "浏览器本地 parser 不支持或无法读取这场 Demo；未上传原始文件。",
    detail: detailText,
  });
}

async function finishParse(payload) {
  const events = payload.events;
  const track = payload.track;
  if (!parserHeader || !events || !track) {
    throw new Error("browser parser returned no header, events, or track");
  }
  parserHeader = {
    ...parserHeader,
    players: activePlayersForTrack(track),
  };
  const raw = makeRaw(events, track, parserHeader);
  currentLoad.raw = raw;
  currentLoad.demoSha256 = await digestSha256(currentLoad.buffer);
  parsed = { events, track, header: parserHeader, rounds: events.rounds };
  post({
    type: "inspection",
    fileName: currentLoad.fileName,
    fileSize: currentLoad.fileSize,
    demoSha256: currentLoad.demoSha256,
    selectionTickStep: raw.selectionTickStep,
    raw,
  });
}

function handleVendorMessage(message) {
  if (!message || typeof message !== "object") return;
  if (message.type === "progress") {
    post({
      type: "parsing",
      stage: "events",
      percent: message.percent,
    });
    return;
  }
  if (message.type === "header") {
    parserHeader = message.header;
    post({ type: "parsing", stage: "header" });
    return;
  }
  if (message.type === "error") {
    parserError(message.code ?? "browser parser failed");
    return;
  }
  if (message.type === "done") {
    void finishParse(message).catch(parserError);
  }
}

function ensureVendorWorkerProtocol() {
  if (vendorOnMessage !== null) return;
  // The generated worker calls the global `postMessage`. Intercept it while
  // its parser is running so the generated result stays inside this adapter.
  self.postMessage = handleVendorMessage;
  importScripts("/vendor/disalytics/parser-worker.js");
  vendorOnMessage = self.onmessage;
  self.onmessage = handleMessage;
}

async function handleLoad(message) {
  if (!(message.buffer instanceof ArrayBuffer)) {
    throw new Error("Demo worker load requires an ArrayBuffer");
  }
  parserHeader = null;
  parsed = null;
  currentLoad = {
    buffer: message.buffer,
    fileName: message.fileName,
    fileSize: message.fileSize,
    demoSha256: null,
  };
  post({ type: "reading", fileSize: message.fileSize });
  ensureVendorWorkerProtocol();
  post({ type: "parsing", stage: "events" });
  const blob = new Blob([message.buffer]);
  // The vendored worker only needs the File surface used by its stream reader.
  await vendorOnMessage({
    data: {
      source: {
        size: blob.size,
        stream: () => blob.stream(),
      },
    },
  });
}

function handleSelection(message) {
  if (!parsed || !currentLoad?.raw) {
    throw new Error("Demo worker has no inspected Demo");
  }
  const tickStep = currentLoad.raw.selectionTickStep;
  if (!Number.isInteger(message.tick) || message.tick % tickStep !== 0) {
    throw new Error(
      `requested tick ${message.tick} is not aligned to parser sample interval ${tickStep}`,
    );
  }
  post({
    type: "parsing",
    stage: "selected-tick",
    tick: message.tick,
  });
  const selected = makeTickRows(
    parsed.track,
    message.tick,
    message.roundNumber,
    parsed.rounds,
  );
  if (selected.actualTick > message.tick) {
    throw new Error(
      `browser parser sampled future tick ${selected.actualTick} for requested tick ${message.tick}`,
    );
  }
  post({
    type: "selection",
    roundNumber: message.roundNumber,
    requestedTick: message.tick,
    actualTick: selected.actualTick,
    raw: {
      ...currentLoad.raw,
      roundNumber: message.roundNumber,
      tick: selected.actualTick,
      tickRows: selected.tickRows,
      sideRows: selected.sideRows,
    },
  });
}

function handleMessage(event) {
  const message = event.data;
  if (message?.type === "reset") {
    parsed = null;
    parserHeader = null;
    currentLoad = null;
    return;
  }
  void (async () => {
    try {
      if (message?.type === "load") {
        await handleLoad(message);
        return;
      }
      if (message?.type === "select") {
        handleSelection(message);
        return;
      }
      throw new Error("unknown Demo worker message");
    } catch (error) {
      parserError(error);
    }
  })();
}

self.onmessage = handleMessage;
