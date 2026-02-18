"use client";

import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle,
  Clock,
  DollarSign,
  Shield,
  TrendingDown,
  TrendingUp,
  Workflow,
} from "lucide-react";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface EnterpriseMetrics {
  workflowsDeployed: number;
  decisionsAudited: number;
  costSaved: string;
  slaViolations: number;
  avgConfidence: number;
  totalRuns: number;
  successRate: number;
  avgLatencyMs: number;
  totalCost: string;
  complianceRate: number;
}

export interface MetricTrend {
  value: number;
  direction: "up" | "down" | "stable";
  percentage: number;
}

export interface EnterpriseMetricsProps {
  metrics: EnterpriseMetrics;
  trends?: {
    workflows?: MetricTrend;
    decisions?: MetricTrend;
    cost?: MetricTrend;
    sla?: MetricTrend;
  };
  className?: string;
  compact?: boolean;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: MetricTrend;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}) {
  const variantStyles = {
    default: "text-primary",
    success: "text-green-500",
    warning: "text-amber-500",
    danger: "text-red-500",
  };

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", variantStyles[variant])} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend.direction === "up" ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : trend.direction === "down" ? (
              <TrendingDown className="h-3 w-3 text-red-500" />
            ) : null}
            <span
              className={cn(
                "text-xs",
                trend.direction === "up" && "text-green-500",
                trend.direction === "down" && "text-red-500",
                trend.direction === "stable" && "text-muted-foreground",
              )}
            >
              {trend.direction === "stable" ? "No change" : `${trend.percentage}%`}
            </span>
            <span className="text-xs text-muted-foreground">vs last week</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompactMetric({
  label,
  value,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const variantStyles = {
    default: "text-primary bg-primary/10",
    success: "text-green-500 bg-green-500/10",
    warning: "text-amber-500 bg-amber-500/10",
    danger: "text-red-500 bg-red-500/10",
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className={cn("p-2 rounded-md", variantStyles[variant])}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EnterpriseMetricsDashboard({
  metrics,
  trends,
  className,
  compact = false,
}: EnterpriseMetricsProps) {
  if (compact) {
    return (
      <div className={cn("grid grid-cols-2 md:grid-cols-5 gap-3", className)}>
        <CompactMetric label="Workflows" value={metrics.workflowsDeployed} icon={Workflow} />
        <CompactMetric
          label="Decisions"
          value={metrics.decisionsAudited.toLocaleString()}
          icon={Brain}
        />
        <CompactMetric
          label="Cost Saved"
          value={metrics.costSaved}
          icon={DollarSign}
          variant="success"
        />
        <CompactMetric
          label="SLA Violations"
          value={metrics.slaViolations}
          icon={AlertTriangle}
          variant={
            metrics.slaViolations > 5 ? "danger" : metrics.slaViolations > 0 ? "warning" : "success"
          }
        />
        <CompactMetric
          label="Avg Confidence"
          value={`${metrics.avgConfidence}%`}
          icon={Shield}
          variant={
            metrics.avgConfidence >= 80
              ? "success"
              : metrics.avgConfidence >= 60
                ? "warning"
                : "danger"
          }
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Primary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Workflows Deployed"
          value={metrics.workflowsDeployed}
          description="Active multi-agent workflows"
          icon={Workflow}
          trend={trends?.workflows}
        />
        <MetricCard
          title="Decisions Audited"
          value={metrics.decisionsAudited.toLocaleString()}
          description="Agent decisions with full audit trail"
          icon={Brain}
          trend={trends?.decisions}
        />
        <MetricCard
          title="Cost Saved"
          value={metrics.costSaved}
          description="From model fallbacks & optimization"
          icon={DollarSign}
          variant="success"
          trend={trends?.cost}
        />
        <MetricCard
          title="SLA Violations"
          value={metrics.slaViolations}
          description={metrics.slaViolations < 5 ? "< 1% of total runs" : "Needs attention"}
          icon={AlertTriangle}
          variant={
            metrics.slaViolations > 5 ? "danger" : metrics.slaViolations > 0 ? "warning" : "success"
          }
          trend={trends?.sla}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{metrics.successRate}%</span>
              <Badge variant={metrics.successRate >= 95 ? "default" : "secondary"}>
                {metrics.successRate >= 95
                  ? "Excellent"
                  : metrics.successRate >= 80
                    ? "Good"
                    : "Needs Work"}
              </Badge>
            </div>
            <Progress value={metrics.successRate} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.totalRuns.toLocaleString()} total runs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{metrics.avgConfidence}%</span>
              <Badge variant={metrics.avgConfidence >= 80 ? "default" : "secondary"}>
                {metrics.avgConfidence >= 80
                  ? "High"
                  : metrics.avgConfidence >= 60
                    ? "Medium"
                    : "Low"}
              </Badge>
            </div>
            <Progress value={metrics.avgConfidence} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">Across all agent decisions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{metrics.complianceRate}%</span>
              <Badge variant={metrics.complianceRate >= 99 ? "default" : "destructive"}>
                {metrics.complianceRate >= 99 ? "Compliant" : "Review Needed"}
              </Badge>
            </div>
            <Progress value={metrics.complianceRate} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">Governance rules adherence</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Performance Overview</CardTitle>
          <CardDescription>Key operational metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Avg Latency</span>
              </div>
              <p className="text-xl font-semibold">{metrics.avgLatencyMs}ms</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Cost</span>
              </div>
              <p className="text-xl font-semibold">{metrics.totalCost}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Runs</span>
              </div>
              <p className="text-xl font-semibold">{metrics.totalRuns.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Decisions/Run</span>
              </div>
              <p className="text-xl font-semibold">
                {metrics.totalRuns > 0
                  ? (metrics.decisionsAudited / metrics.totalRuns).toFixed(1)
                  : "0"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// DEMO DATA
// ============================================================================

export const demoMetrics: EnterpriseMetrics = {
  workflowsDeployed: 47,
  decisionsAudited: 12453,
  costSaved: "$3,200",
  slaViolations: 3,
  avgConfidence: 87,
  totalRuns: 8234,
  successRate: 96.2,
  avgLatencyMs: 1250,
  totalCost: "$4,567.89",
  complianceRate: 99.1,
};

export const demoTrends = {
  workflows: { value: 47, direction: "up" as const, percentage: 12 },
  decisions: { value: 12453, direction: "up" as const, percentage: 23 },
  cost: { value: 3200, direction: "up" as const, percentage: 15 },
  sla: { value: 3, direction: "down" as const, percentage: 40 },
};

export default EnterpriseMetricsDashboard;
