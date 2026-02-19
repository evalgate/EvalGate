"use client";

import { Activity, Check, Clock, Code, Copy, Plus, Search, Sparkles, Workflow } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowDAGMini } from "@/components/workflow-dag";
import { useSession } from "@/lib/auth-client";

// SDK Integration examples
const WORKFLOW_EXAMPLES = {
  basic: {
    name: "Basic Workflow",
    code: `import { WorkflowTracer } from '@pauly4010/evalai-sdk';

const tracer = new WorkflowTracer(client, { organizationId: 123 });

// Start a workflow
await tracer.startWorkflow('Customer Support Pipeline');

// Track agent work
const span = await tracer.startAgentSpan('RouterAgent', { input: query });
await tracer.recordDecision({
  agent: 'RouterAgent',
  type: 'route',
  chosen: 'technical_support',
  alternatives: [{ action: 'billing', confidence: 0.2 }],
  reasoning: 'Technical keywords detected'
});
await tracer.recordHandoff('RouterAgent', 'TechnicalAgent', { context });
await tracer.endAgentSpan(span, { result: 'delegated' });

// End workflow
await tracer.endWorkflow({ resolution: 'resolved' });`,
  },
  langchain: {
    name: "LangChain Agent",
    code: `import { WorkflowTracer, traceLangChainAgent } from '@pauly4010/evalai-sdk';
import { AgentExecutor } from 'langchain/agents';

const tracer = new WorkflowTracer(client);
const executor = new AgentExecutor({ ... });

// Wrap agent for automatic tracing
const tracedExecutor = traceLangChainAgent(executor, tracer, {
  agentName: 'ResearchAgent'
});

await tracer.startWorkflow('Research Pipeline');

// Agent calls are automatically traced
const result = await tracedExecutor.invoke({
  input: "What are the latest trends in AI?"
});

await tracer.endWorkflow({ result });`,
  },
  multiagent: {
    name: "Multi-Agent",
    code: `import { WorkflowTracer } from '@pauly4010/evalai-sdk';

const tracer = new WorkflowTracer(client);

await tracer.startWorkflow('Code Review Pipeline', {
  nodes: [
    { id: 'reviewer', type: 'agent', name: 'CodeReviewer' },
    { id: 'security', type: 'agent', name: 'SecurityScanner' },
    { id: 'merger', type: 'agent', name: 'PRMerger' }
  ],
  edges: [
    { from: 'reviewer', to: 'security' },
    { from: 'security', to: 'merger', condition: 'no_vulnerabilities' }
  ],
  entrypoint: 'reviewer'
});

// Track each agent
for (const agent of ['CodeReviewer', 'SecurityScanner', 'PRMerger']) {
  const span = await tracer.startAgentSpan(agent);
  // Agent work...
  await tracer.endAgentSpan(span);
  await tracer.recordHandoff(agent, nextAgent);
}

await tracer.endWorkflow();`,
  },
};

interface Workflow {
  id: number;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  definition: any;
  createdAt: string;
  updatedAt: string;
  _count?: {
    runs: number;
    completedRuns: number;
    failedRuns: number;
  };
}

