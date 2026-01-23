export type Constraint = {
    id?: string;
    description?: string;
    metric: string;
    op?: string;
    value?: number;
    severity?: "fatal" | "warn" | "info";
  };
  
  export type Incentive = { metric: string; weight: number };
  
  export type Spec = {
    version: string;
    world?: { name?: string; description?: string };
    intent: { priorities: string[] };
    constraints?: Constraint[];
    incentives: { rewards?: Incentive[]; penalties?: Incentive[] };
    time?: {
      horizon_steps?: number;
      dynamics?: Array<{
        metric: string;
        starts_at?: number;
        drift_per_step?: number;
        clamp?: [number, number];
      }>;
    };
  };
  
  export type RuleResult = {
    rule_id: "S1" | "S2";
    name: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    score: number;
    signals: Record<string, unknown>;
    explanation: string[];
    suggested_fixes: string[];
  };
  