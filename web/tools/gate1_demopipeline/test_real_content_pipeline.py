import unittest

from parse_lite2_demo import (
    ExtractionSpec,
    _score_from_records,
    infer_team_by_side,
    validate_demo_header,
)


class ExtractionSpecTests(unittest.TestCase):
    def test_spec_is_map_and_round_config_not_a_lite2_fixture(self) -> None:
        spec = ExtractionSpec.from_mapping(
            {
                "mapName": "de_overpass",
                "match": "G2 vs Team Spirit",
                "mapAsset": None,
                "overview": {
                    "posX": -4831,
                    "posY": 1781,
                    "scale": 5.2,
                    "radarWidth": 1024,
                    "radarHeight": 1024,
                    "source": "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/data/radar_info/de_overpass.txt",
                },
                "target": {"humanRound": 10, "remainingSeconds": 40},
                "teamNumbers": {"G2": 3, "Team Spirit": 2},
                "players": {
                    "huNter-": "G2",
                    "HeavyGod": "G2",
                    "NertZ": "G2",
                    "MATYS": "G2",
                    "SunPayus": "G2",
                    "sh1ro": "Team Spirit",
                    "zont1x": "Team Spirit",
                    "magixx": "Team Spirit",
                    "donk": "Team Spirit",
                    "tN1R": "Team Spirit",
                },
            }
        )

        self.assertEqual(spec.map_name, "de_overpass")
        self.assertEqual(spec.target_round, 10)
        self.assertIsNone(spec.map_asset)
        self.assertEqual(spec.team_by_side, {"CT": "G2", "T": "Team Spirit"})

    def test_header_validation_accepts_configured_map(self) -> None:
        validate_demo_header({"map_name": "de_overpass"}, expected_map="de_overpass")

    def test_score_fold_uses_configured_team_names(self) -> None:
        self.assertEqual(
            _score_from_records(
                [
                    {"team_name": "CT", "team_rounds_total": 5},
                    {"team_name": "TERRORIST", "team_rounds_total": 4},
                ],
                {"CT": "Alpha", "T": "Bravo"},
            ),
            {"Alpha": 5, "Bravo": 4},
        )

    def test_target_rows_resolve_the_current_side_after_a_half_switch(self) -> None:
        self.assertEqual(
            infer_team_by_side(
                [
                    {"player_steamid": "a", "team_num": 2},
                    {"player_steamid": "b", "team_num": 3},
                ],
                {"a": "Alpha", "b": "Bravo"},
            ),
            {"CT": "Bravo", "T": "Alpha"},
        )


if __name__ == "__main__":
    unittest.main()