export default function WorkflowsPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [filteredWorkflows, setFilteredWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showGuide, setShowGuide] = useState(false);
  const [copiedExample, setCopiedExample] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session?.user) {
      // Demo mode - show placeholder data
      setWorkflows([
        {
          id: 1,
          name: "Customer Support Pipeline",
          description: "Routes customer queries to appropriate agents",
          status: "active",
          definition: {
            nodes: [
              { id: "router", type: "agent", name: "RouterAgent" },
              { id: "technical", type: "agent", name: "TechnicalAgent" },
              { id: "billing", type: "agent", name: "BillingAgent" },
            ],
            edges: [
              { from: "router", to: "technical", condition: "is_technical" },
              { from: "router", to: "billing", condition: "is_billing" },
            ],
            entrypoint: "router",
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: { runs: 156, completedRuns: 142, failedRuns: 14 },
        },
        {
          id: 2,
          name: "Research Assistant",
          description: "Multi-step research and summarization workflow",
          status: "active",
          definition: {
            nodes: [
              { id: "planner", type: "agent", name: "PlannerAgent" },
              { id: "researcher", type: "agent", name: "ResearchAgent" },
              { id: "writer", type: "agent", name: "WriterAgent" },
            ],
            edges: [
              { from: "planner", to: "researcher" },
              { from: "researcher", to: "writer" },
            ],
            entrypoint: "planner",
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: { runs: 89, completedRuns: 85, failedRuns: 4 },
        },
      ]);
      setFilteredWorkflows([]);
      setIsLoading(false);
      return;
    }

    if (session?.user) {
      fetch("/api/workflows?limit=50", {
        credentials: "include",
      })
        .then((res) => res.json().then((data) => ({ res, data })))
        .then(({ res, data }) => {
          if (res.status === 403 && data?.code === "NO_ORG_MEMBERSHIP") {
            router.push("/onboarding");
            return;
          }
          setWorkflows(Array.isArray(data) ? data : []);
          setFilteredWorkflows(Array.isArray(data) ? data : []);
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [session, isPending, router]);

  // Filter workflows
  useEffect(() => {
    let filtered = workflows;

    if (searchQuery) {
      filtered = filtered.filter(
        (w) =>
          w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((w) => w.status === statusFilter);
    }

    setFilteredWorkflows(filtered);
  }, [searchQuery, statusFilter, workflows]);

  const copyToClipboard = (code: string, exampleName: string) => {
    navigator.clipboard.writeText(code);
    setCopiedExample(exampleName);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopiedExample(null), 2000);
  };

  if (isPending) {
    return null;
  }

  const isDemo = !session?.user;

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      {isDemo && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            <strong>Demo Mode:</strong> You're viewing sample workflows.{" "}
            <Link href="/auth/sign-up" className="underline font-semibold">
              Sign up
            </Link>{" "}
            to create your own multi-agent workflows.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Workflows</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Track and evaluate multi-agent workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showGuide} onOpenChange={setShowGuide}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Code className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">SDK Guide</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Workflow Tracing SDK
                </DialogTitle>
                <DialogDescription>
                  Instrument your multi-agent workflows with a few lines of code
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="langchain">LangChain</TabsTrigger>
                  <TabsTrigger value="multiagent">Multi-Agent</TabsTrigger>
                </TabsList>

                {Object.entries(WORKFLOW_EXAMPLES).map(([key, example]) => (
                  <TabsContent key={key} value={key} className="space-y-4">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{example.name}</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(example.code, key)}
                          >
                            {copiedExample === key ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <pre className="rounded-lg bg-muted p-4 overflow-x-auto">
                          <code className="text-xs font-mono">{example.code}</code>
                        </pre>
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            </DialogContent>
          </Dialog>
          {!isDemo && (
            <Button size="sm" asChild>
              <Link href="/workflows/new">
                <Plus className="mr-2 h-4 w-4" />
                New Workflow
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      {!isLoading && workflows.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <div className="flex gap-2">
            {["all", "active", "draft", "archived"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Workflow List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredWorkflows.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredWorkflows.map((workflow) => (
            <Link key={workflow.id} href={`/workflows/${workflow.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Workflow className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold truncate">{workflow.name}</h3>
                    </div>
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
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {workflow.description}
                    </p>
                  )}

                  {/* Workflow preview */}
                  <div className="mb-4">
                    <WorkflowDAGMini definition={workflow.definition} />
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {workflow._count && (
                      <>
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          <span>{workflow._count.runs} runs</span>
                        </div>
                        <div className="flex items-center gap-1 text-green-500">
                          <Check className="h-3 w-3" />
                          <span>
                            {workflow._count.runs > 0
                              ? Math.round(
                                  (workflow._count.completedRuns / workflow._count.runs) * 100,
                                )
                              : 0}
                            %
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(workflow.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : workflows.length > 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">No workflows found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Try adjusting your search or filters
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
            >
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Workflow className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
              Create multi-agent workflows to track agent handoffs, decisions, and costs across
              complex AI pipelines.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setShowGuide(true)} variant="outline">
                <Code className="mr-2 h-4 w-4" />
                View SDK Guide
              </Button>
              {!isDemo && (
                <Button asChild>
                  <Link href="/workflows/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Workflow
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
