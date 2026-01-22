import argparse
import json
import sys
from pathlib import Path

from rc.parse import load_spec
from rc.report.json import render_json_report
from rc.report.text import render_text_report
from rc.rules.s1_intent_incentive_conflict import run_s1
from rc.schema_validate import validate_schema
from rc.semantic_validate import validate_semantics


def main() -> None:
    parser = argparse.ArgumentParser(prog="rc", description="Reality Compiler")
    sub = parser.add_subparsers(dest="cmd", required=True)

    analyze = sub.add_parser("analyze", help="Analyze a Reality Spec")
    analyze.add_argument("spec_path", type=str)
    analyze.add_argument("--format", choices=["text", "json"], default="text")
    analyze.add_argument("--strict", action="store_true", help="Non-zero exit on fatal/high risk")

    args = parser.parse_args()

    if args.cmd == "analyze":
        spec_path = Path(args.spec_path)
        spec = load_spec(spec_path)

        # 1) schema
        validate_schema(spec, version=spec.get("version", "0.1"))

        # 2) semantics
        semantic_warnings = validate_semantics(spec)

        # 3) rules
        results = []
        results.append(run_s1(spec))

        report = {
            "spec": str(spec_path),
            "ruleset": f"v{spec.get('version', '0.1')}",
            "semantic_warnings": semantic_warnings,
            "results": results,
        }

        if args.format == "text":
            print(render_text_report(report))
        else:
            print(json.dumps(render_json_report(report), indent=2))

        # exit codes (simple MVP)
        exit_code = 0
        severities = [r["severity"] for r in results]
        if any(s in ("HIGH", "CRITICAL") for s in severities):
            exit_code = 3
        elif any(s == "MEDIUM" for s in severities):
            exit_code = 2

        if args.strict and exit_code != 0:
            sys.exit(exit_code)
        sys.exit(0)
