from __future__ import annotations

import json
import os
import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fizgig_local.catalog import Catalog, CatalogError, inside
from fizgig_local.offline import audit, local_host


def save(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value))


def weight(path: Path, tensors: dict | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(
        tensors or {"conditioner.embedders.0.weight": {"dtype": "F16"}}
    ).encode()
    path.write_bytes(struct.pack("<Q", len(data)) + data)


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.models = self.root / "models"
        self.manifest = self.root / "manifest"
        self.env = patch.dict(
            os.environ,
            {
                "FIZGIG_MANIFEST_ROOT": str(self.manifest),
                "FIZGIG_MODELS_ROOT": str(self.models),
            },
        )
        self.env.start()
        self.addCleanup(self.env.stop)
        weight(self.models / "checkpoints/unique-name.safetensors")
        self.inventory = {
            "family": "sdxl",
            "path_root": "models/",
            "components": [],
            "checkpoints": [
                {"id": "base", "path": "checkpoints/unique-name.safetensors"}
            ],
        }
        save(self.manifest / "sdxl/inventory.json", self.inventory)
        self.config = {
            "version": 1,
            "active": ["sdxl-base"],
            "bundles": {
                "sdxl-base": {
                    "family": "sdxl",
                    "preferences": {
                        "sdxl_checkpoint": {"family": "sdxl", "id": "base"},
                    },
                }
            },
        }
        self.config_path = self.root / "catalog.json"

    def catalog(self):
        save(self.config_path, self.config)
        return Catalog(self.config_path)

    def test_manifest_ids_keep_custom_filenames(self):
        paths = self.catalog().resolve_bundle("sdxl-base")
        self.assertEqual(
            paths["sdxl_checkpoint"],
            str(self.models / "checkpoints/unique-name.safetensors"),
        )

    def test_paths_follow_manifest_rename(self):
        old = self.models / "checkpoints/unique-name.safetensors"
        new = old.with_name("renamed.safetensors")
        old.rename(new)
        self.inventory["checkpoints"][0]["path"] = "checkpoints/renamed.safetensors"
        save(self.manifest / "sdxl/inventory.json", self.inventory)
        self.assertEqual(
            self.catalog().resolve_bundle("sdxl-base")["sdxl_checkpoint"], str(new)
        )

    def test_missing_files_fail_without_writing_preferences(self):
        (self.models / "checkpoints/unique-name.safetensors").unlink()
        prefs = self.root / "prefs.json"
        save(prefs, {"theme": "dark"})
        before = prefs.read_bytes()
        with self.assertRaisesRegex(CatalogError, "Missing local asset"):
            self.catalog().apply(["sdxl-base"], prefs)
        self.assertEqual(prefs.read_bytes(), before)

    def test_merge_preserves_ui_and_clears_stale_family_overrides(self):
        prefs = self.root / "prefs.json"
        save(
            prefs, {"theme": "dark", "sdxl_vae": "/old/vae", "krea2_turbo_dit": "/keep"}
        )
        self.catalog().apply(["sdxl-base"], prefs)
        saved = json.loads(prefs.read_text())
        self.assertEqual(saved["theme"], "dark")
        self.assertEqual(saved["krea2_turbo_dit"], "/keep")
        self.assertNotIn("sdxl_vae", saved)

    def test_duplicate_family_selection_rejected(self):
        self.config["bundles"]["other"] = self.config["bundles"]["sdxl-base"]
        with self.assertRaisesRegex(CatalogError, "one bundle per family"):
            self.catalog().apply(["sdxl-base", "other"], self.root / "prefs.json")

    def test_first_ui_family_and_existing_state_preserved(self):
        state = self.root / "web_state.json"
        catalog = self.catalog()
        catalog.initialize_state(["sdxl-base"], state)
        self.assertEqual(json.loads(state.read_text())["family"], "sdxl")
        save(state, {"family": "anima", "values": {"anima": {"SEED": 42}}})
        before = state.read_bytes()
        catalog.initialize_state(["sdxl-base"], state)
        self.assertEqual(state.read_bytes(), before)

    def test_ambiguous_manifest_id_rejected(self):
        self.inventory["checkpoints"].append(self.inventory["checkpoints"][0])
        save(self.manifest / "sdxl/inventory.json", self.inventory)
        with self.assertRaisesRegex(CatalogError, "exactly one"):
            self.catalog().resolve_bundle("sdxl-base")

    def test_recorded_size_mismatch_rejected(self):
        self.inventory["checkpoints"][0]["size_bytes"] = 123456
        save(self.manifest / "sdxl/inventory.json", self.inventory)
        with self.assertRaisesRegex(CatalogError, "size differs"):
            self.catalog().resolve_bundle("sdxl-base")

    def test_path_and_symlink_escape_rejected(self):
        for path in ("../secret", "/etc/passwd"):
            with self.assertRaises(CatalogError):
                inside(self.models, path)
        (self.models / "escape").symlink_to(self.root)
        with self.assertRaises(CatalogError):
            inside(self.models, "escape/catalog.json")

    def test_int8_krea_encoder_rejected(self):
        weight(self.models / "bad.safetensors", {"model.weight": {"dtype": "I8"}})
        self.config["external_roots"] = {"test": str(self.models)}
        self.config["bundles"]["bad"] = {
            "family": "krea2",
            "preferences": {
                key: {"external": "test", "path": "bad.safetensors"}
                for key in ("krea2_raw_dit", "krea2_vae", "krea2_text_encoder")
            },
        }
        with self.assertRaisesRegex(CatalogError, "cannot load INT8"):
            self.catalog().resolve_bundle("bad")

    def test_diffusion_only_sdxl_rejected(self):
        weight(
            self.models / "checkpoints/unique-name.safetensors",
            {"unet.weight": {"dtype": "F16"}},
        )
        with self.assertRaisesRegex(CatalogError, "complete checkpoint"):
            self.catalog().resolve_bundle("sdxl-base")


class OfflineTests(unittest.TestCase):
    def test_public_and_private_download_connections_rejected(self):
        for host in ("huggingface.co", "1.1.1.1", "192.168.1.1"):
            with self.assertRaisesRegex(PermissionError, "offline mode"):
                audit("socket.connect", (None, (host, 443)))
            with self.assertRaises(PermissionError):
                audit("socket.getaddrinfo", (host, 443))

    def test_loopback_and_unix_sockets_work(self):
        for host in ("localhost", "127.0.0.1", "::1", b"localhost"):
            self.assertTrue(local_host(host))
            audit("socket.connect", (None, (host, 8081)))
        audit("socket.connect", (None, "/run/example.sock"))


if __name__ == "__main__":
    unittest.main()
