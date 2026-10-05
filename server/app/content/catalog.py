"""Load the private authored catalog; public API responses must omit answer keys."""

import json
from pathlib import Path
from typing import Any

CATALOG_PATH = Path(__file__).with_name("catalog.json")


def load_catalog() -> dict[str, Any]:
    """Return a fresh catalog so callers cannot mutate a shared content instance."""
    with CATALOG_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)
