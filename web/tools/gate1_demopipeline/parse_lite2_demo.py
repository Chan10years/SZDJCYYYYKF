"""Offline demoparser2 adapter for deterministic real-match snapshots.

The configurable core is shared by Gate 1 compatibility and Gate 3 content
batch extraction. It intentionally stops at one deterministic
NormalizedMatchState JSON artifact; it is not a parser service or replay
engine.
"""

import argparse
import hashlib
import importlib.metadata
import json
import math
import sys
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence


SUPPORTED_MAP = "de_mirage"
EXPECTED_PARSER_VERSION = "0.42.0"
EXPECTED_ROUND = 34
EXPECTED_REMAINING_SECONDS = 40.0
EXPECTED_TICKRATE = 64.0
EXPECTED_PLAYER_COUNT = 10
EXPECTED_SCORE = {"G2": 16, "Team Spirit": 17}

MIRAGE_OVERVIEW = {
    "posX": -3230.0,
    "posY": 1713.0,
    "scale": 5.0,
    "radarWidth": 1024.0,
    "radarHeight": 1024.0,
    "source": "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/data/radar_info/de_mirage.txt",
}

EXPECTED_PLAYER_TEAMS = {
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
}

EXPECTED_TEAM_NUMBERS = {"G2": 3, "Team Spirit": 2}

PLAYER_FIELDS = [
    "X",
    "Y",
    "Z",
    "health",
    "is_alive",
    "player_name",
    "player_steamid",
    "team_num",
    "active_weapon_name",
    "last_place_name",
    "game_time",
]

GAME_RULE_FIELDS = [
    "team_rounds_total",
    "team_name",
    "round_start_time",
    "game_time",
    "total_rounds_played",
    "rounds_played_this_phase",
    "is_bomb_dropped",
    "is_bomb_planted",
    "round_in_progress",
    "num_player_alive_ct",
    "num_player_alive_t",
    "CCSGameRulesProxy.CCSGameRules.m_iRoundTime",
]

BOMB_EVENT_NAMES = (
    "bomb_pickup",
    "bomb_dropped",
    "bomb_planted",
    "bomb_defused",
    "bomb_exploded",
)

class DemoCompatibilityError(RuntimeError):
    """Raised when the supplied demo cannot support this exact proof target."""


@dataclass(frozen=True)
class RoundBoundary:
    parser_round: int
    human_round: int
    freeze_end_tick: int
    round_start_game_time: float
    round_duration_seconds: float
    score: dict[str, int]


@dataclass(frozen=True)
class ExtractionSpec:
    """Human-supplied selection/configuration for one real demo snapshot.

    The parser only recovers observable game state.  The spec identifies the
    verified match roster and the exact map/time context; it does not contain
    authored calls, reasons, routes, or professional conclusions.
    """

    map_name: str
    match: str
    map_asset: str | None
    overview: dict[str, Any]
    team_by_name: dict[str, str]
    team_numbers: dict[str, int]
    target_round: int
    target_remaining_seconds: float | None = None
    target_elapsed_seconds: float | None = None
    expected_score: dict[str, int] | None = None
    expected_player_count: int = EXPECTED_PLAYER_COUNT
    expected_tickrate: float = EXPECTED_TICKRATE
    parser: str = "demoparser2"
    parser_version: str = EXPECTED_PARSER_VERSION
    selection_evidence: str = "configured map + verified roster + parser round/time anchors"
    warning_remaining_seconds: float = 10.0
    require_warning_anchor: bool = False
    validate_roster_team_numbers: bool = False
    render: dict[str, Any] | None = None

    @property
    def team_by_side(self) -> dict[str, str]:
        team_by_number = {number: team for team, number in self.team_numbers.items()}
        if set(team_by_number) != {2, 3}:
            raise DemoCompatibilityError(
                "CS2 extraction requires exactly one configured team for team_num 2 and 3"
            )
        return {"CT": team_by_number[3], "T": team_by_number[2]}

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any]) -> "ExtractionSpec":
        def required_string(key: str) -> str:
            value = raw.get(key)
            if not isinstance(value, str) or not value.strip():
                raise DemoCompatibilityError(f"extraction spec requires non-empty {key}")
            return value.strip()

        target = raw.get("target")
        if not isinstance(target, Mapping):
            raise DemoCompatibilityError("extraction spec requires a target object")
        overview = raw.get("overview")
        if not isinstance(overview, Mapping):
            raise DemoCompatibilityError("extraction spec requires an overview object")
        players = raw.get("players")
        if not isinstance(players, Mapping) or not players:
            raise DemoCompatibilityError("extraction spec requires a verified players mapping")
        team_numbers = raw.get("teamNumbers")
        if not isinstance(team_numbers, Mapping) or not team_numbers:
            raise DemoCompatibilityError("extraction spec requires teamNumbers")

        map_asset = raw.get("mapAsset")
        if map_asset is not None and (not isinstance(map_asset, str) or not map_asset.strip()):
            raise DemoCompatibilityError("mapAsset must be a non-empty string or null")
        expected_score = raw.get("expectedScore")
        if expected_score is not None and not isinstance(expected_score, Mapping):
            raise DemoCompatibilityError("expectedScore must be an object when provided")
        target_remaining = target.get("remainingSeconds")
        target_elapsed = target.get("elapsedSeconds")
        if (target_remaining is None) == (target_elapsed is None):
            raise DemoCompatibilityError(
                "target requires exactly one of remainingSeconds or elapsedSeconds"
            )

        return cls(
            map_name=required_string("mapName"),
            match=required_string("match"),
            map_asset=map_asset.strip() if isinstance(map_asset, str) else None,
            overview=dict(overview),
            team_by_name={str(name): str(team) for name, team in players.items()},
            team_numbers={str(team): int(number) for team, number in team_numbers.items()},
            target_round=int(target.get("humanRound")),
            target_remaining_seconds=(
                float(target_remaining) if target_remaining is not None else None
            ),
            target_elapsed_seconds=(
                float(target_elapsed) if target_elapsed is not None else None
            ),
            expected_score=(
                {str(team): int(score) for team, score in expected_score.items()}
                if isinstance(expected_score, Mapping)
                else None
            ),
            expected_player_count=int(raw.get("expectedPlayerCount", EXPECTED_PLAYER_COUNT)),
            expected_tickrate=float(raw.get("expectedTickrate", EXPECTED_TICKRATE)),
            parser=str(raw.get("parser", "demoparser2")),
            parser_version=str(raw.get("parserVersion", EXPECTED_PARSER_VERSION)),
            selection_evidence=str(
                raw.get(
                    "selectionEvidence",
                    "configured map + verified roster + parser round/time anchors",
                )
            ),
            warning_remaining_seconds=float(raw.get("warningRemainingSeconds", 10.0)),
            require_warning_anchor=bool(raw.get("requireWarningAnchor", False)),
            validate_roster_team_numbers=bool(raw.get("validateRosterTeamNumbers", False)),
            render=dict(raw["render"]) if isinstance(raw.get("render"), Mapping) else None,
        )


