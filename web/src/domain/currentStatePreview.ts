import {
  parseNormalizedMatchState,
  type NormalizedMatchState,
} from "./normalizedMatchState";
import {
  MIRAGE_RADAR_METADATA,
  worldToNormalizedPosition,
  type TacticalMapPosition,
} from "./coordinateAdapter";

export type CurrentStatePreviewPlayer = {
  id: string;
  name: string;
  team: "G2" | "Team Spirit";
  side: "CT" | "T";
  alive: boolean;
  health: number;
  weapon: string | null;
  place: string | null;
  worldPosition: NormalizedMatchState["players"][number]["worldPosition"];
  mapPosition: Pick<TacticalMapPosition, "radarX" | "radarY">;
  normalizedPosition: Pick<TacticalMapPosition, "x" | "y">;
};

export type CurrentStatePreviewData = {
  kind: "current-match-state";
  map: "de_mirage";
  asset: string;
  round: number;
  parserRound: number;
  tick: number;
  timeLabel: string;
  score: NormalizedMatchState["round"]["score"];
  players: CurrentStatePreviewPlayer[];
  bomb: Pick<NormalizedMatchState["bomb"], "status" | "carrierId" | "carrierName">;
  source: Pick<NormalizedMatchState["source"], "demoFile" | "parserVersion" | "demoSha256">;
};

function assertSupportedMirage(state: NormalizedMatchState): void {
  if (state.map.name !== "de_mirage") {
    throw new Error(`Current-state preview does not support map ${state.map.name}`);
  }
  const overview = state.map.overview;
  for (const [key, expected] of Object.entries(MIRAGE_RADAR_METADATA)) {
    if (key === "source") continue;
    if (overview[key as keyof typeof overview] !== expected) {
      throw new Error(`Current-state preview received unsupported Mirage metadata for ${key}`);
    }
  }
}

export function buildCurrentStatePreview(input: unknown): CurrentStatePreviewData {
  const state = parseNormalizedMatchState(input);
  assertSupportedMirage(state);
  return {
    kind: "current-match-state",
    map: "de_mirage",
    asset: state.map.asset,
    round: state.round.number,
    parserRound: state.round.parserRound,
    tick: state.tick,
    timeLabel: state.time.display,
    score: state.round.score,
    players: state.players.map((player) => {
      const position = worldToNormalizedPosition(player.worldPosition, state.map.overview);
      return {
        id: player.id,
        name: player.name,
        team: player.team,
        side: player.side,
        alive: player.alive,
        health: player.health,
        weapon: player.weapon,
        place: player.place,
        worldPosition: player.worldPosition,
        mapPosition: { radarX: position.radarX, radarY: position.radarY },
        normalizedPosition: { x: position.x, y: position.y },
      };
    }),
    bomb: {
      status: state.bomb.status,
      carrierId: state.bomb.carrierId,
      carrierName: state.bomb.carrierName,
    },
    source: {
      demoFile: state.source.demoFile,
      parserVersion: state.source.parserVersion,
      demoSha256: state.source.demoSha256,
    },
  };
}
