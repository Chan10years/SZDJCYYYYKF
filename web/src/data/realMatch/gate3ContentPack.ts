import lite2MirageState from "./lite2-g2-spirit-r34.json";
import overpassState from "./g3-g2-spirit-m1-overpass-r10.json";
import dust2State from "./g3-g2-spirit-m2-dust2-r10.json";
import { buildRealContentPack } from "@/domain/contentPack";

/**
 * Gate 3 machine snapshot pack. The first entry is the Gate 1 regression
 * slice; the other two were produced by the same configurable extractor from
 * different real maps. None of these entries carries authored calls/routes.
 */
export const gate3RealContentPack = buildRealContentPack([
  {
    id: "gate1-lite2-mirage-r34",
    state: lite2MirageState,
  },
  {
    id: "g3-g2-spirit-overpass-r10",
    state: overpassState,
  },
  {
    id: "g3-g2-spirit-dust2-r10",
    state: dust2State,
  },
]);
