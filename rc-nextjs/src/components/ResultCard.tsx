import type { RuleResult } from "@/lib/spec/types";

type ResultCardProps = {
  result: RuleResult;
};

const severityColors = {
  LOW: {
    bg: "#f0fdf4",
    border: "#86efac",
    text: "#166534",
    badge: "#22c55e",
  },
  MEDIUM: {
    bg: "#fff7ed",
    border: "#fdba74",
    text: "#9a3412",
    badge: "#f97316",
  },
  HIGH: {
    bg: "#fef2f2",
    border: "#fca5a5",
    text: "#991b1b",
    badge: "#ef4444",
  },
  CRITICAL: {
    bg: "#fef2f2",
    border: "#f87171",
    text: "#7f1d1d",
    badge: "#dc2626",
  },
};

export function ResultCard({ result }: ResultCardProps) {
  const colors = severityColors[result.severity];
  const scorePercent = Math.round(result.score * 100);

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 0,
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.bg,
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <strong style={{ fontSize: 16, color: colors.text }}>
              {result.rule_id} — {result.name}
            </strong>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 0,
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: colors.badge,
                color: "white",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {result.severity}
            </span>
          </div>
          <div style={{ fontSize: 13, color: colors.text, opacity: 0.8 }}>
            Score: {result.score.toFixed(4)} ({scorePercent}%)
          </div>
        </div>
      </div>

      {result.explanation && result.explanation.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 6 }}>Explanation:</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
            {result.explanation.map((x, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {x}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.suggested_fixes && result.suggested_fixes.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 6 }}>Suggested Fixes:</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
            {result.suggested_fixes.map((x, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {x}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

