import type { RuleResult, Spec } from "../spec/types";

function clamp(x: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

function severity(score: number): RuleResult["severity"] {
  if (score < 0.2) return "LOW";
  if (score < 0.5) return "MEDIUM";
  if (score < 0.8) return "HIGH";
  return "CRITICAL";
}

type Dyn = { startsAt: number; drift: number; lo: number; hi: number };

function getDyn(spec: Spec, metric: string): Dyn | null {
  const d = (spec.time?.dynamics ?? []).find((x) => x.metric === metric);
  if (!d) return null;
  const startsAt = Number(d.starts_at ?? 0);
  const drift = Number(d.drift_per_step ?? 0);
  const [lo, hi] = d.clamp ?? [0, 1];
  return { startsAt, drift, lo, hi };
}

function valueAt(d: Dyn, t: number) {
  return clamp(d.startsAt + d.drift * t, d.lo, d.hi);
}

export function runS2(spec: Spec): RuleResult {
  const fatalCount = (spec.constraints ?? []).filter((c) => c.severity === "fatal").length;
  const horizon = Math.max(1, Number(spec.time?.horizon_steps ?? 20));

  const dAuto = getDyn(spec, "automation_ratio");
  const dReview = getDyn(spec, "human_review_rate");

  if (!dAuto || !dReview) {
    const explanation = [
      !dAuto ? "Missing time.dynamics entry for automation_ratio." : "",
      !dReview ? "Missing time.dynamics entry for human_review_rate." : "",
      "S2 requires both metrics to model oversight vs automation over time.",
    ].filter(Boolean);
    const fixes = [
      !dAuto ? "Add time.dynamics for automation_ratio (starts_at, drift_per_step, clamp)." : "",
      !dReview ? "Add time.dynamics for human_review_rate (starts_at, drift_per_step, clamp)." : "",
    ].filter(Boolean);

    return {
      rule_id: "S2",
      name: "Constraint Erosion (Oversight Decay)",
      severity: "MEDIUM",
      score: 0.35,
      signals: { fatal_constraints: fatalCount, horizon_steps: horizon, note: "insufficient_time_dynamics" },
      explanation,
      suggested_fixes: fixes,
    };
  }

  // Inversion check
  let tCross: number | null = null;
  for (let t = 0; t <= horizon; t++) {
    const a = valueAt(dAuto, t);
    const r = valueAt(dReview, t);
    if (r < a) { tCross = t; break; }
  }

  // Margin check (senior-mode)
  const marginThreshold = 0.1;
  let minMargin = Number.POSITIVE_INFINITY;
  let tMin = 0;

  for (let t = 0; t <= horizon; t++) {
    const a = valueAt(dAuto, t);
    const r = valueAt(dReview, t);
    const margin = r - a;
    if (margin < minMargin) { minMargin = margin; tMin = t; }
  }

  if (tCross === null) {
    if (minMargin >= marginThreshold) {
      return {
        rule_id: "S2",
        name: "Constraint Erosion (Oversight Decay)",
        severity: "LOW",
        score: 0,
        signals: {
          fatal_constraints: fatalCount,
          horizon_steps: horizon,
          oversight_inversion: false,
          margin_threshold: marginThreshold,
          min_margin: Number(minMargin.toFixed(4)),
          t_min_margin: tMin,
        },
        explanation: [
          "Within the configured time horizon, human review does not drop below automation.",
          `Oversight margin stays >= ${marginThreshold.toFixed(2)} (min margin ${minMargin.toFixed(2)} at step ${tMin}).`,
        ],
        suggested_fixes: [],
      };
    }

    const rawScore = clamp((marginThreshold - minMargin) / marginThreshold);
    const score = Number(rawScore.toFixed(4));
    let sev = severity(score);

    if (fatalCount === 0 && (sev === "HIGH" || sev === "CRITICAL")) sev = "MEDIUM";

    return {
      rule_id: "S2",
      name: "Constraint Erosion (Oversight Decay)",
      severity: sev,
      score,
      signals: {
        fatal_constraints: fatalCount,
        horizon_steps: horizon,
        oversight_inversion: false,
        margin_threshold: marginThreshold,
        min_margin: Number(minMargin.toFixed(4)),
        t_min_margin: tMin,
      },
      explanation: [
        "No oversight inversion detected, but oversight margin becomes thin.",
        `Minimum margin (human_review_rate - automation_ratio) is ${minMargin.toFixed(2)} at step ${tMin}.`,
        `Configured margin threshold is ${marginThreshold.toFixed(2)}.`,
        "Thin margins are fragile under noise, exceptions, and measurement error—risk rises even before inversion.",
      ],
      suggested_fixes: [
        "Increase the floor for human_review_rate (e.g., clamp lower bound).",
        "Reduce automation_ratio drift or introduce staged rollout gates.",
        "Add periodic audits tied to fatal constraints (independent of incentives).",
      ],
    };
  }

  // Inversion exists: earlier inversion => higher risk
  const erosionRatio = (horizon - tCross) / horizon;
  const rawScore = clamp(erosionRatio);
  const score = Number(rawScore.toFixed(4));
  let sev = severity(score);
  if (fatalCount === 0 && (sev === "HIGH" || sev === "CRITICAL")) sev = "MEDIUM";

  const a0 = valueAt(dAuto, 0);
  const r0 = valueAt(dReview, 0);
  const aC = valueAt(dAuto, tCross);
  const rC = valueAt(dReview, tCross);

  return {
    rule_id: "S2",
    name: "Constraint Erosion (Oversight Decay)",
    severity: sev,
    score,
    signals: {
      fatal_constraints: fatalCount,
      horizon_steps: horizon,
      oversight_inversion: true,
      t_cross: tCross,
      automation_t0: Number(a0.toFixed(4)),
      review_t0: Number(r0.toFixed(4)),
      automation_at_cross: Number(aC.toFixed(4)),
      review_at_cross: Number(rC.toFixed(4)),
      margin_threshold: marginThreshold,
      min_margin: Number(minMargin.toFixed(4)),
      t_min_margin: tMin,
    },
    explanation: [
      "Oversight inversion occurs when human_review_rate < automation_ratio.",
      `Inversion detected at step ~${tCross} / ${horizon}.`,
      `At t=0: automation=${a0.toFixed(2)}, review=${r0.toFixed(2)}.`,
      `At inversion: automation=${aC.toFixed(2)}, review=${rC.toFixed(2)}.`,
      fatalCount > 0
        ? "With fatal constraints present, losing oversight increases the risk that constraints become symbolic rather than enforced."
        : "Even without fatal constraints declared, oversight decay can still increase operational and ethical risk.",
    ],
    suggested_fixes: [
      "Set a minimum floor for human_review_rate (e.g., clamp lower bound).",
      "Slow automation_ratio growth after a threshold or introduce staged rollout gates.",
      "Introduce periodic mandatory audits tied to fatal constraints (independent of incentives).",
    ],
  };
}
