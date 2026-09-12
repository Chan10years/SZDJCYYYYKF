import { describe, expect, it } from "vitest";
import normalizedMatchState from "@/data/realMatch/lite2-g2-spirit-r34.json";
import {
  LITE2_CURRENT_STATE_MAP_CALIBRATION,
  normalizedToImagePosition,
} from "@/domain/mapCalibration";
import {
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
