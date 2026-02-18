"use client";

import { CheckCircle, Loader2, XCircle } from "lucide-react";
// src/components/regression-badge.tsx
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface RegressionBadgeProps {
  evaluationId: number;
  /** If provided, shows static status. Otherwise fetches on mount. */
  initialStatus?: "passed" | "failed" | null;
}

export function RegressionBadge({ evaluationId, initialStatus }: RegressionBadgeProps) {
  const [status, setStatus] = useState<"idle" | "running" | "passed" | "failed">(
    initialStatus ?? "idle",
  );
  const [score, setScore] = useState<number | null>(null);

  const runCheck = async () => {
    setStatus("running");
    try {
      const res = await fetch(`/api/evaluations/${evaluationId}/regression`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus(data.status);
      setScore(data.avgScore);
    } catch {
      setStatus("failed");
    }
  };

  if (status === "idle") {
    return (
      <Badge
        variant="outline"
        className="cursor-pointer hover:bg-zinc-800 text-zinc-400"
        onClick={runCheck}
      >
        Run Regression Check
      </Badge>
    );
  }

  if (status === "running") {
    return (
      <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Checking…
      </Badge>
    );
  }

  if (status === "passed") {
    return (
      <Badge className="bg-green-500/10 text-green-400 border border-green-500/30">
        <CheckCircle className="h-3 w-3 mr-1" />
        Regression Passed {score !== null && `(${score}%)`}
      </Badge>
    );
  }

  return (
    <Badge className="bg-red-500/10 text-red-400 border border-red-500/30">
      <XCircle className="h-3 w-3 mr-1" />
      Regression Failed {score !== null && `(${score}%)`}
    </Badge>
  );
}
