"use client";

import { useMemo, useState } from "react";
import { ResultCard } from "@/components/ResultCard";
import type { RuleResult } from "@/lib/spec/types";

const DEFAULT_YAML = `version: "0.1"
intent:
  priorities:
    - safety
    - cost

constraints:
  - id: "C1"
    metric: "false_negative_rate"
    severity: "fatal"

incentives:
  rewards:
    - metric: "throughput"
      weight: 0.9
    - metric: "cost_reduction"
      weight: 0.7
  penalties:
    - metric: "false_negative_rate"
      weight: 1.4

time:
  horizon_steps: 24
  dynamics:
    - metric: "automation_ratio"
      starts_at: 0.1
      drift_per_step: 0.02
      clamp: [0.0, 1.0]
    - metric: "human_review_rate"
      starts_at: 0.9
      drift_per_step: -0.01
      clamp: [0.0, 1.0]
`;

type ApiResult = any;

export default function Page() {
  const [yamlText, setYamlText] = useState(DEFAULT_YAML);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const results = useMemo(() => {
    if (!result?.results) return [];
    return result.results as RuleResult[];
  }, [result]);

  async function onAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: yamlText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Analyze failed");
      setResult(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(to bottom, #f8fafc 0%, #ffffff 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif"
    }}>
      <main style={{ 
        maxWidth: 1400, 
        margin: "0 auto", 
        padding: "32px clamp(16px, 4vw, 32px)",
      }}>
        <header style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 0,
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
            }}>
              <span style={{ color: "#000000", fontSize: 20, fontWeight: 700 }}>RC</span>
            </div>
            <h1 style={{ 
              fontSize: 32, 
              fontWeight: 700, 
              margin: 0,
              background: "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text"
            }}>
              Reality Compiler
            </h1>
            <span style={{
              padding: "4px 10px",
              borderRadius: 0,
              fontSize: 11,
              fontWeight: 600,
              background: "#e0e7ff",
              color: "#4338ca",
              textTransform: "uppercase",
              letterSpacing: 0.5
            }}>
              MVP
            </span>
          </div>
          <p style={{ 
            margin: 0, 
            fontSize: 15,
            color: "#6b7280",
            lineHeight: 1.6,
            maxWidth: 600
          }}>
            Analyze your Reality Spec (YAML) to detect structural risk signals using S1 (Intent–Incentive Conflict) and S2 (Constraint Erosion) rules.
          </p>
        </header>

        <div className="analysis-grid">
        <div>
          <div style={{
            background: "white",
            borderRadius: 0,
            border: `1px solid ${isFocused ? "#3b82f6" : "#e5e7eb"}`,
            boxShadow: isFocused 
              ? "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 3px rgba(59, 130, 246, 0.1)"
              : "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
            overflow: "hidden",
            transition: "box-shadow 0.2s, border-color 0.2s"
          }}>
            <div style={{
              padding: "14px 18px",
              background: "linear-gradient(to right, #f8fafc, #f1f5f9)",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 0,
                  background: "#000000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 4px rgba(59, 130, 246, 0.2)"
                }}>
                  <span style={{ color: "white", fontSize: 16, fontWeight: 700 }}>Y</span>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", lineHeight: 1.2 }}>
                    Reality Spec
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    YAML Configuration
                  </div>
                </div>
              </div>
              <div style={{ 
                fontSize: 12, 
                color: "#6b7280", 
                fontFamily: "ui-monospace",
                background: "white",
                padding: "6px 10px",
                borderRadius: 0,
                border: "1px solid #e5e7eb"
              }}>
                {yamlText.split('\n').length} lines • {yamlText.length.toLocaleString()} chars
              </div>
            </div>
            <div style={{ position: "relative" }}>
              <textarea
                value={yamlText}
                onChange={(e) => setYamlText(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                spellCheck={false}
                placeholder='version: "0.1"\nintent:\n  priorities:\n    - safety\n    - cost'
                style={{
                  width: "100%",
                  minHeight: 520,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: 13,
                  lineHeight: 1.6,
                  padding: "16px 16px 16px 48px",
                  borderRadius: 0,
                  border: "none",
                  outline: "none",
                  resize: "vertical",
                  background: isFocused ? "#ffffff" : "#fafafa",
                  color: "#1f2937",
                  transition: "background-color 0.2s"
                }}
              />
              <div style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 40,
                padding: "16px 8px",
                background: isFocused ? "#f8fafc" : "#f1f5f9",
                borderRight: "1px solid #e5e7eb",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 12,
                color: "#9ca3af",
                lineHeight: 1.6,
                textAlign: "right",
                userSelect: "none",
                pointerEvents: "none",
                transition: "background-color 0.2s",
                minHeight: 520
              }}>
                {yamlText.split('\n').map((_, i) => (
                  <div key={i} style={{ minHeight: 20.8 }}>
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button
              onClick={onAnalyze}
              disabled={loading}
              style={{ 
                padding: "10px 20px", 
                borderRadius: 0, 
                border: "none",
                backgroundColor: loading ? "#333333" : "#000000",
                color: "white",
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background-color 0.2s"
              }}
            >
              {loading ? "Analyzing..." : "Analyze"}
            </button>
            <button
              onClick={() => { setYamlText(DEFAULT_YAML); setResult(null); setError(null); }}
              style={{ 
                padding: "10px 20px", 
                borderRadius: 0, 
                border: "1px solid #d1d5db",
                backgroundColor: "white",
                color: "#374151",
                fontWeight: 500,
                cursor: "pointer",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
            >
              Reset
            </button>
          </div>

          {error && (
            <div style={{ 
              marginTop: 16, 
              padding: 16, 
              borderRadius: 0, 
              background: "#fef2f2", 
              border: "2px solid #fca5a5",
              color: "#991b1b",
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
            }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 8, 
                fontWeight: 600, 
                marginBottom: 8,
                fontSize: 14
              }}>
                <span>⚠️</span>
                <span>Error</span>
              </div>
              <pre style={{ 
                margin: 0, 
                fontSize: 13, 
                whiteSpace: "pre-wrap",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                lineHeight: 1.5
              }}>{error}</pre>
            </div>
          )}
        </div>

        <div className="results-panel">
          <div style={{
            background: "white",
            borderRadius: 0,
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
            padding: 20,
            marginBottom: 16
          }}>
            <h2 style={{ 
              fontSize: 18, 
              marginTop: 0, 
              marginBottom: 20, 
              fontWeight: 600,
              color: "#1f2937",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <span style={{
                width: 4,
                height: 20,
                borderRadius: 0,
                background: "#000000"
              }} />
              Analysis Results
            </h2>
            
            {results.length === 0 && (
              <div style={{ 
                padding: 40, 
                borderRadius: 0, 
                background: "#f9fafb", 
                border: "2px dashed #e5e7eb",
                textAlign: "center",
                color: "#6b7280"
              }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>No results yet</p>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, opacity: 0.8 }}>Run an analysis to see results</p>
              </div>
            )}

            <div style={{ 
              maxHeight: "calc(100vh - 200px)",
              overflowY: "auto",
              paddingRight: 4
            }}>
              {results.map((result) => (
                <ResultCard key={result.rule_id} result={result} />
              ))}

              {result && results.length > 0 && (
                <details style={{ marginTop: 16 }}>
                  <summary style={{ 
                    cursor: "pointer", 
                    fontSize: 13, 
                    fontWeight: 500, 
                    color: "#6b7280",
                    padding: "10px 12px",
                    borderRadius: 0,
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    userSelect: "none",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#f9fafb"}
                  >
                    View Raw JSON
                  </summary>
                  <pre style={{ 
                    marginTop: 8,
                    padding: 12, 
                    borderRadius: 0, 
                    background: "#f7f7f7", 
                    border: "1px solid #e5e7eb", 
                    overflow: "auto", 
                    maxHeight: 400,
                    fontSize: 11,
                    lineHeight: 1.5,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                  }}>
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
    </div>
  );
}
