"""Build the current-state Lite2 raster without authored overlay pixels.

This is a deterministic, one-time asset preparation step. The generated
asset keeps the supplied Lite2 silhouette, wall geometry, site colours, and
native 1448x1086 frame. It intentionally uses a simplified floor treatment
inside the five known authored marker regions instead of attempting to infer
hidden map detail from a second map source.

The original authored asset is never modified.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


DEFAULT_SOURCE = Path(__file__).parents[2] / "public" / "maps" / "Lite2_Map.png"
DEFAULT_OUTPUT = (
    Path(__file__).parents[2] / "public" / "maps" / "Lite2_CurrentStateBase.png"
)

# Centers/radii are recorded in source-raster pixels. These are the five
# authored player/C4 badges baked into the supplied Lite2 scenario image.
AUTHORED_MARKER_PATCHES = (
    (452, 131, 44),  # 6
    (1011, 395, 44),  # 0
    (1237, 617, 64),  # 8 + C4 ring
    (965, 837, 45),  # 7
    (892, 993, 45),  # 9
)
AUTHORED_LEGEND_RECT = (16, 914, 319, 1086)
# The A/B labels are map landmarks, so preserve their complete local raster
# (including the black letter) for calibration and visual orientation.
MAP_LANDMARK_RECTS = (
    (184, 186, 301, 311),  # B site label
    (675, 938, 792, 1021),  # A site label
)
MARKER_CLEANUP_MARGIN = 10


def _build_overlay_mask(
    width: int,
    height: int,
    marker_margin: int = MARKER_CLEANUP_MARGIN,
) -> np.ndarray:
    mask_image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask_image)
    for center_x, center_y, radius in AUTHORED_MARKER_PATCHES:
        expanded_radius = radius + marker_margin
        draw.ellipse(
            (
                center_x - expanded_radius,
                center_y - expanded_radius,
                center_x + expanded_radius,
                center_y + expanded_radius,
            ),
            fill=255,
        )
    # The C4 marker has a small triangular pointer below/left of its ring.
    draw.polygon(((1188, 671), (1234, 625), (1268, 680)), fill=255)
    draw.rectangle(AUTHORED_LEGEND_RECT, fill=255)
    return np.asarray(mask_image, dtype=bool)


def _build_flat_floor(source: np.ndarray, clean_mask: np.ndarray) -> np.ndarray:
    """Keep map structure while giving cleaned regions a stable floor colour."""
    height, width = source.shape[:2]
    y_coordinates = np.arange(height, dtype=np.float32)[:, None]
    x_coordinates = np.arange(width, dtype=np.float32)[None, :]

    base = np.zeros_like(source)
    base[:, :, 0] = np.clip(18 + y_coordinates * 0.012 + x_coordinates * 0.002, 0, 255)
    base[:, :, 1] = np.clip(34 + y_coordinates * 0.016 + x_coordinates * 0.003, 0, 255)
    base[:, :, 2] = np.clip(48 + y_coordinates * 0.020 + x_coordinates * 0.004, 0, 255)

    red, green, blue = (
        source[:, :, 0].astype(np.float32),
        source[:, :, 1].astype(np.float32),
        source[:, :, 2].astype(np.float32),
    )
    brightness = source.mean(axis=2)
    chroma = source.max(axis=2) - source.min(axis=2)

    # White/grey walls and map props remain source-derived. Site colours are
    # also retained because they are map landmarks, not authored player data.
    structural = (brightness > 105) & (chroma < 50) & clean_mask
    green_site = (green > red * 1.15) & (green > blue * 0.8) & (green > 65) & clean_mask
    yellow_site = (red > 150) & (green > 125) & (blue < 110) & clean_mask
    landmark_image = Image.new("L", (width, height), 0)
    landmark_draw = ImageDraw.Draw(landmark_image)
    for rect in MAP_LANDMARK_RECTS:
        landmark_draw.rectangle(rect, fill=255)
    landmark_mask = np.asarray(landmark_image, dtype=bool) & clean_mask
    source_structure = structural | green_site | yellow_site | landmark_mask
    base[source_structure] = source[source_structure]
    return base


def build_clean_map(source_path: Path, output_path: Path) -> None:
    source = Image.open(source_path).convert("RGBA")
    if source.size != (1448, 1086):
        raise ValueError(f"expected 1448x1086 Lite2 raster, got {source.size}")

    source_array = np.asarray(source, dtype=np.uint8)
    overlay_mask = _build_overlay_mask(*source.size)
    cleaned = np.empty_like(source_array)
    cleaned[:, :, :3] = _build_flat_floor(source_array[:, :, :3], ~overlay_mask)
    cleaned[:, :, 3] = source_array[:, :, 3]

    # The authored legend is outside the map silhouette; make it transparent
    # instead of replacing it with a new legend that could be mistaken for
    # current-state evidence.
    legend_x0, legend_y0, legend_x1, legend_y1 = AUTHORED_LEGEND_RECT
    cleaned[legend_y0:legend_y1, legend_x0:legend_x1, :3] = 0
    cleaned[legend_y0:legend_y1, legend_x0:legend_x1, 3] = 0

    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(cleaned, mode="RGBA").save(output_path, format="PNG", optimize=False)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    build_clean_map(args.source, args.output)
    print(f"wrote {args.output} (1448x1086 RGBA)")


if __name__ == "__main__":
    main()
