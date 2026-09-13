import {
  MIRAGE_RADAR_METADATA,
  type TacticalMapPosition,
} from "./coordinateAdapter";

export type ImagePosition = {
  x: number;
  y: number;
};

export type ImageCalibration = {
  affine: {
    x: { scale: number; offset: number };
    y: { scale: number; offset: number };
  };
};

type CalibrationLandmark = {
  id: string;
  label: string;
  normalized: Pick<TacticalMapPosition, "x" | "y">;
  image: ImagePosition;
  tolerancePixels: number;
  world: { x: number; y: number; z: number };
  radar: { x: number; y: number };
};

type VisualCalibrationLandmark = {
  id: string;
  label: string;
  normalized: Pick<TacticalMapPosition, "x" | "y">;
  image: ImagePosition;
  tolerancePixels: number;
};

/**
 * Calibration for the clean current-state raster. This is deliberately a
 * separate frame from the authored Scenario renderer: the raster is 4:3 and
 * the SVG uses those native pixels as its viewBox, so no authored letterbox
 * matrix is involved in current-state rendering.
 *
 * Lite2's supplied illustration is not a full-bleed 1024x1024 overview. Its
 * map geometry is a cropped/stylized 1448x1086 raster, so the final step is an
 * explicit axis-aligned affine calibration from the normalized overview frame
 * into that raster. The two bomb-site anchors are the fit points; spawn
 * regions are independent visual QA checks documented below.
 */
export const LITE2_CURRENT_STATE_MAP_CALIBRATION = {
  map: "de_mirage",
  asset: "/maps/Lite2_CurrentStateBase.png",
  imageWidth: 1448,
  imageHeight: 1086,
  coordinateFrame: "mirage-overview-native-raster",
  overviewMetadata: MIRAGE_RADAR_METADATA,
  affine: {
    x: { scale: 15.8225806452, offset: -121.9193548387 },
    y: { scale: 15.25, offset: -180 },
  },
  formula:
    "imageX = -121.9193548387 + normalizedX * 15.8225806452; imageY = -180 + normalizedY * 15.25",
  provenance: {
    sourceAsset: "/maps/Lite2_Map.png",
    note: "Same Lite2 map geometry with authored player/C4/legend pixels removed for current-state rendering.",
    overviewLandmarks: "https://cs2opendev.github.io/CS2OpenDev-Docs/maps/",
  },
  landmarks: [
    {
      id: "bombsite-b",
      label: "Bombsite B",
      world: { x: -2052.4, y: 279.4, z: 0 },
      radar: { x: 235.52, y: 286.72 },
      normalized: { x: 23, y: 28 },
      image: { x: 242, y: 247 },
      tolerancePixels: 18,
    },
    {
      id: "bombsite-a",
      label: "Bombsite A",
      world: { x: -465.2, y: -2178.2, z: 0 },
      radar: { x: 552.96, y: 778.24 },
      normalized: { x: 54, y: 76 },
      image: { x: 732.5, y: 979 },
      tolerancePixels: 18,
    },
  ] satisfies readonly CalibrationLandmark[],
  visualQaLandmarks: [
    {
      id: "ct-spawn",
      label: "CT spawn region",
      normalized: { x: 28, y: 70 },
      image: { x: 354, y: 868 },
      tolerancePixels: 42,
    },
    {
      id: "t-spawn",
      label: "T spawn region",
      normalized: { x: 87, y: 36 },
      image: { x: 1263, y: 363 },
      tolerancePixels: 24,
    },
  ] satisfies readonly VisualCalibrationLandmark[],
} as const;

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function assertNormalizedCoordinate(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`Normalized coordinate ${field} must be finite and within 0..100`);
  }
}

/** Convert the product's 0..100 overview coordinate into clean-image pixels. */
export function normalizedToImagePositionWithCalibration(
  position: Pick<TacticalMapPosition, "x" | "y">,
  calibration: ImageCalibration,
): ImagePosition {
  assertNormalizedCoordinate(position.x, "x");
  assertNormalizedCoordinate(position.y, "y");
  return {
    x: roundTo(
      calibration.affine.x.offset + position.x * calibration.affine.x.scale,
      2,
    ),
    y: roundTo(
      calibration.affine.y.offset + position.y * calibration.affine.y.scale,
      2,
    ),
  };
}

/** Backwards-compatible Lite2 calibration adapter used by authored tests. */
export function normalizedToImagePosition(
  position: Pick<TacticalMapPosition, "x" | "y">,
): ImagePosition {
  return normalizedToImagePositionWithCalibration(
    position,
    LITE2_CURRENT_STATE_MAP_CALIBRATION,
  );
}
