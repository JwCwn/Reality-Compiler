from pathlib import Path

import yaml


def load_spec(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Spec not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError("Spec root must be a mapping/object")
    return data
