from rc.taxonomy import bucket_for_intent, bucket_for_metric, default_taxonomy_v01


def _time_amplification(spec: dict) -> float:
    time = spec.get("time") or {}
    dynamics = time.get("dynamics") or []

    auto_increasing = False
    human_review_decreasing = False

    for d in dynamics:
        metric = d.get("metric")
        drift = float(d.get("drift_per_step", 0) or 0)
        if metric == "automation_ratio" and drift > 0:
            auto_increasing = True
        if metric == "human_review_rate" and drift < 0:
            human_review_decreasing = True

    taf = 1.0
    if auto_increasing:
        taf += 0.25
    if human_review_decreasing:
        taf += 0.25
    return taf


def _severity(score: float) -> str:
    if score < 0.20:
        return "LOW"
    if score < 0.45:
        return "MEDIUM"
    if score < 0.70:
        return "HIGH"
    return "CRITICAL"


def run_s1(spec: dict) -> dict:
    tax = default_taxonomy_v01()

    priorities = ((spec.get("intent") or {}).get("priorities")) or []
    if not priorities:
        return {
            "rule_id": "S1",
            "name": "Intent-Incentive Conflict",
            "severity": "MEDIUM",
            "score": 0.40,
            "signals": {"reason": "No intent priorities found."},
            "explanation": [
                "Spec missing intent.priorities; cannot assess reinforcement accurately."
            ],
            "suggested_fixes": ["Add intent.priorities with top-level intent first."],
        }

    I0 = priorities[0]
    I0_bucket = bucket_for_intent(I0, tax)

    incentives = spec.get("incentives") or {}
    rewards = incentives.get("rewards") or []
    penalties = incentives.get("penalties") or []

    # accumulate bucket weights
    bucket_w = {}
    total_w = 0.0

    def add_item(it):
        nonlocal total_w
        metric = it.get("metric")
        w = float(it.get("weight", 0) or 0)
        bw = abs(w)
        b = bucket_for_metric(metric, tax)
        bucket_w[b] = bucket_w.get(b, 0.0) + bw
        total_w += bw

    for it in rewards:
        add_item(it)
    for it in penalties:
        add_item(it)

    if total_w <= 0:
        return {
            "rule_id": "S1",
            "name": "Intent-Incentive Conflict",
            "severity": "MEDIUM",
            "score": 0.35,
            "signals": {"top_intent": I0, "note": "total incentive weight is 0"},
            "explanation": ["Incentive weights sum to 0; cannot compute dominance."],
            "suggested_fixes": ["Add incentives.rewards/penalties with non-zero weights."],
        }

    dominant_bucket = max(bucket_w.items(), key=lambda kv: kv[1])[0]
    dominance_ratio = bucket_w[dominant_bucket] / total_w

    intent_reinforcement = bucket_w.get(I0_bucket, 0.0) / total_w

    # fatal constraint coverage for I0 bucket
    constraints = spec.get("constraints") or []
    fatal_I0 = [
        c
        for c in constraints
        if (c.get("severity") == "fatal" and bucket_for_metric(c.get("metric"), tax) == I0_bucket)
    ]
    incentive_metrics = set(
        [it.get("metric") for it in rewards] + [it.get("metric") for it in penalties]
    )
    covered = sum(1 for c in fatal_I0 if c.get("metric") in incentive_metrics)
    coverage_ratio = covered / max(1, len(fatal_I0))  # if none, treat as 1? we'll handle below

    # If there are no fatal constraints in I0, coverage_penalty should not punish.
    if len(fatal_I0) == 0:
        coverage_penalty = 0.0
        coverage_ratio_effective = 1.0
    else:
        coverage_penalty = 1.0 - coverage_ratio
        coverage_ratio_effective = coverage_ratio

    conflict_base = (
        max(0.0, dominance_ratio - intent_reinforcement) if dominant_bucket != I0_bucket else 0.0
    )

    taf = _time_amplification(spec)
    score = taf * (0.6 * conflict_base + 0.4 * coverage_penalty)
    score = min(1.0, max(0.0, score))

    severity = _severity(score)

    explanation = []
    if dominant_bucket != I0_bucket:
        explanation.append(
            f"Reward structure is dominated by '{dominant_bucket}' rather than top intent '{I0_bucket}'."
        )
    explanation.append(
        f"Top intent reinforcement is {intent_reinforcement:.2f} of total incentive weight."
    )
    if len(fatal_I0) > 0:
        explanation.append(
            f"Fatal constraint coverage for top intent is {covered}/{len(fatal_I0)}."
        )
    if taf > 1.0:
        explanation.append("Time dynamics amplify drift (automation↑ and/or human review↓).")

    suggested = []
    if dominant_bucket != I0_bucket:
        suggested.append(
            f"Rebalance incentives: reduce weight on '{dominant_bucket}' metrics or add weight to '{I0_bucket}' metrics."
        )
    if len(fatal_I0) > 0 and covered == 0:
        suggested.append(
            "Tie incentives/penalties directly to fatal constraint metrics (guardrail reinforcement)."
        )
    if taf > 1.0:
        suggested.append("Cap automation growth or preserve human review to reduce amplification.")

    return {
        "rule_id": "S1",
        "name": "Intent-Incentive Conflict",
        "severity": severity,
        "score": round(score, 4),
        "signals": {
            "top_intent": I0,
            "top_intent_bucket": I0_bucket,
            "dominant_bucket": dominant_bucket,
            "dominance_ratio": round(dominance_ratio, 4),
            "intent_reinforcement": round(intent_reinforcement, 4),
            "fatal_constraint_coverage_ratio": round(coverage_ratio_effective, 4),
            "time_amplification_factor": round(taf, 4),
        },
        "explanation": explanation,
        "suggested_fixes": suggested,
    }
