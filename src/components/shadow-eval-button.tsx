"use client";

import { CheckCircle, Loader2, PlayCircle, XCircle } from "lucide-react";
// src/components/shadow-eval-button.tsx
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { handleError } from "@/lib/utils/error-handling";

interface ShadowEvalButtonProps {
  evaluationId: number;
  disabled?: boolean;
}

/**
 * "Run against Production Logs" button (Section 4.2c).
 * Triggers a shadow eval that replays production traces through the current prompt.
 */
export function ShadowEvalButton({ evaluationId, disabled }: ShadowEvalButtonProps) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<{ matched: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const run = async () => {
    setStatus("running");
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await fetch(`/api/evaluations/${evaluationId}/shadow`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Shadow eval failed");
      setResult({ matched: data.matched ?? 0, total: data.total ?? 0 });
      setStatus("done");
    } catch (e: unknown) {
      setErrorMsg(handleError(e));
      setStatus("error");
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={run}
        disabled={disabled || status === "running"}
        className="text-xs"
      >
        {status === "running" ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running Shadow Eval…
          </>
        ) : (
          <>
            <PlayCircle className="h-3 w-3 mr-1" /> Run against Production Logs
          </>
        )}
      </Button>

      {status === "done" && result && (
        <Badge className="bg-green-500/10 text-green-400 border border-green-500/30 text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          {result.matched}/{result.total} matched
        </Badge>
      )}

      {status === "error" && (
        <Badge className="bg-red-500/10 text-red-400 border border-red-500/30 text-xs">
          <XCircle className="h-3 w-3 mr-1" />
          {errorMsg || "Failed"}
        </Badge>
      )}
    </div>
  );
}
