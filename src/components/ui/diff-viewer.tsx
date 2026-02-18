"use client";

// src/components/ui/diff-viewer.tsx
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DiffViewerProps {
  expected: string;
  actual: string;
  label?: string;
  score?: number;
}

interface DiffLine {
  type: "equal" | "added" | "removed";
  text: string;
}

/**
 * Visual diff component that shows expected vs actual output
 * with line-by-line highlighting. Used in Ground Truth diffing (Section 2.1a).
 */
export function DiffViewer({ expected, actual, label, score }: DiffViewerProps) {
  const diff = useMemo(() => computeDiff(expected, actual), [expected, actual]);

  const addedCount = diff.filter((l) => l.type === "added").length;
  const removedCount = diff.filter((l) => l.type === "removed").length;

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{label || "Diff"}</CardTitle>
          <div className="flex items-center gap-2">
            {score !== undefined && (
              <Badge
                variant="outline"
                className={
                  score >= 70
                    ? "text-green-400 border-green-400/30"
                    : "text-red-400 border-red-400/30"
                }
              >
                {score}%
              </Badge>
            )}
            <span className="text-xs text-green-500">+{addedCount}</span>
            <span className="text-xs text-red-500">-{removedCount}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="font-mono text-xs overflow-x-auto rounded-lg bg-zinc-950 p-3 max-h-96 overflow-y-auto">
          {diff.map((line, i) => (
            <div
              key={i}
              className={`px-2 py-0.5 whitespace-pre-wrap ${
                line.type === "added"
                  ? "bg-green-500/10 text-green-400"
                  : line.type === "removed"
                    ? "bg-red-500/10 text-red-400"
                    : "text-zinc-400"
              }`}
            >
              <span className="inline-block w-4 mr-2 text-zinc-600 select-none">
                {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
              </span>
              {line.text || "\u00A0"}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Simple line-based diff algorithm.
 * Compares lines of expected vs actual and marks additions/removals.
 */
function computeDiff(expected: string, actual: string): DiffLine[] {
  const expLines = expected.split("\n");
  const actLines = actual.split("\n");
  const result: DiffLine[] = [];

  const maxLen = Math.max(expLines.length, actLines.length);

  for (let i = 0; i < maxLen; i++) {
    const exp = expLines[i];
    const act = actLines[i];

    if (exp === undefined) {
      result.push({ type: "added", text: act });
    } else if (act === undefined) {
      result.push({ type: "removed", text: exp });
    } else if (exp === act) {
      result.push({ type: "equal", text: exp });
    } else {
      result.push({ type: "removed", text: exp });
      result.push({ type: "added", text: act });
    }
  }

  return result;
}
