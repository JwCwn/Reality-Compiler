import type { RuleResult, Spec } from "../spec/types";
import { bucketForIntent, bucketForMetric } from "../spec/taxonomy";

function clamp(x: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

function severity(score: number): RuleResult["severity"] {
  if (score < 0.2) return "LOW";
  if (score < 0.45) return "MEDIUM";
  if (score < 0.7) return "HIGH";
  return "CRITICAL";
}

function timeAmplification(spec: Spec): number {
  const dyn = spec.time?.dynamics ?? [];
  let taf = 1.0;
  const autoInc = dyn.some((d) => d.metric === "automation_ratio" && (d.drift_per_step ?? 0) > 0);
  const reviewDec = dyn.some((d) => d.metric === "human_review_rate" && (d.drift_per_step ?? 0) < 0);
  if (autoInc) taf += 0.25;
  if (reviewDec) taf += 0.25;
  return taf;
}

export function runS1(spec: Spec): RuleResult {
  const priorities = spec.intent?.priorities ?? [];
  if (priorities.length === 0) {
    return {
      rule_id: "S1",
      name: "Intent–Incentive Conflict",
      severity: "MEDIUM",
      score: 0.4,
      signals: { reason: "Missing intent.priorities" },
      explanation: ["Spec missing intent.priorities; cannot assess reinforcement accurately."],
      suggested_fixes: ["Add intent.priorities with top-level intent first."],
    };
  }

  const I0 = priorities[0];
  const I0Bucket = bucketForIntent(I0);

  const rewards = spec.incentives?.rewards ?? [];
  const penalties = spec.incentives?.penalties ?? [];
  const all = [...rewards, ...penalties];

  const bucketW = new Map<string, number>();
  let total = 0;

  for (const it of all) {
    const w = Math.abs(Number(it.weight ?? 0));
    const b = bucketForMetric(it.metric);
    bucketW.set(b, (bucketW.get(b) ?? 0) + w);
    total += w;
  }

  if (total <= 0) {
    return {
      rule_id: "S1",
      name: "Intent–Incentive Conflict",
      severity: "MEDIUM",
      score: 0.35,
      signals: { top_intent: I0, note: "Total incentive weight is 0" },
      explanation: ["Incentive weights sum to 0; cannot compute dominance."],
      suggested_fixes: ["Add incentives.rewards/penalties with non-zero weights."],
    };
  }

  const dominant = [...bucketW.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const dominanceRatio = (bucketW.get(dominant) ?? 0) / total;
  const intentReinf = (bucketW.get(I0Bucket) ?? 0) / total;

  const constraints = spec.constraints ?? [];
  const fatalI0 = constraints.filter(
    (c) => c.severity === "fatal" && bucketForMetric(c.metric) === I0Bucket
  );
  const metricsInIncentives = new Set(all.map((x) => x.metric));
  const covered = fatalI0.filter((c) => metricsInIncentives.has(c.metric)).length;
  const coverageRatio = fatalI0.length === 0 ? 1 : covered / fatalI0.length;
  const coveragePenalty = fatalI0.length === 0 ? 0 : 1 - coverageRatio;

  const conflictBase = dominant !== I0Bucket ? Math.max(0, dominanceRatio - intentReinf) : 0;
  const taf = timeAmplification(spec);

  let score = taf * (0.6 * conflictBase + 0.4 * coveragePenalty);
  score = clamp(score);
  const sev = severity(score);

  const explanation: string[] = [];
  if (dominant !== I0Bucket) explanation.push(`Reward structure is dominated by '${dominant}' rather than top intent '${I0Bucket}'.`);
  explanation.push(`Top intent reinforcement is ${intentReinf.toFixed(2)} of total incentive weight.`);
  if (fatalI0.length > 0) explanation.push(`Fatal constraint coverage for top intent is ${covered}/${fatalI0.length}.`);
  if (taf > 1) explanation.push("Time dynamics amplify drift (automation↑ and/or human review↓).");

  const fixes: string[] = [];
  if (dominant !== I0Bucket) fixes.push(`Rebalance incentives: reduce weight on '${dominant}' metrics or add weight to '${I0Bucket}' metrics.`);
  if (fatalI0.length > 0 && covered === 0) fixes.push("Tie incentives/penalties directly to fatal constraint metrics (guardrail reinforcement).");
  if (taf > 1) fixes.push("Cap automation growth or preserve human review to reduce amplification.");

  return {
    rule_id: "S1",
    name: "Intent–Incentive Conflict",
    severity: sev,
    score: Number(score.toFixed(4)),
    signals: {
      top_intent: I0,
      top_intent_bucket: I0Bucket,
      dominant_bucket: dominant,
      dominance_ratio: Number(dominanceRatio.toFixed(4)),
      intent_reinforcement: Number(intentReinf.toFixed(4)),
      fatal_constraint_coverage_ratio: Number(coverageRatio.toFixed(4)),
      time_amplification_factor: Number(taf.toFixed(4)),
    },
    explanation,
    suggested_fixes: fixes,
  };
}
