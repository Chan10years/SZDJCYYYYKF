# Gate 1 offline demo spike

This directory contains the disposable/offline producer for the Gate 1 real-match vertical slice. It writes one versioned `NormalizedMatchState` JSON artifact; it does not run an HTTP service, persist a database, or provide a replay engine.

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

The Mirage overview adapter uses `pos_x=-3230`, `pos_y=1713`, `scale=5`, and a 1024×1024 overview coordinate frame. The metadata values are traceable to the `de_mirage.txt` overview record used by the product adapter. The existing `/maps/Lite2_Map.png` remains a separate 4:3 product image; its renderer letterbox transform is not mixed into world-coordinate conversion.

The extracted state remains `verificationStatus: "draft"` and requires human QA. The raw `.dem` files are external inputs and must not be committed.
