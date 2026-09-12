"""Offline Gate 1 extractor for the verified G2 vs Team Spirit Mirage demo.

This module intentionally stops at one deterministic NormalizedMatchState JSON
artifact. It is not a parser service or a general replay engine.
"""

import argparse
import hashlib
import importlib.metadata
import json
import math
import sys
from dataclasses import dataclass
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
    "source": "https://github.com/CSGO-Analysis/csgo-maps-overviews/blob/master/overviews/de_mirage.txt",
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


def validate_demo_header(header: Mapping[str, Any]) -> None:
    if header.get("map_name") != SUPPORTED_MAP:
        raise DemoCompatibilityError(
            f"unsupported demo map: expected {SUPPORTED_MAP}, got {header.get('map_name')!r}"
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
    remaining_seconds: float,
    tickrate: float,
) -> int:
    remaining = _require_finite(remaining_seconds, "remaining_seconds")
    rate = _require_finite(tickrate, "tickrate")
    duration = _require_finite(boundary.round_duration_seconds, "round_duration_seconds")
    if rate <= 0 or remaining < 0 or remaining > duration:
        raise DemoCompatibilityError("target round-clock time is outside the round duration")
    elapsed = duration - remaining
    return int(round(boundary.freeze_end_tick + elapsed * rate))


def validate_time_identity(
    boundary: RoundBoundary,
    target_tick: int,
    target_game_time: float,
    remaining_seconds: float,
    tickrate: float,
    *,
    warning_tick: int | None = None,
    warning_game_time: float | None = None,
    tolerance: float = 0.02,
) -> None:
    target_time = _require_finite(target_game_time, "target_game_time")
    remaining = _require_finite(remaining_seconds, "remaining_seconds")
    rate = _require_finite(tickrate, "tickrate")
    expected_game_time = boundary.round_start_game_time + (
        target_tick - boundary.freeze_end_tick
    ) / rate
    if abs(target_time - expected_game_time) > tolerance:
        raise DemoCompatibilityError(
            f"target tick/game-time mismatch: tick={target_tick}, "
            f"expected={expected_game_time}, actual={target_time}"
        )
    actual_remaining = boundary.round_duration_seconds - (
        target_time - boundary.round_start_game_time
    )
    if abs(actual_remaining - remaining) > tolerance:
        raise DemoCompatibilityError(
            f"target round-clock mismatch: expected={remaining}, actual={actual_remaining}"
        )
    if (warning_tick is None) != (warning_game_time is None):
        raise DemoCompatibilityError("warning tick and warning game time must be provided together")
    if warning_tick is not None and warning_game_time is not None:
        warning_time = _require_finite(warning_game_time, "warning_game_time")
        expected_warning_time = boundary.round_start_game_time + (
            warning_tick - boundary.freeze_end_tick
        ) / rate
        if abs(warning_time - expected_warning_time) > tolerance:
            raise DemoCompatibilityError("round-time warning anchor disagrees with tick rate")
        warning_remaining = boundary.round_duration_seconds - (
            warning_time - boundary.round_start_game_time
        )
        if abs(warning_remaining - 10.0) > 0.1:
            raise DemoCompatibilityError(
                f"unexpected round-time warning anchor: remaining={warning_remaining}"
            )