LITE2_EXTRACTION_SPEC = ExtractionSpec(
    map_name=SUPPORTED_MAP,
    match="G2 vs Team Spirit",
    map_asset="/maps/Lite2_Map.png",
    overview=MIRAGE_OVERVIEW,
    team_by_name=EXPECTED_PLAYER_TEAMS,
    team_numbers=EXPECTED_TEAM_NUMBERS,
    target_round=EXPECTED_ROUND,
    target_remaining_seconds=EXPECTED_REMAINING_SECONDS,
    expected_score=EXPECTED_SCORE,
    selection_evidence="de_mirage header + exact verified roster + Round 34 score/time anchors",
    require_warning_anchor=True,
    validate_roster_team_numbers=True,
)


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    try:
        comparison = value != value
        return bool(comparison)
    except (TypeError, ValueError):
        return False


def _to_python(value: Any) -> Any:
    item = getattr(value, "item", None)
    if callable(item):
        try:
            return item()
        except (TypeError, ValueError):
            return value
    return value


def _require_finite(value: Any, field: str) -> float:
    value = _to_python(value)
    if isinstance(value, bool) or _is_missing(value):
        raise DemoCompatibilityError(f"missing numeric field: {field}")
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise DemoCompatibilityError(f"invalid numeric field: {field}") from exc
    if not math.isfinite(number):
        raise DemoCompatibilityError(f"non-finite numeric field: {field}")
    return number


def _optional_string(value: Any) -> str | None:
    value = _to_python(value)
    if _is_missing(value):
        return None
    return str(value)


