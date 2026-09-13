"""Batch the existing offline extraction core for real content production.

This is intentionally a small filesystem CLI: no service, database, queue, or
replay engine is introduced. Each manifest entry supplies the human-verified
selection context once, while the shared demoparser2 adapter recovers the
repeatable state fields.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Mapping, Sequence


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "tools" / "gate1_demopipeline"))

from parse_lite2_demo import (  # noqa: E402
    DemoCompatibilityError,
    ExtractionSpec,
    extract_demo,
    serialize_deterministic,
)


def load_manifest(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, Mapping) or payload.get("schemaVersion") != 1:
        raise DemoCompatibilityError("content manifest schemaVersion must be 1")
    entries = payload.get("entries")
    if not isinstance(entries, list) or not entries:
        raise DemoCompatibilityError("content manifest requires at least one entry")
    if any(not isinstance(entry, Mapping) for entry in entries):
        raise DemoCompatibilityError("content manifest entries must be objects")
    return [dict(entry) for entry in entries]


def run_manifest(
    manifest_path: Path,
    demo_root: Path,
    output_dir: Path,
) -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for entry in load_manifest(manifest_path):
        demo_name = entry.get("demoFile")
        output_name = entry.get("outputFile")
        entry_id = entry.get("id")
        if not all(isinstance(value, str) and value.strip() for value in (demo_name, output_name, entry_id)):
            raise DemoCompatibilityError("each content manifest entry needs id, demoFile, and outputFile")
        demo_path = demo_root / demo_name
        output_path = output_dir / output_name
        payload = extract_demo(
            demo_path,
            output_path,
            ExtractionSpec.from_mapping(entry),
        )
        summaries.append(
            {
                "id": entry_id,
                "file": payload["source"]["demoFile"],
                "map": payload["map"]["name"],
                "round": payload["round"]["number"],
                "tick": payload["tick"],
                "players": len(payload["players"]),
                "verificationStatus": payload["extraction"]["verificationStatus"],
                "output": str(output_path),
            }
        )
    return summaries


def _build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--demo-root", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _build_argument_parser().parse_args(argv)
    try:
        summaries = run_manifest(args.manifest, args.demo_root, args.output_dir)
        print(serialize_deterministic({"entries": summaries}), end="")
        return 0
    except (DemoCompatibilityError, OSError, json.JSONDecodeError) as exc:
        print(f"BLOCKED: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
