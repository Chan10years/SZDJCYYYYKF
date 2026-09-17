import { describe, expect, it } from "vitest";

async function loadCoordinateAdapter() {
  try {
    return await import("@/domain/coordinateAdapter");
  } catch {
    return null;
  }
}

describe("Gate 1 Mirage coordinate adapter", () => {
  it("maps overview corners and preserves the radar Y direction", async () => {
    const adapter = await loadCoordinateAdapter();
    expect(adapter, "Gate 1 coordinate adapter is not implemented yet").not.toBeNull();
    if (!adapter) return;

    expect(
      adapter.worldToNormalizedPosition({ x: -3230, y: 1713, z: 0 }, adapter.MIRAGE_RADAR_METADATA),
    ).toEqual({ radarX: 0, radarY: 0, x: 0, y: 0 });
    expect(
      adapter.worldToNormalizedPosition({ x: 1890, y: -3407, z: 0 }, adapter.MIRAGE_RADAR_METADATA),
    ).toEqual({ radarX: 1024, radarY: 1024, x: 100, y: 100 });
  });

  it("maps the known target player without a mirror or systematic offset", async () => {
    const adapter = await loadCoordinateAdapter();
    expect(adapter, "Gate 1 coordinate adapter is not implemented yet").not.toBeNull();
    if (!adapter) return;

    const position = adapter.worldToNormalizedPosition(
      { x: 1091.368408, y: -1032.760254, z: -260.023499 },
      adapter.MIRAGE_RADAR_METADATA,
    );

    expect(position.radarX).toBeCloseTo(864.27368, 4);
    expect(position.radarY).toBeCloseTo(549.15205, 4);
    expect(position.x).toBe(84.4);
    expect(position.y).toBe(53.63);
  });

  it("maps the published Bombsite A landmark to its overview position", async () => {
    const adapter = await loadCoordinateAdapter();
    expect(adapter, "Gate 1 coordinate adapter is not implemented yet").not.toBeNull();
    if (!adapter) return;

    const bombsiteA = adapter.worldToNormalizedPosition(
      { x: -465.2, y: -2178.2, z: 0 },
      adapter.MIRAGE_RADAR_METADATA,
    );

    expect(bombsiteA.x).toBe(54);
    expect(bombsiteA.y).toBe(76);
  });

  it("rejects coordinates outside the configured overview instead of clipping them", async () => {
    const adapter = await loadCoordinateAdapter();
    expect(adapter, "Gate 1 coordinate adapter is not implemented yet").not.toBeNull();
    if (!adapter) return;

    expect(() =>
      adapter.worldToNormalizedPosition(
        { x: 1891, y: -341, z: 0 },
        adapter.MIRAGE_RADAR_METADATA,
      ),
    ).toThrow();
  });

  it("maps the published Ancient bombsite landmarks in the same radar frame", async () => {
    const adapter = await loadCoordinateAdapter();
    expect(adapter, "Ancient coordinate metadata is not implemented yet").not.toBeNull();
    if (!adapter) return;

    const bombsiteA = adapter.worldToNormalizedPosition(
      { x: -1365.8, y: 884, z: 0 },
      adapter.ANCIENT_RADAR_METADATA,
    );
    const bombsiteB = adapter.worldToNormalizedPosition(
      { x: 1143, y: 116, z: 0 },
      adapter.ANCIENT_RADAR_METADATA,
    );

    expect(bombsiteA).toMatchObject({ radarX: 317.44, radarY: 256, x: 31, y: 25 });
    expect(bombsiteB).toMatchObject({ radarX: 819.2, radarY: 409.6, x: 80, y: 40 });
  });
});
