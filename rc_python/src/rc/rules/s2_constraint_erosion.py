from __future__ import annotations

from dataclasses import dataclass
from typing import Any


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _severity(score: float) -> str:
    if score < 0.20:
        return "LOW"
    if score < 0.50:
        return "MEDIUM"
    if score < 0.80:
        return "HIGH"
    return "CRITICAL"


@dataclass(frozen=True)
class _Dynamics:
    starts_at: float
    drift_per_step: float
    clamp_lo: float
    clamp_hi: float


def _get_dynamics(spec: dict[str, Any], metric_name: str) -> _Dynamics | None:
    time = spec.get("time") or {}
    dynamics = time.get("dynamics") or []
    for d in dynamics:
        if d.get("metric") == metric_name:
            starts_at = float(d.get("starts_at", 0.0) or 0.0)
            drift = float(d.get("drift_per_step", 0.0) or 0.0)
            c = d.get("clamp") or [0.0, 1.0]
            lo = float(c[0]) if len(c) >= 1 else 0.0
            hi = float(c[1]) if len(c) >= 2 else 1.0
            return _Dynamics(starts_at=starts_at, drift_per_step=drift, clamp_lo=lo, clamp_hi=hi)
    return None


def _value_at(d: _Dynamics, t: int) -> float:
    # v(t) = clamp(starts_at + drift * t)
    return _clamp(d.starts_at + d.drift_per_step * t, d.clamp_lo, d.clamp_hi)


