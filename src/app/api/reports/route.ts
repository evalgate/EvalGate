/**
 * Reports API
 *
 * POST /api/reports — create a signed report
 * GET  /api/reports — list org's shared reports
 */

import crypto, { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  driftAlerts,
  evaluationRuns,
  evaluations,
  evaluationVersions,
  organizations,
  qualityScores,
  sharedReports,
  testResults,
} from "@/db/schema";
import { notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { SCOPES } from "@/lib/auth/scopes";
import { deriveReportSecret, signReport } from "@/lib/reports/sign";

export const POST = secureRoute(
  async (req: NextRequest, ctx: AuthContext) => {
    const body = await req.json();
    const { evaluationId, evaluationRunId } = body;

    if (!evaluationId || !evaluationRunId) {
      return validationError("evaluationId and evaluationRunId are required");
    }

    // Verify eval belongs to org
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(
        and(eq(evaluations.id, evaluationId), eq(evaluations.organizationId, ctx.organizationId)),
      )
      .limit(1);

    if (!evaluation) return notFound("Evaluation not found");

    // Verify run belongs to eval
    const [run] = await db
      .select()
      .from(evaluationRuns)
      .where(eq(evaluationRuns.id, evaluationRunId))
      .limit(1);

    if (!run || run.evaluationId !== evaluationId) return notFound("Evaluation run not found");

    // Gather quality score
    const [qs] = await db
      .select()
      .from(qualityScores)
      .where(
        and(
          eq(qualityScores.evaluationRunId, evaluationRunId),
          eq(qualityScores.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);

    // Gather test results
    const results = await db
      .select()
      .from(testResults)
      .where(eq(testResults.evaluationRunId, evaluationRunId));

    // Fetch org info
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, ctx.organizationId))
      .limit(1);

    // Fetch latest published version snapshot (if any)
    let snapshotHash: string | null = null;
    let publishedVersion: number | null = null;
    if (evaluation.publishedVersion) {
      const [ver] = await db
        .select()
        .from(evaluationVersions)
        .where(
          and(
            eq(evaluationVersions.evaluationId, evaluationId),
            eq(evaluationVersions.version, evaluation.publishedVersion),
          ),
        )
        .limit(1);
      if (ver) {
        publishedVersion = ver.version;
        const snapshotStr =
          typeof ver.snapshotJson === "string"
            ? ver.snapshotJson
            : JSON.stringify(ver.snapshotJson);
        snapshotHash = crypto.createHash("sha256").update(snapshotStr).digest("hex");
      }
    }

    // Fetch drift status (latest unacknowledged alert for this evaluation)
    const [driftAlert] = await db
      .select()
      .from(driftAlerts)
      .where(
        and(
          eq(driftAlerts.evaluationId, evaluationId),
          eq(driftAlerts.organizationId, ctx.organizationId),
        ),
      )
      .orderBy(desc(driftAlerts.createdAt))
      .limit(1);

    // Baseline comparison (published run if set)
    let baselineScore: number | null = null;
    let regressionDelta: number | null = null;
    let regressionDetected = false;
    if (evaluation.publishedRunId && evaluation.publishedRunId !== evaluationRunId) {
      const [baselineQs] = await db
        .select()
        .from(qualityScores)
        .where(
          and(
            eq(qualityScores.evaluationRunId, evaluation.publishedRunId),
            eq(qualityScores.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (baselineQs && qs) {
        baselineScore = baselineQs.score;
        regressionDelta = qs.score - baselineQs.score;
        regressionDetected = regressionDelta <= -5;
      }
    }

    // Build audit-defensible report payload
    const reportPayload = {
      signatureAlgorithm: "hmac-sha256-v1",
      version: "2.0",
      generatedAt: new Date().toISOString(),
      organization: {
        id: ctx.organizationId,
        name: org?.name ?? "Unknown",
      },
      evaluation: {
        id: evaluation.id,
        name: evaluation.name,
        type: evaluation.type,
        status: evaluation.status,
        publishedVersion,
        snapshotHash,
      },
      run: {
        id: run.id,
        status: run.status,
        totalCases: run.totalCases,
        passedCases: run.passedCases,
        failedCases: run.failedCases,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      },
      qualityScore: qs
        ? {
            score: qs.score,
            breakdown: qs.breakdown,
            flags: qs.flags,
            scoringVersion: qs.scoringVersion ?? "v1",
            scoringSpecHash: qs.scoringSpecHash ?? null,
            scoringCommit: qs.scoringCommit ?? null,
            inputsHash: qs.inputsHash ?? null,
            provenanceCoverageRate: qs.provenanceCoverageRate ?? null,
          }
        : null,
      testResultsSummary: {
        total: results.length,
        passed: results.filter((r) => r.status === "passed").length,
        failed: results.filter((r) => r.status === "failed").length,
      },
      drift: driftAlert
        ? {
            alertType: driftAlert.alertType,
            severity: driftAlert.severity,
            explanation: driftAlert.explanation,
            detectedAt: driftAlert.createdAt,
            acknowledged: !!driftAlert.acknowledgedAt,
          }
        : null,
      policyResult: body.policyName
        ? {
            policy: body.policyName,
            compliant: qs ? !(qs.flags as string[] | null)?.includes("SAFETY_RISK") : null,
          }
        : null,
      baseline:
        baselineScore != null
          ? {
              baselineScore,
              regressionDelta: regressionDelta ?? 0,
              regressionDetected,
            }
          : null,
    };

    const secret = deriveReportSecret(ctx.organizationId);
    const { body: reportBody, sig } = signReport(reportPayload, secret);

    const shareToken = randomBytes(16).toString("hex");
    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 86400000).toISOString()
      : null;

    await db.insert(sharedReports).values({
      organizationId: ctx.organizationId,
      evaluationId,
      evaluationRunId,
      shareToken,
      reportBody,
      signature: sig,
      expiresAt,
      createdBy: ctx.userId,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        shareToken,
        shareUrl: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/r/${shareToken}`,
        apiUrl: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/r/${shareToken}`,
        expiresAt,
      },
      { status: 201 },
    );
  },
  { requiredScopes: [SCOPES.REPORTS_WRITE] },
);

export const GET = secureRoute(
  async (req: NextRequest, ctx: AuthContext) => {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const reports = await db
      .select()
      .from(sharedReports)
      .where(eq(sharedReports.organizationId, ctx.organizationId))
      .orderBy(desc(sharedReports.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ data: reports, count: reports.length });
  },
  { requiredScopes: [SCOPES.RUNS_READ] },
);
