"""Inspect, validate or apply explicit local model bundles without loading tensors."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .catalog import Catalog, CatalogError


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--catalog",
        type=Path,
        default=os.environ.get("FIZGIG_MODEL_CATALOG", "/etc/fizgig/models.json"),
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list", help="List configured bundles; no model loads")
    validate = sub.add_parser(
        "validate", help="Check paths, recorded sizes and known format restrictions"
    )
    validate.add_argument("bundles", nargs="*")
    apply = sub.add_parser(
        "apply",
        help="Apply bundles to prefs.json; stop Fizgig before changing selection",
    )
    apply.add_argument("bundles", nargs="*")
    apply.add_argument(
        "--initialize-state",
        action="store_true",
        help="Open a fresh UI on the first active bundle's family; keep existing state",
    )
    apply.add_argument(
        "--prefs",
        type=Path,
        default=Path(os.environ.get("FIZGIG_USER_DATA", "/workspace/user_data"))
        / "prefs.json",
    )
    args = parser.parse_args()
    try:
        catalog = Catalog(args.catalog)
        if args.command == "list":
            result = catalog.bundles
        elif args.command == "validate":
            result = {
                name: catalog.resolve_bundle(name)
                for name in (args.bundles or catalog.bundles)
            }
        else:
            names = args.bundles or catalog.config.get("active", [])
            result = catalog.apply(names, args.prefs)
            if args.initialize_state:
                catalog.initialize_state(names, args.prefs.parent / "web_state.json")
        print(json.dumps(result, indent=2))
        return 0
    except (CatalogError, OSError, ValueError, KeyError, TypeError) as error:
        print(f"Local model preflight failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
