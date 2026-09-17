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

function playersForTrack(track) {
  const players = parserHeader?.players ?? [];
  const trackPlayers = players.filter(
    (player) =>
      Number.isInteger(player.slot) &&
      player.slot >= 0 &&
      player.slot < track.slotCount,
  );
  if (trackPlayers.length !== track.slotCount) {
    throw new Error(
      `browser parser header has ${trackPlayers.length} players for ${track.slotCount} track slots`,
    );
  }
  return trackPlayers;
}

function teamNumber(team) {
  if (team === "CT") return 3;
  if (team === "T") return 2;
  throw new Error(`browser parser returned unsupported team value ${String(team)}`);
}

function roundSideValue(team) {
  if (team === "CT" || team === "ct" || team === 3 || team === "3") {
    return "CT";
  }
  if (team === "T" || team === "t" || team === 2 || team === "2") {
    return "T";
  }
  return null;
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

function makeRoundSidePlayers(rounds, roundNumber) {
  const round = rounds.find((candidate) => candidate.number === roundNumber);
  const economy = asArray(round?.economy ?? [], `Round ${roundNumber} economy`);
  return economy.map((entry) => {
    const player = playerBySlot(entry.slot);
    if (!player) {
      throw new Error(
        `Round ${roundNumber} economy references unknown parser slot ${String(entry.slot)}`,
      );
    }
    const side = roundSideValue(entry.team);
    if (side === null) {
      // A player without a supported CT/T value remains a participant
      // identity, but is not evidence for match-roster recovery. This also
      // keeps spectator/observer team values out of canonical side evidence.
      return null;
    }
    return {
      slot: player.slot,
      steamid: player.steamId,
      name: player.name,
      side,
    };
  }).filter((player) => player !== null);
}

function makeSideRows(rounds, roundNumber) {
  return makeRoundSidePlayers(rounds, roundNumber).map((player) => ({
    steamid: player.steamid,
    name: player.name,
    team: teamNumber(player.side),
    m_iTeamNum: teamNumber(player.side),
    slot: player.slot,
  }));
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
  const sideByParserInstance = new Map(
    sideRows.map((row) => [
      `${row.steamid}@slot:${row.slot}`,
      row.m_iTeamNum,
    ]),
  );
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
      slot: player.slot,
      // A missing round economy row stays unknown. The adapter may only use
      // a separately validated round-side snapshot, never final header.team.
      m_iTeamNum:
        sideByParserInstance.get(`${player.steamId}@slot:${player.slot}`) ?? null,
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

function isWithinCompetitiveRound(item, rounds) {
  if (
    !item ||
    !Number.isInteger(item.tick) ||
    item.is_warmup_period === true ||
    item.is_warmup_period === "true" ||
    item.isWarmup === true ||
    item.isWarmup === "true"
  ) {
    return false;
  }
  return rounds.some(
    (round) =>
      Number.isInteger(round.startTick) &&
      item.tick >= round.startTick &&
      (round.endTick === null ||
        round.endTick === undefined ||
        (Number.isInteger(round.endTick) && item.tick < round.endTick)),
  );
}

function makeCompetitiveParticipationEvidence(events, players, rounds) {
  const bySlot = new Map(
    players.map((player) => [
      player.slot,
      {
        slot: player.slot,
        steamid: player.steamId,
        competitiveEventReferenceCount: 0,
        competitiveEventKinds: new Set(),
      },
    ]),
  );
  const addReference = (slot, kind) => {
    if (!Number.isInteger(slot)) return;
    const evidence = bySlot.get(slot);
    if (!evidence) return;
    evidence.competitiveEventReferenceCount += 1;
    evidence.competitiveEventKinds.add(kind);
  };
  const addReferences = (eventKey, fields, predicate = () => true) => {
    for (const item of asArray(events[eventKey] ?? [], eventKey)) {
      if (
        !item ||
        typeof item !== "object" ||
        !isWithinCompetitiveRound(item, rounds) ||
        !predicate(item)
      ) {
        continue;
      }
      for (const field of fields) {
        addReference(item[field], eventKey);
      }
    }
  };

  // These are the only parser event families that can directly name an actor
  // or victim in a competition-scoped event. Economy, movement, spawn,
  // inventory and track presence remain intentionally outside roster evidence.
  const hasKnownNonWorldWeapon = (item) =>
    typeof item.weapon === "string" && item.weapon.trim().toLowerCase() !== "world";

  addReferences("kills", ["attacker", "victim", "assister"], (item) =>
    hasKnownNonWorldWeapon(item),
  );
  addReferences("damage", ["attacker", "victim"], (item) =>
    hasKnownNonWorldWeapon(item) && item.attacker !== item.victim,
  );
  addReferences("shots", ["shooter"]);
  addReferences("grenades", ["thrower"]);
  addReferences("blinds", ["attacker", "victim"]);
  addReferences("plants", ["planter"]);
  addReferences("defuses", ["defuser"]);

  return players.map((player) => {
    const evidence = bySlot.get(player.slot);
    return {
      slot: player.slot,
      steamid: player.steamId,
      competitiveEventReferenceCount: evidence.competitiveEventReferenceCount,
      competitiveEventKinds: [...evidence.competitiveEventKinds].sort(),
    };
  });
}

function makeRaw(events, track, header) {
  const tickRate = header.tickRate;
  const rounds = asArray(events.rounds, "rounds");
  const roundEvents = makeRoundEvents(rounds, tickRate);
  return {
    header: {
      map_name: header.map,
    },
    playerIdentities: header.players.map((player) => ({
      slot: player.slot,
      steamid: player.steamId,
      name: player.name,
      finalSide: player.team,
    })),
    competitiveParticipationEvidence: makeCompetitiveParticipationEvidence(
      events,
      header.players,
      rounds,
    ),
    roundSideSnapshots: rounds.map((round) => ({
      roundNumber: round.number,
      freezeEndTick: round.freezeTimeEndTick,
      players: makeRoundSidePlayers(rounds, round.number),
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
  };
}

async function digestSha256(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function parserErrorWithKind(kind, detail) {
  const detailText = detail instanceof Error ? detail.message : String(detail);
  const prefix =
    kind === "parser-runtime"
      ? "浏览器本地 parser runtime 失败；原始文件未上传。"
      : "浏览器本地 Demo 解析失败；原始文件未上传。";
  post({
    type: "error",
    code: kind,
    message:
      detailText && detailText !== "browser parser failed"
        ? `${prefix}（${detailText}）`
        : prefix,
    detail: detailText,
  });
}

function parserRuntimeError(message) {
  const error = new Error(message);
  error.code = "parser-runtime";
  return error;
}

async function finishParse(payload) {
  const events = payload.events;
  const track = payload.track;
  if (!parserHeader || !events || !track) {
    throw new Error("browser parser returned no header, events, or track");
  }
  parserHeader = {
    ...parserHeader,
    players: playersForTrack(track),
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
    parserErrorWithKind(
      "demo-parse",
      message.message ?? message.code ?? "browser parser failed",
    );
    return;
  }
  if (message.type === "done") {
    void finishParse(message).catch((error) =>
      parserErrorWithKind("demo-parse", error),
    );
  }
}

function ensureVendorWorkerProtocol() {
  if (vendorOnMessage !== null) return;
  // The generated worker calls the global `postMessage`. Intercept it while
  // its parser is running so the generated result stays inside this adapter.
  self.postMessage = handleVendorMessage;
  try {
    importScripts("/vendor/disalytics/parser-worker.js");
  } catch (error) {
    throw parserRuntimeError(
      `无法初始化 vendored parser worker：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  vendorOnMessage = self.onmessage;
  if (typeof vendorOnMessage !== "function") {
    throw parserRuntimeError("vendored parser worker did not expose a message handler");
  }
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
      const kind =
        error?.code === "parser-runtime"
          ? "parser-runtime"
          : "demo-parse";
      parserErrorWithKind(kind, error);
    }
  })();
}

self.onmessage = handleMessage;
