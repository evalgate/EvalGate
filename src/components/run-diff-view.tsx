"use client";

import { useEffect, useState } from "react";

type ResultRow = {
  testCaseId?: number;
  status?: string;
  output?: string;
  test_cases?: { name?: string; input?: string; expectedOutput?: string };
};

export function RunDiffView({
  evaluationId,
  runId,
  compareRunId,
}: {
  evaluationId: string;
  runId: number;
  compareRunId: number;
}) {
  const [data, setData] = useState<{
    results: ResultRow[];
    baselineResults: ResultRow[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/evaluations/${evaluationId}/runs/${runId}?compareRunId=${compareRunId}`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json.baselineResults && json.results) {
          setData({ results: json.results, baselineResults: json.baselineResults });
        } else {
          setError("No baseline data");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [evaluationId, runId, compareRunId]);

  if (loading) return <p className="text-xs text-muted-foreground mt-1">Loading diff…</p>;
  if (error) return <p className="text-xs text-destructive mt-1">Diff error: {error}</p>;
  if (!data) return null;

  const byCase = new Map<number, { current?: ResultRow; baseline?: ResultRow }>();
  for (const r of data.results) {
    if (r.testCaseId != null) {
      byCase.set(r.testCaseId, { ...byCase.get(r.testCaseId), current: r });
    }
  }
  for (const r of data.baselineResults) {
    if (r.testCaseId != null) {
      const entry = byCase.get(r.testCaseId) ?? {};
      byCase.set(r.testCaseId, { ...entry, baseline: r });
    }
  }

  const failedCases = [...byCase.entries()].filter(
    ([_, { current }]) => current?.status === "failed",
  );

  if (failedCases.length === 0) {
    return <p className="text-xs text-muted-foreground mt-1">No failing cases to diff.</p>;
  }

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Side-by-side (failing cases only)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-1 font-medium">Case</th>
              <th className="text-left p-1 font-medium">Expected</th>
              <th className="text-left p-1 font-medium">Baseline</th>
              <th className="text-left p-1 font-medium">Current</th>
            </tr>
          </thead>
          <tbody>
            {failedCases.map(([tcId, { current, baseline }]) => (
              <tr key={tcId} className="border-b">
                <td className="p-1 align-top">{current?.test_cases?.name ?? `#${tcId}`}</td>
                <td
                  className="p-1 align-top max-w-[120px] truncate"
                  title={current?.test_cases?.expectedOutput}
                >
                  {current?.test_cases?.expectedOutput ?? "—"}
                </td>
                <td
                  className="p-1 align-top max-w-[120px] truncate bg-muted/50"
                  title={baseline?.output}
                >
                  {baseline?.output ?? "—"}
                </td>
                <td
                  className="p-1 align-top max-w-[120px] truncate bg-destructive/10"
                  title={current?.output}
                >
                  {current?.output ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
