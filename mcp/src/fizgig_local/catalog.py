"""Resolve explicit Fizgig selections against ComfyUI's installed manifest."""

from __future__ import annotations

import json
import os
import struct
import tempfile
from pathlib import Path


class CatalogError(ValueError):
    """An incomplete or unsafe local model selection."""


def read_json(path: Path) -> dict:
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise CatalogError(f"Expected a JSON object: {path}")
    return value


def inside(root: Path, relative: str) -> Path:
    if not relative or Path(relative).is_absolute() or ".." in Path(relative).parts:
        raise CatalogError(f"Expected a relative path within {root}: {relative!r}")
    target = (root / relative).resolve()
    if not target.is_relative_to(root.resolve()):
        raise CatalogError(f"Path escapes configured root: {relative}")
    return target


def header(path: Path) -> dict:
    """Read only safetensors metadata; never map/load the tensor payload."""
    with path.open("rb") as stream:
        size_bytes = stream.read(8)
        if len(size_bytes) != 8:
            raise CatalogError(f"Truncated safetensors header: {path}")
        length = struct.unpack("<Q", size_bytes)[0]
        if not 0 < length <= 64 * 1024 * 1024:
            raise CatalogError(f"Invalid safetensors header length: {path}")
        data = json.loads(stream.read(length))
    if not isinstance(data, dict):
        raise CatalogError(f"Invalid safetensors header: {path}")
    return {key: value for key, value in data.items() if key != "__metadata__"}


def atomic_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(data, stream, indent=2)
            stream.write("\n")
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


