"use client";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle,
  Clock,
  DollarSign,
  Edit,
  GitBranch,
  MoreHorizontal,
  Play,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowDAG } from "@/components/workflow-dag";
import { useSession } from "@/lib/auth-client";

type PageProps = {
  params: Promise<{ id: string }>;
};

interface WorkflowStats {
  workflow: any;
  stats: {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    successRate: string;
    avgDuration: number;
    totalCost: string;
  };
}

interface WorkflowRun {
  id: number;
  status: "running" | "completed" | "failed" | "cancelled";
  input: any;
  output: any;
  totalCost: string | null;
  totalDurationMs: number | null;
  agentCount: number | null;
  handoffCount: number | null;
  startedAt: string;
  completedAt: string | null;
}

interface Handoff {
  id: number;
  fromAgent: string | null;
  toAgent: string;
  handoffType: string;
  context: any;
  timestamp: string;
}

export default function WorkflowDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [workflowData, setWorkflowData] = useState<WorkflowStats | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [handoffStats, setHandoffStats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/auth/login");
      return;
    }

    if (session?.user) {
      const token = localStorage.getItem("bearer_token");

      // Fetch workflow with stats
      Promise.all([
        fetch(`/api/workflows/${id}?includeStats=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json()),
        fetch(`/api/workflows/${id}/runs?limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json()),
        fetch(`/api/workflows/${id}/handoffs`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json()),
      ])
        .then(([workflow, runsData, handoffs]) => {
          if (workflow?.code === "NO_ORG_MEMBERSHIP") {
            router.push("/onboarding");
            return;
          }
          if (workflow?.error) {
            router.push("/workflows");
            return;
          }
          setWorkflowData(workflow);
          setRuns(Array.isArray(runsData) ? runsData : []);
          setHandoffStats(handoffs?.handoffStats || []);
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [session, isPending, router, id]);

  if (isPending || !session?.user || isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!workflowData) {
    return null;
  }

  const { workflow, stats } = workflowData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/workflows">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{workflow.name}</h1>
              <Badge
                variant={
                  workflow.status === "active"
                    ? "default"
                    : workflow.status === "draft"
                      ? "secondary"
                      : "outline"
                }
              >
                {workflow.status}
              </Badge>
            </div>
            {workflow.description && (
              <p className="text-muted-foreground">{workflow.description}</p>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Edit className="mr-2 h-4 w-4" />
              Edit Workflow
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Play className="mr-2 h-4 w-4" />
              Run Workflow
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRuns}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-green-500">{stats.successRate}%</div>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {stats.avgDuration ? `${Math.round(stats.avgDuration)}ms` : "-"}
              </div>
              <Zap className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                ${parseFloat(stats.totalCost || "0").toFixed(4)}
              </div>
              <DollarSign className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="runs">Runs ({runs.length})</TabsTrigger>
          <TabsTrigger value="handoffs">Handoffs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* DAG Visualization */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow Graph</CardTitle>
              <CardDescription>Click on a node to see details</CardDescription>
            </CardHeader>
            <CardContent>
              {workflow.definition && (
                <WorkflowDAG
                  definition={workflow.definition}
                  selectedNodeId={selectedNodeId}
                  onNodeClick={(node) => setSelectedNodeId(node.id)}
                  className="min-h-[300px] border rounded-lg"
                />
              )}
            </CardContent>
          </Card>

          {/* Node Details */}
          {selectedNodeId && workflow.definition && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Node: {workflow.definition.nodes.find((n: any) => n.id === selectedNodeId)?.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto">
                  {JSON.stringify(
                    workflow.definition.nodes.find((n: any) => n.id === selectedNodeId),
                    null,
                    2,
                  )}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          {runs.length > 0 ? (
            <div className="space-y-3">
              {runs.map((run) => (
                <Card key={run.id} className="hover:border-primary transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {run.status === "completed" ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : run.status === "failed" ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : run.status === "running" ? (
                            <Activity className="h-5 w-5 text-blue-500 animate-pulse" />
                          ) : (
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span className="font-medium capitalize">{run.status}</span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {run.totalDurationMs && (
                            <div className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {run.totalDurationMs}ms
                            </div>
                          )}
                          {run.totalCost && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />$
                              {parseFloat(run.totalCost).toFixed(4)}
                            </div>
                          )}
                          {run.agentCount !== null && (
                            <div className="flex items-center gap-1">
                              <Bot className="h-3 w-3" />
                              {run.agentCount} agents
                            </div>
                          )}
                          {run.handoffCount !== null && (
                            <div className="flex items-center gap-1">
                              <ArrowRight className="h-3 w-3" />
                              {run.handoffCount} handoffs
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {new Date(run.startedAt).toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-8 w-8 text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-1">No runs yet</h3>
                <p className="text-sm text-muted-foreground">
                  Run this workflow to see execution history
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="handoffs" className="space-y-4">
          {handoffStats.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Handoff Patterns</CardTitle>
                <CardDescription>Agent-to-agent transitions across all runs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {handoffStats.map((stat, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{stat.handoffType}</Badge>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{stat.fromAgent || "Start"}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{stat.toAgent}</span>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">{stat.count} times</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <GitBranch className="h-8 w-8 text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-1">No handoffs recorded</h3>
                <p className="text-sm text-muted-foreground">
                  Handoffs will appear here once workflows are executed
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
