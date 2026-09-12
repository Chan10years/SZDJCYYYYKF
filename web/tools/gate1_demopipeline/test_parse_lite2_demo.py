import importlib.util
import math
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("parse_lite2_demo.py")


def load_module():
    if not MODULE_PATH.exists():
        return None
    spec = importlib.util.spec_from_file_location("gate1_parse_lite2_demo", MODULE_PATH)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Gate1ParserPureFunctionsTest(unittest.TestCase):
    def setUp(self):
        self.module = load_module()
        self.assertIsNotNone(self.module, "Gate 1 parser module is not implemented yet")

    def boundary(self):
        return self.module.RoundBoundary(
            parser_round=33,
            human_round=34,
            freeze_end_tick=179265,
            round_start_game_time=6288.625,
            round_duration_seconds=115.0,
            score={"G2": 16, "Team Spirit": 17},
        )

    def test_selects_human_round_34_from_zero_based_parser_counter(self):
        boundaries = [
            self.module.RoundBoundary(
                parser_round=32,
                human_round=33,
                freeze_end_tick=172004,
                round_start_game_time=6044.0,
                round_duration_seconds=115.0,
                score={"G2": 16, "Team Spirit": 16},
            ),
            self.boundary(),
        ]

        selected = self.module.select_round_boundary(boundaries, human_round=34)

        self.assertEqual(selected.parser_round, 33)
        self.assertEqual(selected.human_round, 34)
        self.assertEqual(selected.freeze_end_tick, 179265)

    def test_missing_target_round_is_an_explicit_compatibility_failure(self):
        with self.assertRaises(self.module.DemoCompatibilityError):
            self.module.select_round_boundary([], human_round=34)

    def test_target_tick_matches_round_clock_and_warning_anchor(self):
        boundary = self.boundary()

        target_tick = self.module.select_target_tick(
            boundary,
            remaining_seconds=40.0,
            tickrate=64.0,
        )

        self.assertEqual(target_tick, 184065)
        self.module.validate_time_identity(
            boundary,
            target_tick=target_tick,
            target_game_time=6363.625,
            remaining_seconds=40.0,
            tickrate=64.0,
            warning_tick=185986,
            warning_game_time=6393.640625,
        )

    def test_non_64_sample_is_rejected_when_tick_time_is_inconsistent(self):
        with self.assertRaises(self.module.DemoCompatibilityError):
            self.module.infer_tickrate([(179265, 6288.625), (179266, 6288.65)])

    def test_normalizes_player_identity_position_and_optional_weapon(self):
        row = {
            "player_steamid": "76561199063238565",
            "player_name": "magixx",
            "team_num": 2,
            "X": 1091.368408,
            "Y": -1032.760254,
            "Z": -260.023499,
            "health": 100,
            "is_alive": True,
            "active_weapon_name": "Flashbang",
            "last_place_name": "PalaceAlley",
        }

        normalized = self.module.normalize_player_row(
            row,
            {"76561199063238565": "Team Spirit"},
        )

        self.assertEqual(normalized["id"], "76561199063238565")
        self.assertEqual(normalized["name"], "magixx")
        self.assertEqual(normalized["team"], "Team Spirit")
        self.assertEqual(normalized["side"], "T")
        self.assertEqual(normalized["alive"], True)
        self.assertEqual(normalized["worldPosition"]["x"], 1091.368408)
        self.assertEqual(normalized["weapon"], "Flashbang")

        row.pop("active_weapon_name")
        self.assertIsNone(
            self.module.normalize_player_row(
                row,
                {"76561199063238565": "Team Spirit"},
            )["weapon"]
        )

    def test_player_set_requires_ten_unique_stable_identities(self):
        rows = [
            {
                "player_steamid": str(index),
                "player_name": f"player-{index}",
                "team_num": 3 if index < 5 else 2,
                "X": float(index),
                "Y": float(index),
                "Z": 0.0,
                "health": 100,
                "is_alive": True,
            }
            for index in range(10)
        ]
        roster = {str(index): "G2" if index < 5 else "Team Spirit" for index in range(10)}

        normalized = self.module.normalize_player_rows(rows, roster, expected_count=10)

        self.assertEqual(len(normalized), 10)
        self.assertEqual(len({player["id"] for player in normalized}), 10)

        with self.assertRaises(self.module.DemoCompatibilityError):
            self.module.normalize_player_rows(rows[:-1], roster, expected_count=10)

    def test_bomb_carrier_is_folded_from_events_at_target_tick(self):
        events = [
            {"tick": 180355, "event": "bomb_pickup", "playerId": "magixx-id", "playerName": "magixx"},
            {"tick": 180563, "event": "bomb_dropped", "playerId": "magixx-id", "playerName": "magixx"},
            {"tick": 181026, "event": "bomb_pickup", "playerId": "sh1ro-id", "playerName": "sh1ro"},
            {"tick": 181393, "event": "bomb_dropped", "playerId": "sh1ro-id", "playerName": "sh1ro"},
            {"tick": 181469, "event": "bomb_pickup", "playerId": "magixx-id", "playerName": "magixx"},
        ]

        bomb = self.module.fold_bomb_events(events, target_tick=184065)

        self.assertEqual(bomb["status"], "carried")
        self.assertEqual(bomb["carrierId"], "magixx-id")
        self.assertEqual(bomb["carrierName"], "magixx")
        self.assertIn("event", bomb["derivedFrom"])

        unavailable = self.module.fold_bomb_events([], target_tick=184065)
        self.assertEqual(unavailable["status"], "unavailable")
        self.assertIsNone(unavailable["carrierId"])

    def test_wrong_map_and_roster_fail_without_guessing(self):
        with self.assertRaises(self.module.DemoCompatibilityError):
            self.module.validate_demo_header({"map_name": "de_dust2"})

        with self.assertRaises(self.module.DemoCompatibilityError):
            self.module.normalize_player_row(
                {
                    "player_steamid": "unknown",
                    "player_name": "unknown",
                    "team_num": 2,
                    "X": 0.0,
                    "Y": 0.0,
                    "Z": 0.0,
                    "health": 100,
                    "is_alive": True,
                },
                {},
            )

    def test_deterministic_json_rejects_non_finite_values(self):
        first = self.module.serialize_deterministic({"z": 1, "a": {"b": 2}})
        second = self.module.serialize_deterministic({"a": {"b": 2}, "z": 1})

        self.assertEqual(first, second)
        self.assertLess(first.index('"a"'), first.index('"z"'))
        with self.assertRaises(ValueError):
            self.module.serialize_deterministic({"bad": math.nan})


if __name__ == "__main__":
    unittest.main()