class Catalog:
    def __init__(self, path: Path):
        self.path = path
        self.config = read_json(path)
        if self.config.get("version") != 1:
            raise CatalogError("Only local catalog version 1 is supported")
        self.manifest = Path(os.environ.get("FIZGIG_MANIFEST_ROOT", "/catalog"))
        self.models = Path(os.environ.get("FIZGIG_MODELS_ROOT", "/models"))
        self.external = {
            name: Path(root)
            for name, root in self.config.get("external_roots", {}).items()
        }
        self.bundles = self.config.get("bundles", {})
        if not isinstance(self.bundles, dict):
            raise CatalogError("bundles must be an object")

    def inventory(self, family: str) -> dict:
        if not family or Path(family).name != family or family in {".", ".."}:
            raise CatalogError(f"Invalid manifest family: {family!r}")
        data = read_json(inside(self.manifest, f"{family}/inventory.json"))
        if data.get("family") != family or data.get("path_root") != "models/":
            raise CatalogError(f"Unexpected manifest identity or path_root: {family}")
        return data

    def resolve(self, reference: dict) -> Path:
        if not isinstance(reference, dict):
            raise CatalogError("A model reference must be an object")
        if "external" in reference:
            root = self.external.get(reference["external"])
            if root is None:
                raise CatalogError(f"Unknown external root: {reference['external']}")
            path = inside(root, reference["path"])
            record = reference
        else:
            data = self.inventory(reference["family"])
            records = data.get("checkpoints", []) + data.get("components", [])
            selector = "id" if "id" in reference else "path"
            if not reference.get(selector):
                raise CatalogError("Manifest references require an id or path")
            matches = [
                row for row in records if row.get(selector) == reference[selector]
            ]
            # Some family catalogues repeat shared records; never choose an ambiguous ID.
            if len(matches) != 1:
                raise CatalogError(f"Expected exactly one manifest record: {reference}")
            record = matches[0]
            path = inside(self.models, record["path"])
        if not path.is_file():
            raise CatalogError(f"Missing local asset: {path}; downloads are disabled")
        if record.get("size_bytes") and path.stat().st_size != record["size_bytes"]:
            raise CatalogError(f"Asset size differs from recorded manifest: {path}")
        return path

    def resolve_bundle(self, name: str) -> dict[str, str]:
        bundle = self.bundles.get(name)
        if not isinstance(bundle, dict):
            raise CatalogError(f"Unknown bundle: {name}")
        family = bundle["family"]
        bindings = bundle["preferences"]
        required = {
            "krea2": {"krea2_raw_dit", "krea2_vae", "krea2_text_encoder"},
            "anima": {"anima_dit", "anima_vae", "anima_text_encoder"},
            "sdxl": {"sdxl_checkpoint"},
            "fibo2": {"fibo2_dit", "fibo2_vae", "fibo2_text_encoder"},
            "klein": {"base_dit", "vae", "text_encoder"},
            "moss_image": {
                "moss_image_dit",
                "moss_image_vae",
                "moss_image_text_encoder",
                "moss_image_sft_dit",
            },
            "qwen_image21": {"qwen21_dit", "qwen21_vae", "qwen21_text_encoder"},
            "zimage": {"zimage_dit", "zimage_vae", "zimage_text_encoder"},
            "minimax": {"minimax_dit", "minimax_vae", "minimax_text_encoder"},
        }
        if family not in required:
            raise CatalogError(
                f"Family needs an explicitly reviewed integration: {family}"
            )
        if not required[family].issubset(bindings):
            raise CatalogError(f"Incomplete {family} bundle: {name}")
        allowed = (
            required[family]
            | {
                "krea2": {"krea2_turbo_dit", "krea2_turbo_lora"},
                "anima": {"anima_turbo_lora"},
                "sdxl": {"sdxl_vae", "sdxl_text_encoder"},
                "fibo2": {"fibo2_turbo_lora"},
                "klein": {"distilled_dit"},
                "moss_image": {
                    "moss_image_turbo_lora",
                    "moss_image_sft_dit",
                    "moss_image_sft_look_lora",
                },
                "qwen_image21": {
                    "qwen21_training_adapter",
                    "qwen21_turbo_lora",
                    "qwen21_turbo_dit",
                },
                "zimage": {"zimage_training_adapter"},
                "minimax": {
                    "minimax_ref_dit",
                    "minimax_audio_vae",
                    "minimax_turbo_lora",
                    "minimax_circlestone_adapter",
                    "minimax_training_adapter",
                    "minimax_ref_training_adapter",
                },
            }[family]
        )
        if set(bindings) - allowed:
            raise CatalogError(
                f"Unrecognized {family} preference keys: {set(bindings) - allowed}"
            )
        paths = {key: self.resolve(ref) for key, ref in bindings.items()}
        for key, path in paths.items():
            tensors = header(path)
            dtypes = {item["dtype"] for item in tensors.values()}
            if key == "krea2_text_encoder" and "I8" in dtypes:
                raise CatalogError(
                    "Krea 2 text encoder cannot load INT8 ConvRot; use existing FP8 scaled or BF16 weights"
                )
            if family == "anima" and ("I8" in dtypes or "U8" in dtypes):
                raise CatalogError(
                    "This integration only enables plain BF16/FP16 Anima assets"
                )
            if key == "sdxl_checkpoint" and not any(
                k.startswith("conditioner.embedders.") for k in tensors
            ):
                raise CatalogError(
                    "SDXL needs a complete checkpoint including its text encoders"
                )
        return {key: str(path) for key, path in paths.items()}

    def apply(self, names: list[str], prefs_path: Path) -> dict[str, str]:
        """All selections preflight before any preference changes; preserve unrelated UI settings."""
        changes: dict[str, str] = {}
        families = set()
        for name in names:
            if name not in self.bundles:
                raise CatalogError(f"Unknown bundle: {name}")
            family = self.bundles[name]["family"]
            if family in families:
                raise CatalogError(f"Select only one bundle per family: {family}")
            families.add(family)
            changes.update(self.resolve_bundle(name))
        prefs = read_json(prefs_path) if prefs_path.exists() else {}
        # Clear optional paths for a newly selected family so an old preview/adapter
        # cannot silently accompany a different checkpoint.
        optional = {
            "krea2": ("krea2_turbo_dit", "krea2_turbo_lora"),
            "anima": ("anima_turbo_lora",),
            "sdxl": ("sdxl_vae", "sdxl_text_encoder"),
            "fibo2": ("fibo2_turbo_lora",),
            "klein": ("distilled_dit",),
            "moss_image": (
                "moss_image_turbo_lora",
                "moss_image_sft_dit",
                "moss_image_sft_look_lora",
            ),
            "qwen_image21": (
                "qwen21_training_adapter",
                "qwen21_turbo_lora",
                "qwen21_turbo_dit",
            ),
            "zimage": ("zimage_training_adapter",),
            "minimax": (
                "minimax_ref_dit",
                "minimax_audio_vae",
                "minimax_turbo_lora",
                "minimax_circlestone_adapter",
                "minimax_training_adapter",
                "minimax_ref_training_adapter",
            ),
        }
        for family in families:
            for key in optional[family]:
                prefs.pop(key, None)
        prefs.update(changes)
        defaults = {
            "lora_output_dir": "/workspace/output_loras",
            "profiles_dir": "/workspace/user_data/profiles",
            "cache_dir": "/workspace/cache",
            "input_dataset_dir": "/datasets",
            "input_lora_dir": "/models/loras",
            "lan_discovery": "0",
            "update_check": "0",
        }
        for key, value in defaults.items():
            prefs.setdefault(key, value)
        atomic_json(prefs_path, prefs)
        return changes

    def initialize_state(self, names: list[str], state_path: Path) -> None:
        """Open a fresh UI on the first configured family; retain existing UI state."""
        state = read_json(state_path) if state_path.exists() else {}
        if not state.get("family") and names:
            state["family"] = self.bundles[names[0]]["family"]
            atomic_json(state_path, state)
