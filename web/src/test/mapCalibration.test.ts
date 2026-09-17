import { describe, expect, it } from "vitest";
import normalizedMatchState from "@/data/realMatch/lite2-g2-spirit-r34.json";
import {
  ANCIENT_CURRENT_STATE_MAP_CALIBRATION,
  ANCIENT_CURRENT_STATE_MAP_RENDER_FRAME,
  LITE2_CURRENT_STATE_MAP_CALIBRATION,
  normalizedToImagePosition,
  normalizedToImagePositionWithCalibration,
} from "@/domain/mapCalibration";
import {
  ANCIENT_RADAR_METADATA,
  MIRAGE_RADAR_METADATA,
  worldToNormalizedPosition,
} from "@/domain/coordinateAdapter";
import { buildCurrentStatePreview } from "@/domain/currentStatePreview";

describe("Lite2 current-state image calibration", () => {
  it("uses the clean map's native raster frame", () => {
    expect(LITE2_CURRENT_STATE_MAP_CALIBRATION).toMatchObject({
      map: "de_mirage",
      asset: "/maps/Lite2_CurrentStateBase.png",
      imageWidth: 1448,
      imageHeight: 1086,
      coordinateFrame: "mirage-overview-native-raster",
      affine: {
        x: { scale: 15.8225806452, offset: -121.9193548387 },
        y: { scale: 15.25, offset: -180 },
      },
    });
  });

  it("converts official world landmarks through radar and 0..100 into Lite2 pixels", () => {
    for (const landmark of LITE2_CURRENT_STATE_MAP_CALIBRATION.landmarks) {
      const normalized = worldToNormalizedPosition(landmark.world, MIRAGE_RADAR_METADATA);

      expect(normalized.radarX).toBeCloseTo(landmark.radar.x, 2);
      expect(normalized.radarY).toBeCloseTo(landmark.radar.y, 2);
      expect(normalized.x).toBe(landmark.normalized.x);
      expect(normalized.y).toBe(landmark.normalized.y);
      expect(normalizedToImagePosition(normalized)).toEqual(landmark.image);
    }
  });

  it("keeps the calibration within the recorded landmark tolerance", () => {
    for (const landmark of [
      ...LITE2_CURRENT_STATE_MAP_CALIBRATION.landmarks,
      ...LITE2_CURRENT_STATE_MAP_CALIBRATION.visualQaLandmarks,
    ]) {
      const projected = normalizedToImagePosition(landmark.normalized);
      const distance = Math.hypot(
        projected.x - landmark.image.x,
        projected.y - landmark.image.y,
      );

      expect(distance).toBeLessThanOrEqual(landmark.tolerancePixels);
    }
  });

  it("rejects normalized coordinates outside the product contract", () => {
    expect(() => normalizedToImagePosition({ x: -0.01, y: 50 })).toThrow();
    expect(() => normalizedToImagePosition({ x: 50, y: 100.01 })).toThrow();
  });

  it("projects the target player into the calibrated native image frame", () => {
    const preview = buildCurrentStatePreview(normalizedMatchState);
    const magixx = preview.players.find((player) => player.name === "magixx");

    expect(preview.asset).toBe("/maps/Lite2_CurrentStateBase.png");
    expect(magixx?.imagePosition).toEqual({
      x: 1214.61,
      y: 637.25,
    });
    expect(magixx?.imagePosition).toEqual(
      normalizedToImagePosition(magixx!.normalizedPosition),
    );
  });
});

describe("Ancient current-state image calibration", () => {
  it("uses the published 1024x1024 radar frame without an affine guess", () => {
    expect(ANCIENT_CURRENT_STATE_MAP_CALIBRATION).toMatchObject({
      map: "de_ancient",
      asset: "/maps/Ancient_CurrentStateBase.png",
      imageWidth: 1024,
      imageHeight: 1024,
      coordinateFrame: "de_ancient-radar-overview",
      projection: "cs2-radar-overview",
      radarWidth: 1024,
      radarHeight: 1024,
      overviewSource: ANCIENT_RADAR_METADATA.source,
    });
  });

  it("projects Ancient radar coordinates directly into the native raster", () => {
    expect(
      normalizedToImagePositionWithCalibration(
        { radarX: 317.44, radarY: 256, x: 31, y: 25 },
        ANCIENT_CURRENT_STATE_MAP_RENDER_FRAME,
      ),
    ).toEqual({ x: 317.44, y: 256 });
  });
});
