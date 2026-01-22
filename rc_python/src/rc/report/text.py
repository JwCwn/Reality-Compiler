def render_text_report(report: dict) -> str:
    lines = []
    lines.append("Reality Compiler — Static Analysis")
    lines.append(f"Spec: {report['spec']}")
    lines.append(f"Ruleset: {report['ruleset']}")
    lines.append("")

    if report.get("semantic_warnings"):
        lines.append("Semantic Warnings:")
        for w in report["semantic_warnings"]:
            lines.append(f"- {w}")
        lines.append("")

    for r in report["results"]:
        lines.append(f"{r['rule_id']}: {r['name']}  [{r['severity']}]")
        sig = r.get("signals") or {}
        for k, v in sig.items():
            lines.append(f"- {k}: {v}")
        lines.append(f"Score: {r.get('score')}")
        lines.append("")
        if r.get("explanation"):
            lines.append("Why this matters:")
            for e in r["explanation"]:
                lines.append(f"- {e}")
            lines.append("")
        if r.get("suggested_fixes"):
            lines.append("Suggested fixes:")
            for s in r["suggested_fixes"]:
                lines.append(f"- {s}")
            lines.append("")
        lines.append("-" * 60)

    return "\n".join(lines)
