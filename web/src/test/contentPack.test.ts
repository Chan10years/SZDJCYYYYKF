import normalizedMatchState from "@/data/realMatch/lite2-g2-spirit-r34.json";
import { describe, expect, it } from "vitest";
import {
  buildRealContentPack,
  CONTENT_QA_CHECK_IDS,
} from "@/domain/contentPack";

function stateForMap(mapName: string, overview: { posX: number; posY: number; scale: number }) {
  return {
    ...normalizedMatchState,
    map: {
      ...normalizedMatchState.map,
      name: mapName,
      asset: null,
      overview: {
        ...normalizedMatchState.map.overview,
        ...overview,
      },
    },
  };
}

describe("Gate 3 real content pack boundary", () => {
  it("keeps machine facts draft-only and leaves content judgment to Human QA", () => {
    const pack = buildRealContentPack([
      {
        id: "g3-overpass-r10",
        state: stateForMap("de_overpass", { posX: -4831, posY: 1781, scale: 5.2 }),
      },
      {
        id: "g3-dust2-r10",
        state: stateForMap("de_dust2", { posX: -2476, posY: 3239, scale: 4.4 }),
      },
    ]);

    expect(pack.verificationStatus).toBe("draft");
    expect(pack.humanQaRequired).toBe(true);
    expect(pack.entries.map((entry) => entry.normalizedMatchState.map.name)).toEqual([
      "de_overpass",
      "de_dust2",
    ]);
    expect(pack.entries.every((entry) => entry.verificationStatus === "draft")).toBe(true);
    expect(pack.entries.flatMap((entry) => entry.qaChecks.filter((check) => check.owner === "human").map((check) => check.id))).toEqual(
      expect.arrayContaining([
        "known-unknown",
        "call-tradeoff",
        "tactical-preview",
        "professional-reference",
      ]),
    );
    expect(CONTENT_QA_CHECK_IDS).toHaveLength(9);
  });
});
