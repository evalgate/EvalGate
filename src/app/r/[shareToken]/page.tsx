/**
 * One-click Audit Link page
 * Public /r/:shareToken — stakeholder can open and understand risk in 30 seconds.
 */

import { AlertTriangle, CheckCircle, Hash, Shield } from "lucide-react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function fetchReport(shareToken: string, baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/r/${shareToken}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.report ?? null;
}

export default async function AuditLinkPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`;

  const report = await fetchReport(shareToken, baseUrl);
  if (!report) return notFound();

  const org = report.organization ?? {};
  const eval_ = report.evaluation ?? {};
  const run = report.run ?? {};
  const qs = report.qualityScore ?? {};
  const baseline = report.baseline ?? null;
  const flags = (qs.flags as string[]) ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 to-zinc-900 text-white">
      <div className="max-w-2xl mx-auto py-12 px-6">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Shield className="h-6 w-6 text-blue-500" />
          <span className="text-sm font-mono text-zinc-400 uppercase tracking-wider">
            EvalAI Audit Link
          </span>
        </div>

        <h1 className="text-2xl font-bold mb-1">{eval_.name ?? "Evaluation"}</h1>
        {org.name && <p className="text-zinc-400 text-sm mb-6">{org.name}</p>}

        {/* Quality Score + Flags */}
        <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-4xl font-bold text-green-400">{qs.score ?? "—"}</div>
                <div className="text-sm text-zinc-500">Quality Score</div>
              </div>
              {flags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {flags.map((f: string) => (
                    <Badge
                      key={f}
                      variant={f === "SAFETY_RISK" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {f}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Baseline comparison */}
        {baseline && (
          <Card
            className={`mb-6 border ${
              baseline.regressionDetected
                ? "border-red-500/50 bg-red-500/5"
                : "border-zinc-800 bg-zinc-900/50"
            }`}
          >
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-2 mb-2">
                {baseline.regressionDetected ? (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                <span className="font-medium">
                  {baseline.regressionDetected ? "Regression detected" : "No regression"}
                </span>
              </div>
              <div className="text-sm text-zinc-400">
                Baseline: {baseline.baselineScore} · Delta:{" "}
                {baseline.regressionDelta >= 0 ? "+" : ""}
                {baseline.regressionDelta} pts
              </div>
            </CardContent>
          </Card>
        )}

        {/* Provenance coverage + hashes */}
        <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Hash className="h-4 w-4" /> Provenance & Audit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {qs.provenanceCoverageRate != null && (
              <div className="flex items-center justify-between rounded-md bg-zinc-800/50 px-3 py-2">
                <span className="text-sm text-zinc-400">Provenance coverage</span>
                <span className="text-sm font-medium">
                  {Math.round(parseFloat(qs.provenanceCoverageRate) * 100)}%
                </span>
              </div>
            )}
            <div className="space-y-2 text-xs font-mono text-zinc-400">
              {qs.scoringSpecHash && (
                <div>
                  <span className="text-zinc-500">scoringSpecHash:</span>{" "}
                  <span className="break-all">{qs.scoringSpecHash}</span>
                </div>
              )}
              {qs.scoringCommit && (
                <div>
                  <span className="text-zinc-500">scoringCommit:</span> {qs.scoringCommit}
                </div>
              )}
              {qs.inputsHash && (
                <div>
                  <span className="text-zinc-500">inputsHash:</span>{" "}
                  <span className="break-all">{qs.inputsHash}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Run summary */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6 pb-6">
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <div className="text-xl font-bold">{run.totalCases ?? 0}</div>
                <div className="text-zinc-500">Total</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-400">{run.passedCases ?? 0}</div>
                <div className="text-zinc-500">Passed</div>
              </div>
              <div>
                <div className="text-xl font-bold text-red-400">{run.failedCases ?? 0}</div>
                <div className="text-zinc-500">Failed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-zinc-600 mt-8">
          Verified by EvalAI ·{" "}
          {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : ""}
        </p>
      </div>
    </div>
  );
}