def _record_value(row: Mapping[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in row and not _is_missing(row[key]):
            return row[key]
    return None


def _frame_records(frame: Any) -> list[dict[str, Any]]:
    if frame is None:
        return []
    to_dict = getattr(frame, "to_dict", None)
    if callable(to_dict):
        return [dict(record) for record in to_dict(orient="records")]
    return [dict(record) for record in frame]


def _string_id(value: Any, field: str) -> str:
    value = _to_python(value)
    if _is_missing(value):
        raise DemoCompatibilityError(f"missing stable identity field: {field}")
    identity = str(value)
    if not identity:
        raise DemoCompatibilityError(f"empty stable identity field: {field}")
    return identity


def validate_demo_header(
    header: Mapping[str, Any],
    *,
    expected_map: str = SUPPORTED_MAP,
) -> None:
    if header.get("map_name") != expected_map:
        raise DemoCompatibilityError(
            f"unsupported demo map: expected {expected_map}, got {header.get('map_name')!r}"
        )


def select_round_boundary(
    boundaries: Sequence[RoundBoundary],
    human_round: int,
) -> RoundBoundary:
    matches = [boundary for boundary in boundaries if boundary.human_round == human_round]
    if len(matches) != 1:
        raise DemoCompatibilityError(
            f"target human round {human_round} is not uniquely present "
            f"(matches={len(matches)})"
        )
    return matches[0]


def infer_tickrate(
    game_time_samples: Sequence[tuple[int, float]],
    expected_tickrate: float = EXPECTED_TICKRATE,
) -> float:
    if len(game_time_samples) < 2:
        raise DemoCompatibilityError("at least two game-time samples are required")
    samples = sorted((int(tick), float(game_time)) for tick, game_time in game_time_samples)
    rates: list[float] = []
    for (previous_tick, previous_time), (tick, game_time) in zip(samples, samples[1:]):
        tick_delta = tick - previous_tick
        time_delta = game_time - previous_time
        if tick_delta <= 0 or time_delta <= 0:
            raise DemoCompatibilityError("game-time samples are not strictly increasing")
        rates.append(tick_delta / time_delta)
    inferred = sum(rates) / len(rates)
    if any(abs(rate - inferred) > 0.01 for rate in rates):
        raise DemoCompatibilityError(f"inconsistent tick rate samples: {rates!r}")
    if abs(inferred - expected_tickrate) > 0.05:
        raise DemoCompatibilityError(
            f"unsupported tick rate: expected {expected_tickrate}, got {inferred}"
        )
    return expected_tickrate


def select_target_tick(
    boundary: RoundBoundary,
    remaining_seconds: float | None,
    tickrate: float,
    *,
    elapsed_seconds: float | None = None,
) -> int:
    rate = _require_finite(tickrate, "tickrate")
    duration = _require_finite(boundary.round_duration_seconds, "round_duration_seconds")
    if rate <= 0 or (remaining_seconds is None) == (elapsed_seconds is None):
        raise DemoCompatibilityError(
            "target requires exactly one of remaining_seconds or elapsed_seconds"
        )
    if elapsed_seconds is None:
        remaining = _require_finite(remaining_seconds, "remaining_seconds")
        if remaining < 0 or remaining > duration:
            raise DemoCompatibilityError(
                "target round-clock time is outside the round duration"
            )
        elapsed = duration - remaining
    else:
        elapsed = _require_finite(elapsed_seconds, "elapsed_seconds")
        if elapsed < 0:
            raise DemoCompatibilityError("target elapsed time cannot be negative")
    return int(round(boundary.freeze_end_tick + elapsed * rate))


def validate_time_identity(
    boundary: RoundBoundary,
    target_tick: int,
    target_game_time: float,
    remaining_seconds: float | None,
    tickrate: float,
    *,
    elapsed_seconds: float | None = None,
    warning_tick: int | None = None,
    warning_game_time: float | None = None,
    warning_remaining_seconds: float = 10.0,
    tolerance: float = 0.02,
) -> None:
    target_time = _require_finite(target_game_time, "target_game_time")
    rate = _require_finite(tickrate, "tickrate")
    expected_game_time = boundary.round_start_game_time + (
        target_tick - boundary.freeze_end_tick
    ) / rate
    if abs(target_time - expected_game_time) > tolerance:
        raise DemoCompatibilityError(
            f"target tick/game-time mismatch: tick={target_tick}, "
            f"expected={expected_game_time}, actual={target_time}"
        )
    actual_elapsed = target_time - boundary.round_start_game_time
    if (remaining_seconds is None) == (elapsed_seconds is None):
        raise DemoCompatibilityError(
            "target requires exactly one of remaining_seconds or elapsed_seconds"
        )
    if elapsed_seconds is not None:
        expected_elapsed = _require_finite(elapsed_seconds, "elapsed_seconds")
        if abs(actual_elapsed - expected_elapsed) > tolerance:
            raise DemoCompatibilityError(
                f"target elapsed-time mismatch: expected={expected_elapsed}, actual={actual_elapsed}"
            )
    else:
        remaining = _require_finite(remaining_seconds, "remaining_seconds")
        actual_remaining = boundary.round_duration_seconds - actual_elapsed
        if abs(actual_remaining - remaining) > tolerance:
            raise DemoCompatibilityError(
                f"target round-clock mismatch: expected={remaining}, actual={actual_remaining}"
            )
    if (warning_tick is None) != (warning_game_time is None):
        raise DemoCompatibilityError("warning tick and warning game time must be provided together")
    if warning_tick is not None and warning_game_time is not None:
        if warning_tick > target_tick:
            raise DemoCompatibilityError(
                "round-time warning occurs after the target and is not known at that moment"
            )
        warning_time = _require_finite(warning_game_time, "warning_game_time")
        expected_warning_time = boundary.round_start_game_time + (
            warning_tick - boundary.freeze_end_tick
        ) / rate
        if abs(warning_time - expected_warning_time) > tolerance:
            raise DemoCompatibilityError("round-time warning anchor disagrees with tick rate")
        warning_remaining = boundary.round_duration_seconds - (
            warning_time - boundary.round_start_game_time
        )
        if abs(warning_remaining - warning_remaining_seconds) > 0.1:
            raise DemoCompatibilityError(
                f"unexpected round-time warning anchor: remaining={warning_remaining}"
            )


def normalize_player_row(
    row: Mapping[str, Any],
    team_by_player_id: Mapping[str, str],
    *,
    team_numbers: Mapping[str, int] | None = EXPECTED_TEAM_NUMBERS,
) -> dict[str, Any]:
    player_id = _string_id(
        _record_value(row, "player_steamid", "steamid"),
        "player_steamid",
    )
    name_value = _record_value(row, "player_name", "name")
    if _is_missing(name_value):
        raise DemoCompatibilityError(f"missing player name for {player_id}")
    name = str(_to_python(name_value))
    if player_id not in team_by_player_id:
        raise DemoCompatibilityError(f"player identity is not in the verified roster: {name}")
    team = team_by_player_id[player_id]
    if team_numbers is not None and team not in team_numbers:
        raise DemoCompatibilityError(f"unsupported team mapping for {name}: {team}")
    team_number = int(_require_finite(_record_value(row, "team_num"), "team_num"))
    if team_numbers is not None:
        expected_team_number = team_numbers[team]
        if team_number != expected_team_number:
            raise DemoCompatibilityError(
                f"team identity mismatch for {name}: expected {expected_team_number}, got {team_number}"
            )
    health = int(_require_finite(_record_value(row, "health"), "health"))
    if health < 0 or health > 100:
        raise DemoCompatibilityError(f"invalid player health for {name}: {health}")
    alive_value = _record_value(row, "is_alive")
    if _is_missing(alive_value):
        raise DemoCompatibilityError(f"missing is_alive for {name}")
    alive = bool(_to_python(alive_value))
    world_position = {
        "x": _require_finite(_record_value(row, "X"), f"X for {name}"),
        "y": _require_finite(_record_value(row, "Y"), f"Y for {name}"),
        "z": _require_finite(_record_value(row, "Z"), f"Z for {name}"),
    }
    weapon = _optional_string(_record_value(row, "active_weapon_name"))
    place = _optional_string(_record_value(row, "last_place_name"))
    side_by_team_number = {3: "CT", 2: "T"}
    if team_number not in side_by_team_number:
        raise DemoCompatibilityError(f"unsupported CS2 team_num for {name}: {team_number}")
    return {
        "id": player_id,
        "name": name,
        "team": team,
        "side": side_by_team_number[team_number],
        "alive": alive,
        "health": health,
        "weapon": weapon,
        "worldPosition": world_position,
        "place": place,
    }


def normalize_player_rows(
    rows: Sequence[Mapping[str, Any]],
    team_by_player_id: Mapping[str, str],
    *,
    expected_count: int = EXPECTED_PLAYER_COUNT,
    team_numbers: Mapping[str, int] | None = EXPECTED_TEAM_NUMBERS,
) -> list[dict[str, Any]]:
    normalized = [
        normalize_player_row(row, team_by_player_id, team_numbers=team_numbers)
        for row in rows
    ]
    if len(normalized) != expected_count:
        raise DemoCompatibilityError(
            f"expected {expected_count} player rows at target tick, got {len(normalized)}"
        )
    ids = [player["id"] for player in normalized]
    if len(set(ids)) != len(ids):
        raise DemoCompatibilityError("duplicate stable player identity at target tick")
    side_counts = {side: sum(player["side"] == side for player in normalized) for side in ("CT", "T")}
    if side_counts != {"CT": 5, "T": 5}:
        raise DemoCompatibilityError(f"target is not a 5v5 state: {side_counts}")
    return sorted(normalized, key=lambda player: (player["team"], player["id"]))


def infer_team_by_side(
    rows: Sequence[Mapping[str, Any]],
    team_by_player_id: Mapping[str, str],
) -> dict[str, str]:
    """Resolve the side-to-team mapping at the selected target tick.

    CS2 team numbers describe the current side, so they can change after a
    half switch. The verified roster supplies identity; target rows supply the
    side at the exact decision moment.
    """

    side_by_team_number = {3: "CT", 2: "T"}
    team_by_side: dict[str, str] = {}
    for row in rows:
        player_id = _string_id(
            _record_value(row, "player_steamid", "steamid"),
            "player_steamid",
        )
        if player_id not in team_by_player_id:
            raise DemoCompatibilityError(
                f"target player identity is not in the verified roster: {player_id}"
            )
        team_number = int(_require_finite(_record_value(row, "team_num"), "team_num"))
        side = side_by_team_number.get(team_number)
        if side is None:
            raise DemoCompatibilityError(f"unsupported CS2 team_num at target tick: {team_number}")
        team = team_by_player_id[player_id]
        previous_team = team_by_side.get(side)
        if previous_team is not None and previous_team != team:
            raise DemoCompatibilityError(
                f"target rows disagree about team on side {side}: {previous_team} vs {team}"
            )
        team_by_side[side] = team

    if set(team_by_side) != {"CT", "T"} or len(set(team_by_side.values())) != 2:
        raise DemoCompatibilityError("could not resolve two teams at the target tick")
    return team_by_side


def fold_bomb_events(events: Iterable[Mapping[str, Any]], target_tick: int) -> dict[str, Any]:
    ordered_events = []
    for event in events:
        tick_value = _record_value(event, "tick")
        if _is_missing(tick_value):
            continue
        tick = int(_require_finite(tick_value, "bomb event tick"))
        if tick <= target_tick:
            ordered_events.append((tick, event))
    ordered_events.sort(key=lambda item: item[0])
    state: dict[str, Any] = {
        "status": "unavailable",
        "carrierId": None,
        "carrierName": None,
        "derivedFrom": "no reliable bomb event before target tick",
    }
    for tick, event in ordered_events:
        event_name_value = _record_value(event, "event", "eventName")
        event_name = str(event_name_value or "")
        if event_name == "bomb_pickup":
            state.update(
                {
                    "status": "carried",
                    "carrierId": _optional_string(_record_value(event, "playerId", "user_steamid")),
                    "carrierName": _optional_string(_record_value(event, "playerName", "user_name")),
                    "derivedFrom": f"event fold through tick {tick}: bomb_pickup/bomb_dropped",
                }
            )
        elif event_name == "bomb_dropped":
            state.update(
                {
                    "status": "dropped",
                    "carrierId": None,
                    "carrierName": None,
                    "derivedFrom": f"event fold through tick {tick}: bomb_dropped",
                }
            )
        elif event_name == "bomb_planted":
            state.update(
                {
                    "status": "planted",
                    "carrierId": None,
                    "carrierName": None,
                    "derivedFrom": f"event fold through tick {tick}: bomb_planted",
                }
            )
        elif event_name == "bomb_defused":
            state.update(
                {
                    "status": "defused",
                    "carrierId": None,
                    "carrierName": None,
                    "derivedFrom": f"event fold through tick {tick}: bomb_defused",
                }
            )
        elif event_name == "bomb_exploded":
            state.update(
                {
                    "status": "exploded",
                    "carrierId": None,
                    "carrierName": None,
                    "derivedFrom": f"event fold through tick {tick}: bomb_exploded",
                }
            )
    return state


def serialize_deterministic(payload: Mapping[str, Any]) -> str:
    return json.dumps(
        payload,
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
        allow_nan=False,
    ) + "\n"


def _validate_roster(
    player_info: Any,
    expected_player_teams: Mapping[str, str] = EXPECTED_PLAYER_TEAMS,
    team_numbers: Mapping[str, int] = EXPECTED_TEAM_NUMBERS,
    *,
    validate_team_numbers: bool = True,
) -> dict[str, str]:
    records = _frame_records(player_info)
    if len(records) != len(expected_player_teams):
        raise DemoCompatibilityError(
            f"verified target roster must contain {len(expected_player_teams)} players, got {len(records)}"
        )
    actual_names: set[str] = set()
    team_by_player_id: dict[str, str] = {}
    for row in records:
        name_value = _record_value(row, "name", "player_name")
        if _is_missing(name_value):
            raise DemoCompatibilityError("roster row is missing player name")
        name = str(_to_python(name_value))
        if name not in expected_player_teams:
            raise DemoCompatibilityError(f"unexpected player in target roster: {name}")
        if name in actual_names:
            raise DemoCompatibilityError(f"duplicate player name in target roster: {name}")
        actual_names.add(name)
        player_id = _string_id(_record_value(row, "steamid", "player_steamid"), "steamid")
        team_number = int(_require_finite(_record_value(row, "team_number", "team_num"), "team_number"))
        expected_team = expected_player_teams[name]
        if validate_team_numbers and expected_team not in team_numbers:
            raise DemoCompatibilityError(f"unsupported configured team for {name}: {expected_team}")
        if validate_team_numbers and team_number != team_numbers[expected_team]:
            raise DemoCompatibilityError(
                f"roster team mismatch for {name}: expected {team_numbers[expected_team]}, "
                f"got {team_number}"
            )
        team_by_player_id[player_id] = expected_team
    if actual_names != set(expected_player_teams):
        raise DemoCompatibilityError("target roster does not match the configured verified roster")
    return team_by_player_id


def _score_from_records(
    records: Sequence[Mapping[str, Any]],
    team_by_side: Mapping[str, str] | None = None,
) -> dict[str, int]:
    configured_team_by_side = team_by_side or {"CT": "G2", "T": "Team Spirit"}
    score: dict[str, int] = {}
    for row in records:
        team_name_value = _record_value(row, "team_name")
        rounds_value = _record_value(row, "team_rounds_total")
        if _is_missing(team_name_value) or _is_missing(rounds_value):
            continue
        team_name = str(_to_python(team_name_value))
        if team_name == "CT":
            team = configured_team_by_side.get("CT")
        elif team_name in {"TERRORIST", "T"}:
            team = configured_team_by_side.get("T")
        else:
            team = None
        if team is not None:
            score[team] = int(_require_finite(rounds_value, "team_rounds_total"))
    if set(score) != set(configured_team_by_side.values()):
        raise DemoCompatibilityError(f"could not resolve both team scores: {score!r}")
    return score


def _first_record_per_tick(records: Sequence[Mapping[str, Any]]) -> dict[int, dict[str, Any]]:
    per_tick: dict[int, dict[str, Any]] = {}
    for row in records:
        tick_value = _record_value(row, "tick")
        if _is_missing(tick_value):
            continue
        tick = int(_require_finite(tick_value, "tick"))
        per_tick.setdefault(tick, dict(row))
    return per_tick


def _parse_boundaries(
    parser: Any,
    team_by_side: Mapping[str, str] | None = None,
) -> list[RoundBoundary]:
    freeze_end_records = _frame_records(parser.parse_event("round_freeze_end"))
    freeze_end_ticks = sorted(
        {
            int(_require_finite(_record_value(row, "tick"), "round_freeze_end tick"))
            for row in freeze_end_records
        }
    )
    if not freeze_end_ticks:
        raise DemoCompatibilityError("demo contains no round_freeze_end boundaries")
    wanted_fields = list(dict.fromkeys(GAME_RULE_FIELDS))
    records = _frame_records(parser.parse_ticks(wanted_fields, ticks=freeze_end_ticks))
    grouped: dict[int, list[dict[str, Any]]] = {tick: [] for tick in freeze_end_ticks}
    for row in records:
        tick_value = _record_value(row, "tick")
        if _is_missing(tick_value):
            continue
        tick = int(_require_finite(tick_value, "round boundary row tick"))
        if tick in grouped:
            grouped[tick].append(row)
    boundaries: list[RoundBoundary] = []
    for tick in freeze_end_ticks:
        rows = grouped[tick]
        if not rows:
            raise DemoCompatibilityError(f"round boundary tick has no game state rows: {tick}")
        first = rows[0]
        parser_round = int(_require_finite(_record_value(first, "total_rounds_played"), "total_rounds_played"))
        round_start_game_time = _require_finite(
            _record_value(first, "round_start_time", "game_time"),
            "round_start_time",
        )
        round_duration = _require_finite(
            _record_value(first, "CCSGameRulesProxy.CCSGameRules.m_iRoundTime"),
            "m_iRoundTime",
        )
        boundaries.append(
            RoundBoundary(
                parser_round=parser_round,
                human_round=parser_round + 1,
                freeze_end_tick=tick,
                round_start_game_time=round_start_game_time,
                round_duration_seconds=round_duration,
                score=_score_from_records(rows, team_by_side),
            )
        )
    human_rounds = [boundary.human_round for boundary in boundaries]
    if len(set(human_rounds)) != len(human_rounds):
        raise DemoCompatibilityError("duplicate human round identity in parsed boundaries")
    return boundaries


def _game_time_samples(parser: Any, boundary: RoundBoundary) -> list[tuple[int, float]]:
    ticks = [boundary.freeze_end_tick, boundary.freeze_end_tick + 1, boundary.freeze_end_tick + 2]
    records = _frame_records(parser.parse_ticks(["game_time"], ticks=ticks))
    per_tick = _first_record_per_tick(records)
    samples: list[tuple[int, float]] = []
    for tick in ticks:
        if tick not in per_tick:
            raise DemoCompatibilityError(f"game-time sample is unavailable at tick {tick}")
        samples.append((tick, _require_finite(_record_value(per_tick[tick], "game_time"), "game_time")))
    return samples


def _event_records(parser: Any, event_names: Sequence[str]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for event_name in event_names:
        for row in _frame_records(parser.parse_event(event_name)):
            tick_value = _record_value(row, "tick")
            if _is_missing(tick_value):
                continue
            records.append(
                {
                    "tick": int(_require_finite(tick_value, "event tick")),
                    "event": event_name,
                    "playerId": _optional_string(_record_value(row, "user_steamid")),
                    "playerName": _optional_string(_record_value(row, "user_name")),
                }
            )
    return records


def _round_end_ticks(parser: Any) -> list[int]:
    return sorted(
        {
            int(_require_finite(_record_value(row, "tick"), "round_end tick"))
            for row in _frame_records(parser.parse_event("round_end"))
            if not _is_missing(_record_value(row, "tick"))
        }
    )


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def _load_parser(
    demo_path: Path,
    *,
    expected_map: str = SUPPORTED_MAP,
    expected_parser_version: str = EXPECTED_PARSER_VERSION,
) -> tuple[Any, Mapping[str, Any], str]:
    if not demo_path.is_file() or demo_path.suffix.lower() != ".dem":
        raise DemoCompatibilityError(f"real .dem asset is unavailable: {demo_path}")
    try:
        from demoparser2 import DemoParser
    except ImportError as exc:
        raise DemoCompatibilityError(
            "demoparser2 is unavailable; install tools/gate1_demopipeline/requirements.txt"
        ) from exc
    try:
        parser_version = importlib.metadata.version("demoparser2")
    except importlib.metadata.PackageNotFoundError as exc:
        raise DemoCompatibilityError("demoparser2 package metadata is unavailable") from exc
    if parser_version != expected_parser_version:
        raise DemoCompatibilityError(
            f"unsupported demoparser2 version: expected {expected_parser_version}, got {parser_version}"
        )
    try:
        parser = DemoParser(str(demo_path))
        header = parser.parse_header()
        validate_demo_header(header, expected_map=expected_map)
    except DemoCompatibilityError:
        raise
    except Exception as exc:  # demoparser2 exposes parser-specific exceptions
        raise DemoCompatibilityError(f"demoparser2 could not parse {demo_path.name}: {exc}") from exc
    return parser, header, parser_version


def inspect_round_range(
    demo_path: Path,
    spec: ExtractionSpec | None = None,
) -> dict[str, Any]:
    selected_spec = spec or LITE2_EXTRACTION_SPEC
    parser, header, parser_version = _load_parser(
        demo_path,
        expected_map=selected_spec.map_name,
        expected_parser_version=selected_spec.parser_version,
    )
    boundaries = _parse_boundaries(parser, {"CT": "CT", "T": "T"})
    return {
        "file": demo_path.name,
        "sha256": _sha256(demo_path),
        "map": header["map_name"],
        "parserVersion": parser_version,
        "firstHumanRound": boundaries[0].human_round,
        "lastHumanRound": boundaries[-1].human_round,
        "roundCount": len(boundaries),
    }


def format_round_clock(seconds: float) -> str:
    total_seconds = int(round(_require_finite(seconds, "remaining_seconds")))
    if total_seconds < 0:
        raise DemoCompatibilityError("remaining_seconds cannot be negative")
    return f"{total_seconds // 60}:{total_seconds % 60:02d}"


def build_time_snapshot(
    boundary: RoundBoundary,
    *,
    target_tick: int,
    target_game_time: float,
    tickrate: float,
    bomb_status: str,
    bomb_plant_tick: int | None,
    warning_tick: int | None = None,
    warning_game_time: float | None = None,
) -> dict[str, Any]:
    """Describe the target time without treating post-plant time as round clock."""

    target_time = _require_finite(target_game_time, "target_game_time")
    rate = _require_finite(tickrate, "tickrate")
    elapsed = target_time - boundary.round_start_game_time
    if rate <= 0 or elapsed < -0.02:
        raise DemoCompatibilityError("target game time is before the round boundary")
    if (warning_tick is None) != (warning_game_time is None):
        raise DemoCompatibilityError("warning tick and warning game time must be provided together")
    if warning_tick is not None and warning_tick > target_tick:
        raise DemoCompatibilityError(
            "round-time warning occurs after the target and is not known at that moment"
        )

    payload: dict[str, Any] = {
        "elapsedSeconds": elapsed,
        "roundDurationSeconds": boundary.round_duration_seconds,
        "roundStartTick": boundary.freeze_end_tick,
        "roundStartGameTime": boundary.round_start_game_time,
        "gameTime": target_time,
        "tickrate": rate,
        "warningTick": warning_tick,
        "warningGameTime": warning_game_time,
    }
    if bomb_status == "planted":
        if bomb_plant_tick is None or bomb_plant_tick > target_tick:
            raise DemoCompatibilityError(
                "a post-plant target requires a bomb_planted event at or before the target"
            )
        post_plant_elapsed = (target_tick - bomb_plant_tick) / rate
        if post_plant_elapsed < 0:
            raise DemoCompatibilityError("post-plant elapsed time cannot be negative")
        payload.update(
            {
                "display": f"post-plant · {post_plant_elapsed:.1f}s since plant",
                "semantics": "post_plant_elapsed",
                "remainingSeconds": None,
                "postPlantElapsedSeconds": post_plant_elapsed,
            }
        )
        return payload

    round_clock_remaining = boundary.round_duration_seconds - elapsed
    if round_clock_remaining < -0.02:
        raise DemoCompatibilityError(
            "a non-post-plant target is outside the trusted round-clock interval"
        )
    payload.update(
        {
            "display": format_round_clock(round_clock_remaining),
            "semantics": "round_clock_remaining",
            "remainingSeconds": max(0.0, round_clock_remaining),
            "postPlantElapsedSeconds": None,
        }
    )
    return payload


def build_extraction_provenance(
    *,
    warning_available: bool,
    bomb_events_available: bool,
    post_plant: bool,
) -> dict[str, list[str]]:
    """Keep field availability and derivation claims synchronized."""

    available_fields = [
        "header.map_name",
        "player_steamid/player_name",
        "team_num",
        "X/Y/Z",
        "health",
        "is_alive",
        "active_weapon_name",
        "last_place_name",
        "round_freeze_end",
        "round_start_time",
        "game_time",
        "m_iRoundTime at round_freeze_end (nominal round duration)",
        "team_rounds_total/team_name",
    ]
    if bomb_events_available:
        available_fields.append("bomb_pickup/bomb_dropped/bomb_planted events at or before target")
    if warning_available:
        available_fields.append("round_time_warning at or before target")

    unavailable_fields = [
        "authoritative aggregate alive counters at the target snapshot",
        "round_in_progress at the target snapshot",
        "team organization metadata from the demo header",
    ]
    if not bomb_events_available:
        unavailable_fields.append("bomb events at or before the target tick")
    if not warning_available:
        unavailable_fields.append("round_time_warning at or before the target tick")
    if post_plant:
        unavailable_fields.append("round_clock_remaining at the target after bomb plant")

    target_tick_derivation = "target tick from round_start_time/game_time and inferred tick/s"
    if warning_available:
        target_tick_derivation += "; round-time warning is an independent anchor observed at or before target"
    derived_fields = [
        "team name from the explicitly verified roster in the extraction spec",
        "side from demoparser2 team_num (3=CT, 2=T)",
        "alive player count from the ten per-player is_alive rows",
        target_tick_derivation,
    ]
    if bomb_events_available:
        derived_fields.append(
            "bomb state from the ordered bomb pickup/drop/plant event fold through the target tick"
        )
    if post_plant:
        derived_fields.append(
            "post-plant elapsed time from bomb_planted event tick and target game_time/tickrate"
        )
    derived_fields.append("0..100 position from the configured map overview metadata")
    return {
        "availableFields": available_fields,
        "unavailableFields": unavailable_fields,
        "derivedFields": derived_fields,
    }


def last_bomb_event_tick(
    events: Sequence[Mapping[str, Any]],
    target_tick: int,
    event_name: str,
) -> int | None:
    ticks = [
        int(_require_finite(_record_value(event, "tick"), "bomb event tick"))
        for event in events
        if _record_value(event, "event", "eventName") == event_name
        and int(_require_finite(_record_value(event, "tick"), "bomb event tick")) <= target_tick
    ]
    return max(ticks) if ticks else None


def extract_demo(
    demo_path: Path,
    output_path: Path,
    spec: ExtractionSpec,
) -> dict[str, Any]:
    if spec.parser != "demoparser2":
        raise DemoCompatibilityError(f"unsupported parser adapter: {spec.parser}")
    parser, header, parser_version = _load_parser(
        demo_path,
        expected_map=spec.map_name,
        expected_parser_version=spec.parser_version,
    )
    team_by_player_id = _validate_roster(
        parser.parse_player_info(),
        spec.team_by_name,
        spec.team_numbers,
        validate_team_numbers=spec.validate_roster_team_numbers,
    )
    # Boundary scores are initially keyed by the side visible in the demo.
    # The selected target rows resolve the real team identity after a half
    # switch, so no fixed G2/Spirit side assumption is needed here.
    boundaries = _parse_boundaries(parser, {"CT": "CT", "T": "T"})
    boundary = select_round_boundary(boundaries, spec.target_round)
    tickrate = infer_tickrate(
        _game_time_samples(parser, boundary),
        expected_tickrate=spec.expected_tickrate,
    )
    target_tick = select_target_tick(
        boundary,
        spec.target_remaining_seconds,
        tickrate,
        elapsed_seconds=spec.target_elapsed_seconds,
    )

    next_boundaries = [item for item in boundaries if item.freeze_end_tick > boundary.freeze_end_tick]
    next_boundary_tick = next_boundaries[0].freeze_end_tick if next_boundaries else target_tick + 1
    round_end_ticks = [
        tick
        for tick in _round_end_ticks(parser)
        if boundary.freeze_end_tick <= tick < next_boundary_tick
    ]
    if round_end_ticks and target_tick >= round_end_ticks[0]:
        raise DemoCompatibilityError(
            f"target tick {target_tick} is after the selected round ended at tick {round_end_ticks[0]}"
        )
    round_warning_events = [
        event
        for event in _frame_records(parser.parse_event("round_time_warning"))
        if boundary.freeze_end_tick <= int(_require_finite(_record_value(event, "tick"), "warning tick")) < next_boundary_tick
    ]
    if len(round_warning_events) > 1:
        raise DemoCompatibilityError(
            f"expected at most one Round {spec.target_round} time-warning anchor, got {len(round_warning_events)}"
        )
    if not round_warning_events and spec.require_warning_anchor:
        raise DemoCompatibilityError(
            f"expected one Round {spec.target_round} time-warning anchor, got 0"
        )
    warning_events = [
        event
        for event in round_warning_events
        if int(_require_finite(_record_value(event, "tick"), "warning tick")) <= target_tick
    ]
    warning_tick: int | None = None
    warning_game_time: float | None = None
    if warning_events:
        warning_tick = int(_require_finite(_record_value(warning_events[0], "tick"), "warning tick"))
        warning_records = _frame_records(parser.parse_ticks(["game_time"], ticks=[warning_tick]))
        warning_per_tick = _first_record_per_tick(warning_records)
        if warning_tick not in warning_per_tick:
            raise DemoCompatibilityError("round-time warning game time is unavailable")
        warning_game_time = _require_finite(
            _record_value(warning_per_tick[warning_tick], "game_time"),
            "warning game_time",
        )
    wanted_fields = list(dict.fromkeys(PLAYER_FIELDS + GAME_RULE_FIELDS))
    target_records = _frame_records(parser.parse_ticks(wanted_fields, ticks=[target_tick]))
    players = normalize_player_rows(
        target_records,
        team_by_player_id,
        expected_count=spec.expected_player_count,
        team_numbers=spec.team_numbers if spec.validate_roster_team_numbers else None,
    )
    target_time_values = [
        _require_finite(_record_value(row, "game_time"), "target game_time") for row in target_records
    ]
    if not target_time_values:
        raise DemoCompatibilityError("target tick has no player state rows")
    target_game_time = target_time_values[0]
    if any(abs(value - target_game_time) > 0.001 for value in target_time_values):
        raise DemoCompatibilityError("target player rows disagree about game time")
    validate_time_identity(
        boundary,
        target_tick,
        target_game_time,
        spec.target_remaining_seconds,
        tickrate,
        elapsed_seconds=spec.target_elapsed_seconds,
        warning_tick=warning_tick,
        warning_game_time=warning_game_time,
        warning_remaining_seconds=spec.warning_remaining_seconds,
    )
    target_team_by_side = infer_team_by_side(target_records, team_by_player_id)
    target_score = _score_from_records(target_records, target_team_by_side)
    boundary_score = {
        target_team_by_side[side]: boundary.score[side]
        for side in ("CT", "T")
    }
    if target_score != boundary_score:
        raise DemoCompatibilityError(
            f"target score disagrees with the selected round boundary: {target_score!r} vs {boundary_score!r}"
        )
    if spec.expected_score is not None and target_score != spec.expected_score:
        raise DemoCompatibilityError(
            f"target score does not match the configured expected score: {target_score!r}"
        )
    target_round_values = {
        int(_require_finite(_record_value(row, "total_rounds_played"), "total_rounds_played"))
        for row in target_records
    }
    if target_round_values != {boundary.parser_round}:
        raise DemoCompatibilityError(
            f"target tick is not inside parser round {boundary.parser_round}: {target_round_values!r}"
        )

    bomb_events = [
        event
        for event in _event_records(parser, BOMB_EVENT_NAMES)
        if boundary.freeze_end_tick <= event["tick"] < next_boundary_tick
    ]
    target_bomb_events = [event for event in bomb_events if event["tick"] <= target_tick]
    bomb = fold_bomb_events(bomb_events, target_tick)
    first_target_record = target_records[0]
    bomb["rawState"] = {
        "isPlanted": bool(_to_python(_record_value(first_target_record, "is_bomb_planted")))
        if not _is_missing(_record_value(first_target_record, "is_bomb_planted"))
        else None,
        "isDropped": bool(_to_python(_record_value(first_target_record, "is_bomb_dropped")))
        if not _is_missing(_record_value(first_target_record, "is_bomb_dropped"))
        else None,
    }
    bomb_plant_tick = last_bomb_event_tick(bomb_events, target_tick, "bomb_planted")
    time_payload = build_time_snapshot(
        boundary,
        target_tick=target_tick,
        target_game_time=target_game_time,
        tickrate=tickrate,
        bomb_status=str(bomb["status"]),
        bomb_plant_tick=bomb_plant_tick,
        warning_tick=warning_tick,
        warning_game_time=warning_game_time,
    )
    provenance = build_extraction_provenance(
        warning_available=warning_tick is not None,
        bomb_events_available=bool(target_bomb_events),
        post_plant=bomb["status"] == "planted",
    )

    map_payload: dict[str, Any] = {
        "name": spec.map_name,
        "asset": spec.map_asset,
        "overview": spec.overview,
    }
    if spec.render is not None:
        map_payload["render"] = spec.render

    payload = {
        "schemaVersion": 1,
        "source": {
            "kind": "offline-demo",
            "demoFile": demo_path.name,
            "demoSha256": _sha256(demo_path),
            "match": spec.match,
            "parser": spec.parser,
            "parserVersion": parser_version,
            "demoVersion": header.get("demo_version_name"),
            "patchVersion": header.get("patch_version"),
            "selectionEvidence": spec.selection_evidence,
        },
        "map": map_payload,
        "round": {
            "number": boundary.human_round,
            "parserRound": boundary.parser_round,
            "boundaryTick": boundary.freeze_end_tick,
            "score": target_score,
        },
        "tick": target_tick,
        "time": time_payload,
        "players": players,
        "bomb": bomb,
        "extraction": {
            "verificationStatus": "draft",
            "humanQaRequired": True,
            "roundNumberBasis": "human round = demoparser2 total_rounds_played + 1 at round_freeze_end",
            "availableFields": provenance["availableFields"],
            "unavailableFields": provenance["unavailableFields"],
            "derivedFields": provenance["derivedFields"],
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(serialize_deterministic(payload), encoding="utf-8")
    return payload


def extract_lite2_demo(
    demo_path: Path,
    output_path: Path,
    *,
    human_round: int = EXPECTED_ROUND,
    remaining_seconds: float = EXPECTED_REMAINING_SECONDS,
) -> dict[str, Any]:
    """Gate 1 compatibility adapter over the configurable extractor."""

    return extract_demo(
        demo_path,
        output_path,
        replace(
            LITE2_EXTRACTION_SPEC,
            target_round=human_round,
            target_remaining_seconds=remaining_seconds,
        ),
    )


def _build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--demo", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--inspect-rounds", action="store_true")
    parser.add_argument(
        "--spec",
        type=Path,
        help="JSON ExtractionSpec for a non-Lite2 demo; omitted for the Gate 1 adapter",
    )
    parser.add_argument("--human-round", type=int, default=EXPECTED_ROUND)
    parser.add_argument("--remaining-seconds", type=float, default=EXPECTED_REMAINING_SECONDS)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _build_argument_parser().parse_args(argv)
    try:
        spec = LITE2_EXTRACTION_SPEC
        if args.spec is not None:
            spec = ExtractionSpec.from_mapping(
                json.loads(args.spec.read_text(encoding="utf-8"))
            )
        if args.inspect_rounds:
            print(serialize_deterministic(inspect_round_range(args.demo, spec)), end="")
            return 0
        if args.output is None:
            raise DemoCompatibilityError("--output is required unless --inspect-rounds is used")
        if args.spec is None:
            payload = extract_lite2_demo(
                args.demo,
                args.output,
                human_round=args.human_round,
                remaining_seconds=args.remaining_seconds,
            )
        else:
            payload = extract_demo(args.demo, args.output, spec)
        print(
            f"extracted {payload['source']['demoFile']}: "
            f"human round {payload['round']['number']} at tick {payload['tick']} "
            f"with {len(payload['players'])} players"
        )
        return 0
    except DemoCompatibilityError as exc:
        print(f"BLOCKED: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
