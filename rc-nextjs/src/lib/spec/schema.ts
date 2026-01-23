import { z } from "zod";

export const SpecSchema = z.object({
  version: z.string(),
  world: z
    .object({ name: z.string().optional(), description: z.string().optional() })
    .optional(),
  intent: z.object({
    priorities: z.array(z.string()).min(1),
  }),
  constraints: z
    .array(
      z.object({
        id: z.string().optional(),
        description: z.string().optional(),
        metric: z.string(),
        op: z.string().optional(),
        value: z.number().optional(),
        severity: z.enum(["fatal", "warn", "info"]).optional(),
      })
    )
    .optional(),
  incentives: z.object({
    rewards: z
      .array(z.object({ metric: z.string(), weight: z.number() }))
      .optional(),
    penalties: z
      .array(z.object({ metric: z.string(), weight: z.number() }))
      .optional(),
  }),
  time: z
    .object({
      horizon_steps: z.number().int().positive().optional(),
      dynamics: z
        .array(
          z.object({
            metric: z.string(),
            starts_at: z.number().optional(),
            drift_per_step: z.number().optional(),
            clamp: z.tuple([z.number(), z.number()]).optional(),
          })
        )
        .optional(),
    })
    .optional(),
});
