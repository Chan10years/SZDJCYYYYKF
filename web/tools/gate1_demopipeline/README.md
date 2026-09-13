# Gate 1 offline demo spike

This directory contains the disposable/offline producer for the Gate 1 real-match vertical slice. Its parser module now also exposes the shared configurable core used by Gate 3; `extract_lite2_demo` remains a compatibility adapter. It writes versioned `NormalizedMatchState` JSON artifacts; it does not run an HTTP service, persist a database, or provide a replay engine.

## Verified source selection

The supplied package contains two Mirage demos for this match. Both were parsed with `demoparser2==0.42.0` and checked from Demo-internal header, roster, and `round_freeze_end` data:

| File | Demo map | Human round range | SHA-256 |
| --- | --- | --- | --- |
| `g2-vs-spirit-m3-mirage-p1.dem` | `de_mirage` | 1–13 | `63B64AC04C411DCB549FC129E0BDCA1DC9B4693E526CFD7B6BFDB650BCE9CDCA` |
| `g2-vs-spirit-m3-mirage-p2.dem` | `de_mirage` | 14–47 | `841939B0473C0BAEF62C56AA54017465ADD2E3AECC2DE8A9B17FC51943CCAA46` |

The target is therefore `p2`, not because of its filename ordering: its verified roster is G2 (`huNter-`, `HeavyGod`, `NertZ`, `MATYS`, `SunPayus`) versus Team Spirit (`sh1ro`, `zont1x`, `magixx`, `donk`, `tN1R`), and its internal boundaries include human Round 34.

For Round 34, the parser counter is 33 and the freeze-end boundary is tick `179265`. Game-time samples establish 64 tick/s. With the Lite2 clock meaning “40 seconds remaining” and a 115-second round, the target is tick `184065`. The Round 34 `round_time_warning` event at tick `185986` is used as an independent 10-seconds-remaining anchor.

## Run

Install the pinned parser in an isolated Python environment, then inspect each supplied demo:

```text
python -m pip install -r tools/gate1_demopipeline/requirements.txt
python tools/gate1_demopipeline/parse_lite2_demo.py --demo "D:\CS2 Demo\iem-cologne-major-2026-g2-vs-spirit-bo3-47sPOFVPbC3W0qqMbD_6GI\g2-vs-spirit-m3-mirage-p1.dem" --inspect-rounds
python tools/gate1_demopipeline/parse_lite2_demo.py --demo "D:\CS2 Demo\iem-cologne-major-2026-g2-vs-spirit-bo3-47sPOFVPbC3W0qqMbD_6GI\g2-vs-spirit-m3-mirage-p2.dem" --inspect-rounds
```

Generate the committed proof artifact from the verified `p2` file:

```text
python tools/gate1_demopipeline/parse_lite2_demo.py --demo "D:\CS2 Demo\iem-cologne-major-2026-g2-vs-spirit-bo3-47sPOFVPbC3W0qqMbD_6GI\g2-vs-spirit-m3-mirage-p2.dem" --output src/data/realMatch/lite2-g2-spirit-r34.json
```

The producer records unavailable aggregate alive/round-state fields rather than treating the observed stale values as authoritative. Alive status/count comes from the ten player rows, and bomb carrier is folded from ordered bomb events through the target tick.

## Coordinate provenance

The Mirage overview adapter uses `pos_x=-3230`, `pos_y=1713`, `scale=5`, and a 1024×1024 overview coordinate frame. The metadata values are traceable to the [`de_mirage.txt` overview record](https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/data/radar_info/de_mirage.txt). Published Mirage landmark coordinates are cross-checked against the [CS2 Reference map table](https://cs2opendev.github.io/CS2OpenDev-Docs/maps/). The existing `/maps/Lite2_Map.png` remains a separate 4:3 product image; its renderer letterbox transform is not mixed into world-coordinate conversion.

The current-state renderer uses the separate `/maps/Lite2_CurrentStateBase.png` asset. It is a deterministic derivative of the supplied `Lite2_Map.png`: the native 1448×1086 frame, map silhouette, walls, site landmarks, and spawn colours are retained; the five authored player/C4 regions and the baked legend are excluded. The original authored asset remains unchanged.

Asset provenance and reproducibility:

```text
source: Lite2_Map.png
source SHA-256: 0A722F0845150F27E9AD1AFA26BBF163695C2ACFE758A16F492707CE730AE831
output: Lite2_CurrentStateBase.png
output SHA-256: A1C4600C58B1283E67443A3CFE332EEE2923D8645A853117082AF08EF260E15B
dimensions: 1448x1086 RGBA
generator: python tools/gate1_demopipeline/build_clean_lite2_map.py
```

The product-side calibration explicitly bridges the overview frame to the supplied Lite2 raster. The published bomb-site anchors are B `(23,28)` → `(242,247)` and A `(54,76)` → `(732.5,979)` in native Lite2 pixels, producing:
`imageX = -121.9193548387 + normalizedX * 15.8225806452` and
`imageY = -180 + normalizedY * 15.25`.
The CT/T spawn regions are independent visual checks at normalized `(28,70)` → approximately `(354,868)` and `(87,36)` → approximately `(1263,363)`, with recorded pixel tolerances. The current-state SVG uses `viewBox="0 0 1448 1086"`, so no authored `matrix(1 0 0 0.75 0 12.5)` transform is applied to real markers.

The extracted state remains `verificationStatus: "draft"` and requires human QA. The raw `.dem` files are external inputs and must not be committed.
