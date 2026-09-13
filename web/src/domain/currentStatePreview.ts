import {
  parseNormalizedMatchState,
  type NormalizedMatchState,
} from "./normalizedMatchState";
import {
  worldToNormalizedPosition,
  type TacticalMapPosition,
} from "./coordinateAdapter";
import {
  LITE2_CURRENT_STATE_MAP_CALIBRATION,
  normalizedToImagePositionWithCalibration,
  type ImageCalibration,
  type ImagePosition,
} from "./mapCalibration";

export type CurrentStatePreviewPlayer = {
  id: string;
  name: string;
  team: string;
  side: "CT" | "T";
  alive: boolean;
  health: number;
  weapon: string | null;
  place: string | null;
  worldPosition: NormalizedMatchState["players"][number]["worldPosition"];
  mapPosition: Pick<TacticalMapPosition, "radarX" | "radarY">;
  normalizedPosition: Pick<TacticalMapPosition, "x" | "y">;
  imagePosition: ImagePosition;
};

export type CurrentStatePreviewData = {
  kind: "current-match-state";
  map: string;
  asset: string;
  imageWidth: number;
  imageHeight: number;
  coordinateFrame: string;
  round: number;
  parserRound: number;
  tick: number;
  timeLabel: string;
  score: NormalizedMatchState["round"]["score"];
  players: CurrentStatePreviewPlayer[];
  bomb: Pick<NormalizedMatchState["bomb"], "status" | "carrierId" | "carrierName">;
  source: Pick<NormalizedMatchState["source"], "demoFile" | "parserVersion" | "demoSha256">;
};

function resolveRenderCalibration(state: NormalizedMatchState): {
  asset: string;
  imageWidth: number;
  imageHeight: number;
  coordinateFrame: string;
  calibration: ImageCalibration;
} {
  if (state.map.render) {
    return {
      asset: state.map.render.asset,
      imageWidth: state.map.render.imageWidth,
      imageHeight: state.map.render.imageHeight,
      coordinateFrame: state.map.render.coordinateFrame,
      calibration: state.map.render,
    };
  }

  // Keep the Gate 1 contract alive without allowing an arbitrary Mirage
  // image to inherit its calibration. New maps must carry an explicit,
  // Human-QA-approved render frame in the normalized state.
  if (
    state.map.name === "de_mirage" &&
    state.map.asset === "/maps/Lite2_Map.png"
  ) {
    return {
      asset: LITE2_CURRENT_STATE_MAP_CALIBRATION.asset,
      imageWidth: LITE2_CURRENT_STATE_MAP_CALIBRATION.imageWidth,
      imageHeight: LITE2_CURRENT_STATE_MAP_CALIBRATION.imageHeight,
      coordinateFrame: LITE2_CURRENT_STATE_MAP_CALIBRATION.coordinateFrame,
      calibration: LITE2_CURRENT_STATE_MAP_CALIBRATION,
    };
  }

  throw new Error(
    `Current-state preview requires a Human-QA-approved raster calibration for ${state.map.name}`,
  );
}

export function buildCurrentStatePreview(input: unknown): CurrentStatePreviewData {
  const state = parseNormalizedMatchState(input);
  const render = resolveRenderCalibration(state);
  return {
    kind: "current-match-state",
    map: state.map.name,
    asset: render.asset,
    imageWidth: render.imageWidth,
    imageHeight: render.imageHeight,
    coordinateFrame: render.coordinateFrame,
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
        imagePosition: normalizedToImagePositionWithCalibration(
          position,
          render.calibration,
        ),
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
