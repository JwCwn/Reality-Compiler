export type Bucket = "safety" | "cost" | "speed" | "fairness" | "unknown";

const metricBucket: Record<string, Bucket> = {
  // safety
  false_negative_rate: "safety",
  readmission_rate: "safety",
  harm_rate: "safety",
  incident_rate: "safety",

  // cost
  cost_reduction: "cost",
  cost: "cost",
  profit: "cost",
  opex: "cost",

  // speed
  throughput: "speed",
  latency: "speed",
  discharge_speed: "speed",
  tickets_closed: "speed",

  // fairness
  demographic_parity: "fairness",
  equal_opportunity_gap: "fairness",
};

const intentBucket: Record<string, Bucket> = {
  safety: "safety",
  reliability: "safety",
  cost: "cost",
  fairness: "fairness",
  speed: "speed",
  throughput: "speed",
};

export function bucketForMetric(metric: string): Bucket {
  return metricBucket[metric] ?? "unknown";
}

export function bucketForIntent(intent: string): Bucket {
  return intentBucket[intent] ?? "unknown";
}
