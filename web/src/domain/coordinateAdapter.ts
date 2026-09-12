export type WorldPosition = {
  x: number;
  y: number;
  z: number;
};

export type RadarMapMetadata = {
  posX: number;
  posY: number;
  scale: number;
  radarWidth: number;
  radarHeight: number;
  source: string;
};

export type TacticalMapPosition = {
  radarX: number;
  radarY: number;
  x: number;
  y: number;
};

export const MIRAGE_RADAR_METADATA: RadarMapMetadata = {
  posX: -3230,
  posY: 1713,
  scale: 5,
  radarWidth: 1024,
  radarHeight: 1024,
  source:
    "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/data/radar_info/de_mirage.txt",
};

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Coordinate ${field} must be finite`);
  }
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function assertMetadata(metadata: RadarMapMetadata): void {
  assertFinite(metadata.posX, "posX");
  assertFinite(metadata.posY, "posY");
  assertFinite(metadata.scale, "scale");
  assertFinite(metadata.radarWidth, "radarWidth");
  assertFinite(metadata.radarHeight, "radarHeight");
  if (metadata.scale <= 0 || metadata.radarWidth <= 0 || metadata.radarHeight <= 0) {
    throw new Error("Coordinate metadata must use positive scale and dimensions");
  }
}

export function worldToNormalizedPosition(
  world: WorldPosition,
  metadata: RadarMapMetadata,
): TacticalMapPosition {
  assertMetadata(metadata);
  assertFinite(world.x, "world.x");
  assertFinite(world.y, "world.y");
  assertFinite(world.z, "world.z");

  const radarX = (world.x - metadata.posX) / metadata.scale;
  const radarY = (metadata.posY - world.y) / metadata.scale;
  assertFinite(radarX, "radarX");
  assertFinite(radarY, "radarY");
  if (radarX < 0 || radarX > metadata.radarWidth || radarY < 0 || radarY > metadata.radarHeight) {
    throw new Error(
      `World position is outside ${metadata.radarWidth}x${metadata.radarHeight} radar bounds`,
    );
  }

  const x = roundTo((radarX / metadata.radarWidth) * 100, 2);
  const y = roundTo((radarY / metadata.radarHeight) * 100, 2);
  if (x < 0 || x > 100 || y < 0 || y > 100) {
    throw new Error("Normalized coordinate is outside the 0..100 contract");
  }
  return { radarX, radarY, x, y };
}