def normalize_player_row(
    row: Mapping[str, Any],
    team_by_player_id: Mapping[str, str],
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
    if team not in EXPECTED_TEAM_NUMBERS:
        raise DemoCompatibilityError(f"unsupported team mapping for {name}: {team}")
    team_number = int(_require_finite(_record_value(row, "team_num"), "team_num"))
    expected_team_number = EXPECTED_TEAM_NUMBERS[team]
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
    return {
        "id": player_id,
        "name": name,
        "team": team,
        "side": "CT" if team_number == 3 else "T",
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
) -> list[dict[str, Any]]:
    normalized = [normalize_player_row(row, team_by_player_id) for row in rows]
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


def _validate_roster(player_info: Any) -> dict[str, str]:
    records = _frame_records(player_info)
    if len(records) != EXPECTED_PLAYER_COUNT:
        raise DemoCompatibilityError(
            f"verified target roster must contain 10 players, got {len(records)}"
        )
    actual_names: set[str] = set()
    team_by_player_id: dict[str, str] = {}
    for row in records:
        name_value = _record_value(row, "name", "player_name")
        if _is_missing(name_value):
            raise DemoCompatibilityError("roster row is missing player name")
        name = str(_to_python(name_value))
        if name not in EXPECTED_PLAYER_TEAMS:
            raise DemoCompatibilityError(f"unexpected player in target roster: {name}")
        if name in actual_names:
            raise DemoCompatibilityError(f"duplicate player name in target roster: {name}")
        actual_names.add(name)
        player_id = _string_id(_record_value(row, "steamid", "player_steamid"), "steamid")
        team_number = int(_require_finite(_record_value(row, "team_number", "team_num"), "team_number"))
        expected_team = EXPECTED_PLAYER_TEAMS[name]
        if team_number != EXPECTED_TEAM_NUMBERS[expected_team]:
            raise DemoCompatibilityError(
                f"roster team mismatch for {name}: expected {EXPECTED_TEAM_NUMBERS[expected_team]}, "
                f"got {team_number}"
            )
        team_by_player_id[player_id] = expected_team
    if actual_names != set(EXPECTED_PLAYER_TEAMS):
        raise DemoCompatibilityError("target roster does not match the verified G2/Team Spirit roster")
    return team_by_player_id


def _score_from_records(records: Sequence[Mapping[str, Any]]) -> dict[str, int]:
    score: dict[str, int] = {}
    for row in records:
        team_name_value = _record_value(row, "team_name")
        rounds_value = _record_value(row, "team_rounds_total")
        if _is_missing(team_name_value) or _is_missing(rounds_value):
            continue
        team_name = str(_to_python(team_name_value))
        if team_name == "CT":
            score["G2"] = int(_require_finite(rounds_value, "team_rounds_total"))
        elif team_name in {"TERRORIST", "T"}:
            score["Team Spirit"] = int(_require_finite(rounds_value, "team_rounds_total"))
    if set(score) != {"G2", "Team Spirit"}:
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


def _parse_boundaries(parser: Any) -> list[RoundBoundary]:
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
                score=_score_from_records(rows),
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


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def _load_parser(demo_path: Path) -> tuple[Any, Mapping[str, Any], str]:
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
    if parser_version != EXPECTED_PARSER_VERSION:
        raise DemoCompatibilityError(
            f"unsupported demoparser2 version: expected {EXPECTED_PARSER_VERSION}, got {parser_version}"
        )
    try:
        parser = DemoParser(str(demo_path))
        header = parser.parse_header()
        validate_demo_header(header)
    except DemoCompatibilityError:
        raise
    except Exception as exc:  # demoparser2 exposes parser-specific exceptions
        raise DemoCompatibilityError(f"demoparser2 could not parse {demo_path.name}: {exc}") from exc
    return parser, header, parser_version


def inspect_round_range(demo_path: Path) -> dict[str, Any]:
    parser, header, parser_version = _load_parser(demo_path)
    boundaries = _parse_boundaries(parser)
    return {
        "file": demo_path.name,
        "sha256": _sha256(demo_path),
        "map": header["map_name"],
        "parserVersion": parser_version,
        "firstHumanRound": boundaries[0].human_round,
        "lastHumanRound": boundaries[-1].human_round,
        "roundCount": len(boundaries),
    }


def extract_lite2_demo(
    demo_path: Path,
    output_path: Path,
    *,
    human_round: int = EXPECTED_ROUND,
    remaining_seconds: float = EXPECTED_REMAINING_SECONDS,
) -> dict[str, Any]:
    parser, header, parser_version = _load_parser(demo_path)
    team_by_player_id = _validate_roster(parser.parse_player_info())
    boundaries = _parse_boundaries(parser)
    boundary = select_round_boundary(boundaries, human_round)
    tickrate = infer_tickrate(_game_time_samples(parser, boundary))
    target_tick = select_target_tick(boundary, remaining_seconds, tickrate)

    next_boundaries = [item for item in boundaries if item.freeze_end_tick > boundary.freeze_end_tick]
    next_boundary_tick = next_boundaries[0].freeze_end_tick if next_boundaries else target_tick + 1
    warning_events = [
        event
        for event in _frame_records(parser.parse_event("round_time_warning"))
        if boundary.freeze_end_tick <= int(_require_finite(_record_value(event, "tick"), "warning tick")) < next_boundary_tick
    ]
    if len(warning_events) != 1:
        raise DemoCompatibilityError(
            f"expected exactly one Round {human_round} time-warning anchor, got {len(warning_events)}"
        )
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
    players = normalize_player_rows(target_records, team_by_player_id)
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
        remaining_seconds,
        tickrate,
        warning_tick=warning_tick,
        warning_game_time=warning_game_time,
    )
    target_score = _score_from_records(target_records)
    if target_score != boundary.score or target_score != EXPECTED_SCORE:
        raise DemoCompatibilityError(
            f"target score does not match the verified Lite2 state: {target_score!r}"
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

    payload = {
        "schemaVersion": 1,
        "source": {
            "kind": "offline-demo",
            "demoFile": demo_path.name,
            "demoSha256": _sha256(demo_path),
            "match": "G2 vs Team Spirit",
            "parser": "demoparser2",
            "parserVersion": parser_version,
            "demoVersion": header.get("demo_version_name"),
            "patchVersion": header.get("patch_version"),
            "selectionEvidence": "de_mirage header + exact verified roster + Round 34 score/time anchors",
        },
        "map": {
            "name": SUPPORTED_MAP,
            "asset": "/maps/Lite2_Map.png",
            "overview": MIRAGE_OVERVIEW,
        },
        "round": {
            "number": boundary.human_round,
            "parserRound": boundary.parser_round,
            "boundaryTick": boundary.freeze_end_tick,
            "score": target_score,
        },
        "tick": target_tick,
        "time": {
            "display": "0:40",
            "semantics": "round_clock_remaining",
            "remainingSeconds": float(remaining_seconds),
            "elapsedSeconds": boundary.round_duration_seconds - float(remaining_seconds),
            "roundDurationSeconds": boundary.round_duration_seconds,
            "roundStartTick": boundary.freeze_end_tick,
            "roundStartGameTime": boundary.round_start_game_time,
            "gameTime": target_game_time,
            "tickrate": tickrate,
            "warningTick": warning_tick,
            "warningGameTime": warning_game_time,
        },
        "players": players,
        "bomb": bomb,
        "extraction": {
            "verificationStatus": "draft",
            "humanQaRequired": True,
            "roundNumberBasis": "human round = demoparser2 total_rounds_played + 1 at round_freeze_end",
            "availableFields": [
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
                "m_iRoundTime",
                "team_rounds_total/team_name",
                "bomb_pickup/bomb_dropped/bomb_planted events",
                "round_time_warning",
            ],
            "unavailableFields": [
                "authoritative aggregate alive counters at the target snapshot",
                "round_in_progress at the target snapshot",
                "team organization metadata from the demo header",
            ],
            "derivedFields": [
                "team name from the explicitly verified G2/Team Spirit roster",
                "side from demoparser2 team_num (3=CT, 2=T)",
                "alive player count from the ten per-player is_alive rows",
                "target tick from round_start_time/game_time, 64 tick/s, and the round-time warning anchor",
                "bomb carrier from the ordered bomb pickup/drop event fold through the target tick",
                "0..100 position from the Mirage overview metadata",
            ],
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(serialize_deterministic(payload), encoding="utf-8")
    return payload


def _build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--demo", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--inspect-rounds", action="store_true")
    parser.add_argument("--human-round", type=int, default=EXPECTED_ROUND)
    parser.add_argument("--remaining-seconds", type=float, default=EXPECTED_REMAINING_SECONDS)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _build_argument_parser().parse_args(argv)
    try:
        if args.inspect_rounds:
            print(serialize_deterministic(inspect_round_range(args.demo)), end="")
            return 0
        if args.output is None:
            raise DemoCompatibilityError("--output is required unless --inspect-rounds is used")
        payload = extract_lite2_demo(
            args.demo,
            args.output,
            human_round=args.human_round,
            remaining_seconds=args.remaining_seconds,
        )
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
