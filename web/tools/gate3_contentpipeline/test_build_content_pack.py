import unittest
from pathlib import Path

from build_content_pack import load_manifest


class ContentManifestTests(unittest.TestCase):
    def test_manifest_contains_real_map_diversity_without_authored_semantics(self) -> None:
        manifest = load_manifest(Path(__file__).with_name("real-content-manifest.json"))

        self.assertEqual({entry["mapName"] for entry in manifest}, {"de_overpass", "de_dust2"})
        self.assertTrue(all(entry["mapAsset"] is None for entry in manifest))
        self.assertTrue(all("calls" not in entry and "routes" not in entry for entry in manifest))


if __name__ == "__main__":
    unittest.main()
