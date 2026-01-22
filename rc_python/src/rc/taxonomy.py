from dataclasses import dataclass


@dataclass(frozen=True)
class Taxonomy:
    # map metric -> bucket
    metric_bucket: dict[str, str]
    # map intent keyword -> bucket
    intent_bucket: dict[str, str]


def default_taxonomy_v01() -> Taxonomy:
    metric_bucket = {
        # safety
        "false_negative_rate": "safety",
        "readmission_rate": "safety",
        "harm_rate": "safety",
        "incident_rate": "safety",
        # cost
        "cost_reduction": "cost",
        "cost": "cost",
        "profit": "cost",
        "opex": "cost",
        # speed/throughput
        "throughput": "speed",
        "latency": "speed",
        "discharge_speed": "speed",
        "tickets_closed": "speed",
        # fairness
        "demographic_parity": "fairness",
        "equal_opportunity_gap": "fairness",
    }

    intent_bucket = {
        "safety": "safety",
        "reliability": "safety",
        "cost": "cost",
        "fairness": "fairness",
        "speed": "speed",
        "throughput": "speed",
    }

    return Taxonomy(metric_bucket=metric_bucket, intent_bucket=intent_bucket)


def bucket_for_intent(intent_name: str, tax: Taxonomy) -> str:
    return tax.intent_bucket.get(intent_name, intent_name)


def bucket_for_metric(metric: str, tax: Taxonomy) -> str:
    return tax.metric_bucket.get(metric, "unknown")
