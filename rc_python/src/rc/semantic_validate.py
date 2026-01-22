def validate_semantics(spec: dict) -> list[str]:
    warnings: list[str] = []

    intent = (spec.get("intent") or {}).get("priorities") or []
    if len(intent) != len(set(intent)):
        warnings.append("intent.priorities contains duplicates.")

    incentives = spec.get("incentives") or {}
    rewards = incentives.get("rewards") or []
    penalties = incentives.get("penalties") or []

    def _sum_weights(items):
        s = 0.0
        for it in items:
            try:
                s += abs(float(it.get("weight", 0)))
            except Exception:
                warnings.append(f"Invalid weight value: {it}")
        return s

    total_w = _sum_weights(rewards) + _sum_weights(penalties)
    if total_w <= 0:
        warnings.append("Total incentive weight is 0. Analyzer may be meaningless.")

    # time horizon sanity
    time = spec.get("time") or {}
    horizon = time.get("horizon_steps", 0)
    if horizon and horizon < 1:
        warnings.append("time.horizon_steps must be >= 1 when provided.")

    return warnings