def run_s2(spec: dict[str, Any]) -> dict[str, Any]:
    """
    S2: Constraint Erosion (Oversight Decay)

    Detects whether oversight capacity (human_review_rate) erodes relative to automation pressure
    (automation_ratio) over time, especially in the presence of fatal constraints.

    v0.2 update: Adds a margin-based warning:
      - Even without inversion (review < automation), thin margins are risky.
      - If min(review - automation) drops below margin_threshold, risk increases.
    """
    constraints = spec.get("constraints") or []
    fatal_constraints = [c for c in constraints if (c.get("severity") == "fatal")]
    fatal_count = len(fatal_constraints)

    time = spec.get("time") or {}
    horizon = int(time.get("horizon_steps", 20) or 20)
    if horizon < 1:
        horizon = 20

    d_auto = _get_dynamics(spec, "automation_ratio")
    d_review = _get_dynamics(spec, "human_review_rate")

    # If dynamics are missing, we cannot analyze erosion.
    if d_auto is None or d_review is None:
        explanation = []
        if d_auto is None:
            explanation.append("Missing time.dynamics entry for automation_ratio.")
        if d_review is None:
            explanation.append("Missing time.dynamics entry for human_review_rate.")
        explanation.append("S2 requires both metrics to model oversight vs automation over time.")

        suggested = []
        if d_auto is None:
            suggested.append("Add time.dynamics for automation_ratio (starts_at, drift_per_step, clamp).")
        if d_review is None:
            suggested.append("Add time.dynamics for human_review_rate (starts_at, drift_per_step, clamp).")

        return {
            "rule_id": "S2",
            "name": "Constraint Erosion (Oversight Decay)",
            "severity": "MEDIUM",
            "score": 0.35,
            "signals": {
                "fatal_constraints": fatal_count,
                "horizon_steps": horizon,
                "note": "insufficient_time_dynamics",
            },
            "explanation": explanation,
            "suggested_fixes": suggested,
        }

    # Find earliest step where human_review_rate < automation_ratio (oversight inversion)
    t_cross: int | None = None
    for t in range(0, horizon + 1):
        a = _value_at(d_auto, t)
        r = _value_at(d_review, t)
        if r < a:
            t_cross = t
            break

    # Margin-based assessment: find minimum margin across horizon
    margin_threshold = 0.10  # 10 percentage points by default (v0.2)
    min_margin = float("inf")
    t_min = 0
    for t in range(0, horizon + 1):
        a = _value_at(d_auto, t)
        r = _value_at(d_review, t)
        margin = r - a
        if margin < min_margin:
            min_margin = margin
            t_min = t

    # If there is no inversion, we may still warn on thin margin.
    if t_cross is None:
        if min_margin >= margin_threshold:
            # No inversion and margin remains healthy
            return {
                "rule_id": "S2",
                "name": "Constraint Erosion (Oversight Decay)",
                "severity": "LOW",
                "score": 0.0,
                "signals": {
                    "fatal_constraints": fatal_count,
                    "horizon_steps": horizon,
                    "oversight_inversion": False,
                    "margin_threshold": margin_threshold,
                    "min_margin": round(float(min_margin), 4),
                    "t_min_margin": t_min,
                },
                "explanation": [
                    "Within the configured time horizon, human review does not drop below automation.",
                    f"Oversight margin stays >= {margin_threshold:.2f} (min margin {min_margin:.2f} at step {t_min}).",
                ],
                "suggested_fixes": [],
            }

        # Thin margin without inversion -> warning
        # Score increases as margin approaches 0.
        score = _clamp((margin_threshold - float(min_margin)) / margin_threshold, 0.0, 1.0)
        score = round(score, 4)
        sev = _severity(score)

        # Optional v0.1 policy: if there are no fatal constraints, cap severity at MEDIUM.
        if fatal_count == 0 and sev in ("HIGH", "CRITICAL"):
            sev = "MEDIUM"

        return {
            "rule_id": "S2",
            "name": "Constraint Erosion (Oversight Decay)",
            "severity": sev,
            "score": round(score, 4),
            "signals": {
                "fatal_constraints": fatal_count,
                "horizon_steps": horizon,
                "oversight_inversion": False,
                "margin_threshold": margin_threshold,
                "min_margin": round(float(min_margin), 4),
                "t_min_margin": t_min,
            },
            "explanation": [
                "No oversight inversion detected, but oversight margin becomes thin.",
                f"Minimum margin (human_review_rate - automation_ratio) is {min_margin:.2f} at step {t_min}.",
                f"Configured margin threshold is {margin_threshold:.2f}.",
                "Thin margins are fragile under noise, exceptions, and measurement error—risk rises even before inversion.",
            ],
            "suggested_fixes": [
                "Increase the floor for human_review_rate (e.g., clamp lower bound).",
                "Reduce automation_ratio drift or introduce staged rollout gates.",
                "Add periodic audits tied to fatal constraints (independent of incentives).",
            ],
        }

    # Inversion exists: score based on how early it occurs (earlier inversion -> higher risk)
    erosion_ratio = (horizon - t_cross) / horizon
    score = _clamp(float(erosion_ratio), 0.0, 1.0)
    sev = _severity(score)

    if fatal_count == 0 and sev in ("HIGH", "CRITICAL"):
        sev = "MEDIUM"

    a0 = _value_at(d_auto, 0)
    r0 = _value_at(d_review, 0)
    a_cross = _value_at(d_auto, t_cross)
    r_cross = _value_at(d_review, t_cross)

    explanation = [
        "Oversight inversion occurs when human_review_rate < automation_ratio.",
        f"Inversion detected at step ~{t_cross} / {horizon}.",
        f"At t=0: automation={a0:.2f}, review={r0:.2f}.",
        f"At inversion: automation={a_cross:.2f}, review={r_cross:.2f}.",
    ]
    if fatal_count > 0:
        explanation.append(
            "With fatal constraints present, losing oversight increases the risk that constraints become symbolic rather than enforced."
        )
    else:
        explanation.append(
            "Even without fatal constraints declared, oversight decay can still increase operational and ethical risk."
        )

    suggested = [
        "Set a minimum floor for human_review_rate (e.g., clamp lower bound).",
        "Slow automation_ratio growth after a threshold or introduce staged rollout gates.",
        "Introduce periodic mandatory audits tied to fatal constraints (independent of incentives).",
    ]

    return {
        "rule_id": "S2",
        "name": "Constraint Erosion (Oversight Decay)",
        "severity": sev,
        "score": round(score, 4),
        "signals": {
            "fatal_constraints": fatal_count,
            "horizon_steps": horizon,
            "oversight_inversion": True,
            "t_cross": t_cross,
            "automation_t0": round(a0, 4),
            "review_t0": round(r0, 4),
            "automation_at_cross": round(a_cross, 4),
            "review_at_cross": round(r_cross, 4),
            "margin_threshold": margin_threshold,
            "min_margin": round(float(min_margin), 4),
            "t_min_margin": t_min,
        },
        "explanation": explanation,
        "suggested_fixes": suggested,
    }
