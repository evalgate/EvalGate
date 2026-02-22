/**
 * Drift Detection Service
 *
 * Detects model quality drift by computing z-scores on
 * quality score trends and triggering alerts.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { driftAlerts, evaluations, qualityScores } from "@/db/schema";
import { meanAndStd, zScore } from "@/lib/drift/zscore";
import { logger } from "@/lib/logger";

interface QualityScoreData {
  id: number;
  evaluationId: number;
  organizationId: number;
  model: string | null;
  score: number;
  breakdown: unknown;
  createdAt: Date | string;
}

export type AlertType = "quality_drop" | "safety_spike" | "cost_spike" | "judge_shift";
export type Severity = "info" | "warning" | "critical";

interface DetectionResult {
  alertsCreated: number;
  evaluationsChecked: number;
  alerts: Array<{
    evaluationId: number;
    alertType: AlertType;
    severity: Severity;
    explanation: string;
  }>;
}

export class DriftService {
  private readonly MIN_HISTORY = 5;
  private readonly Z_THRESHOLD_WARNING = -1.5;
  private readonly Z_THRESHOLD_CRITICAL = -2.0;

  /**
   * Run drift detection for all evaluations in an organization.
   */
  async detectDrift(organizationId: number): Promise<DetectionResult> {
    logger.info("Running drift detection", { organizationId });

    const orgEvals = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.organizationId, organizationId));

    const result: DetectionResult = {
      alertsCreated: 0,
      evaluationsChecked: 0,
      alerts: [],
    };

    for (const evaluation of orgEvals) {
      const scores = await db
        .select()
        .from(qualityScores)
        .where(
          and(
            eq(qualityScores.evaluationId, evaluation.id),
            eq(qualityScores.organizationId, organizationId),
          ),
        )
        .orderBy(desc(qualityScores.createdAt))
        .limit(50);

      if (scores.length < this.MIN_HISTORY) continue;
      result.evaluationsChecked++;

      const latest = scores[0];
      const historical = scores.slice(1);

      // Quality score drift
      const qualityValues = historical.map((s) => s.score);
      const { mean, std } = meanAndStd(qualityValues);
      const z = zScore(latest.score, mean, std);

      if (z <= this.Z_THRESHOLD_CRITICAL) {
        const alert = {
          evaluationId: evaluation.id,
          alertType: "quality_drop" as AlertType,
          severity: "critical" as Severity,
          explanation: `Quality score dropped to ${latest.score} (mean: ${mean.toFixed(1)}, z-score: ${z.toFixed(2)}). This is a significant regression.`,
        };
        await this.createAlert(organizationId, alert, latest, mean, z);
        result.alerts.push(alert);
        result.alertsCreated++;
      } else if (z <= this.Z_THRESHOLD_WARNING) {
        const alert = {
          evaluationId: evaluation.id,
          alertType: "quality_drop" as AlertType,
          severity: "warning" as Severity,
          explanation: `Quality score dipped to ${latest.score} (mean: ${mean.toFixed(1)}, z-score: ${z.toFixed(2)}). Monitor for continued decline.`,
        };
        await this.createAlert(organizationId, alert, latest, mean, z);
        result.alerts.push(alert);
        result.alertsCreated++;
      }

      // Safety drift (check breakdown)
      const latestBreakdown =
        typeof latest.breakdown === "string" ? JSON.parse(latest.breakdown) : latest.breakdown;

      if ((latestBreakdown as any)?.safety !== undefined) {
        const safetyValues = historical.map((s) => {
          const bd = typeof s.breakdown === "string" ? JSON.parse(s.breakdown) : s.breakdown;
          return (bd as any)?.safety ?? 1;
        });
        const safetyStats = meanAndStd(safetyValues);
        const safetyZ = zScore(latestBreakdown.safety, safetyStats.mean, safetyStats.std);

        if (safetyZ <= this.Z_THRESHOLD_CRITICAL) {
          const alert = {
            evaluationId: evaluation.id,
            alertType: "safety_spike" as AlertType,
            severity: "critical" as Severity,
            explanation: `Safety score dropped to ${(latestBreakdown.safety * 100).toFixed(0)}% (mean: ${(safetyStats.mean * 100).toFixed(0)}%). Immediate attention required.`,
          };
          await this.createAlert(organizationId, alert, latest, safetyStats.mean, safetyZ);
          result.alerts.push(alert);
          result.alertsCreated++;
        }
      }

      // Cost drift (check breakdown)
      if ((latestBreakdown as any)?.cost !== undefined) {
        const costValues = historical.map((s) => {
          const bd = typeof s.breakdown === "string" ? JSON.parse(s.breakdown) : s.breakdown;
          return (bd as any)?.cost ?? 1;
        });
        const costStats = meanAndStd(costValues);
        const costZ = zScore(latestBreakdown.cost, costStats.mean, costStats.std);

        if (costZ <= this.Z_THRESHOLD_CRITICAL) {
          const alert = {
            evaluationId: evaluation.id,
            alertType: "cost_spike" as AlertType,
            severity: "warning" as Severity,
            explanation: `Cost score dropped to ${(latestBreakdown.cost * 100).toFixed(0)}% (mean: ${(costStats.mean * 100).toFixed(0)}%). Costs may be spiking.`,
          };
          await this.createAlert(organizationId, alert, latest, costStats.mean, costZ);
          result.alerts.push(alert);
          result.alertsCreated++;
        }
      }
    }

    logger.info("Drift detection complete", {
      organizationId,
      evaluationsChecked: result.evaluationsChecked,
      alertsCreated: result.alertsCreated,
    });

    return result;
  }

  /**
   * List drift alerts for an organization.
   */
  async listAlerts(
    organizationId: number,
    options?: {
      evaluationId?: number;
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = Math.min(options?.limit ?? 50, 100);
    const offset = options?.offset ?? 0;

    const conditions = [eq(driftAlerts.organizationId, organizationId)];
    if (options?.evaluationId) {
      conditions.push(eq(driftAlerts.evaluationId, options.evaluationId));
    }

    return db
      .select()
      .from(driftAlerts)
      .where(and(...conditions))
      .orderBy(desc(driftAlerts.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Acknowledge an alert.
   */
  async acknowledgeAlert(alertId: number, organizationId: number) {
    const [alert] = await db
      .select()
      .from(driftAlerts)
      .where(and(eq(driftAlerts.id, alertId), eq(driftAlerts.organizationId, organizationId)))
      .limit(1);

    if (!alert) return null;

    await db
      .update(driftAlerts)
      .set({ acknowledgedAt: new Date().toISOString() })
      .where(eq(driftAlerts.id, alertId));

    return { ...alert, acknowledgedAt: new Date().toISOString() };
  }

  private async createAlert(
    organizationId: number,
    alert: { evaluationId: number; alertType: AlertType; severity: Severity; explanation: string },
    latest: QualityScoreData,
    baselineValue: number,
    zScoreValue: number,
  ) {
    await db.insert(driftAlerts).values({
      organizationId,
      evaluationId: alert.evaluationId,
      alertType: alert.alertType,
      severity: alert.severity,
      explanation: alert.explanation,
      model: latest.model || "unknown",
      currentValue: String(latest.score),
      baselineValue: String(baselineValue),
      zScoreValue: String(zScoreValue),
      createdAt: new Date().toISOString(),
    });
  }
}

export const driftService = new DriftService();
