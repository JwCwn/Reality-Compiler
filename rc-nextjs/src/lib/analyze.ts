import type { RuleResult, Spec } from "./spec/types";
import { runS1 } from "./rules/s1";
import { runS2 } from "./rules/s2";

export function analyzeSpec(spec: Spec): { results: RuleResult[] } {
  return { results: [runS1(spec), runS2(spec)] };
}
