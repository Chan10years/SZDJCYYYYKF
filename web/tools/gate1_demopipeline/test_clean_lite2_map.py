import hashlib
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

from build_clean_lite2_map import AUTHORED_MARKER_PATCHES, AUTHORED_LEGEND_RECT


ROOT = Path(__file__).parents[2]
SOURCE = ROOT / "public" / "maps" / "Lite2_Map.png"
CLEAN = ROOT / "public" / "maps" / "Lite2_CurrentStateBase.png"


class CleanLite2MapAssetTest(unittest.TestCase):
    def test_clean_asset_keeps_native_frame_and_is_deterministic(self):
        image = Image.open(CLEAN).convert("RGBA")

        self.assertEqual(image.size, (1448, 1086))
        self.assertEqual(image.mode, "RGBA")
        self.assertEqual(
            hashlib.sha256(CLEAN.read_bytes()).hexdigest().upper(),
            "A1C4600C58B1283E67443A3CFE332EEE2923D8645A853117082AF08EF260E15B",
        )
        self.assertNotEqual(
            hashlib.sha256(SOURCE.read_bytes()).digest(),
            hashlib.sha256(CLEAN.read_bytes()).digest(),
        )

    def test_clean_asset_has_no_baked_marker_colour_in_known_regions(self):
        source = np.asarray(Image.open(SOURCE).convert("RGB"))
        clean = np.asarray(Image.open(CLEAN).convert("RGB"))

        for center_x, center_y, radius in AUTHORED_MARKER_PATCHES:
            y0, y1 = center_y - radius - 10, center_y + radius + 11
            x0, x1 = center_x - radius - 10, center_x + radius + 11
            for pixels, expected in ((source[y0:y1, x0:x1], True), (clean[y0:y1, x0:x1], False)):
                cream = (
                    (pixels[:, :, 0] > 170)
                    & (pixels[:, :, 1] > 140)
                    & (pixels[:, :, 2] > 90)
                    & (pixels[:, :, 0] > pixels[:, :, 2] * 1.2)
                )
                red = (
                    (pixels[:, :, 0] > 80)
                    & (pixels[:, :, 0] > pixels[:, :, 1] * 1.4)
                    & (pixels[:, :, 0] > pixels[:, :, 2] * 1.4)
                )
                has_marker_colour = bool((cream | red).any())
                self.assertEqual(has_marker_colour, expected)

    def test_authored_legend_region_is_transparent(self):
        image = np.asarray(Image.open(CLEAN).convert("RGBA"))
        x0, y0, x1, y1 = AUTHORED_LEGEND_RECT
        self.assertTrue(np.all(image[y0:y1, x0:x1, 3] == 0))


if __name__ == "__main__":
    unittest.main()
