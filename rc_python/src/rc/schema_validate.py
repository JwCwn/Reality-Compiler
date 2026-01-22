import json
from pathlib import Path

from jsonschema import Draft202012Validator


def validate_schema(spec: dict, version: str = "0.1") -> None:
    schema_path = Path(__file__).resolve().parents[1] / "spec" / f"v{version}" / "schema.json"
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema not found: {schema_path}")

    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)

    errors = sorted(validator.iter_errors(spec), key=lambda e: e.path)
    if errors:
        msg_lines = ["Schema validation failed:"]
        for e in errors[:10]:
            path = ".".join(str(p) for p in e.path) or "<root>"
            msg_lines.append(f"- {path}: {e.message}")
        raise ValueError("\n".join(msg_lines))
