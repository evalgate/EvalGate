"use client";

import {
  ArrowUpDown,
  Bot,
  Crown,
  Medal,
  Plus,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/lib/auth-client";

interface Benchmark {
  id: number;
  name: string;
  description: string | null;
  taskType: string;
  isPublic: boolean;
  createdAt: string;
  _stats?: {
    participantCount: number;
    avgAccuracy: number;
    topPerformer: {
      name: string;
      architecture: string;
      accuracy: number;
    } | null;
  };
}

interface LeaderboardEntry {
  rank: number;
  agentConfig: {
    id: number;
    name: string;
    architecture: string;
    model: string;
  };
  accuracy: number | null;
  latencyP50: number | null;
  successRate: number | null;
  score: number;
}

const RANK_ICONS: Record<number, React.ReactNode> = {
  1: <Crown className="h-5 w-5 text-yellow-500" />,
  2: <Medal className="h-5 w-5 text-gray-400" />,
  3: <Medal className="h-5 w-5 text-amber-600" />,
};

const TASK_TYPE_LABELS: Record<string, string> = {
  qa: "Q&A",
  coding: "Coding",
  reasoning: "Reasoning",
  tool_use: "Tool Use",
  multi_step: "Multi-Step",
};

export default function BenchmarksPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState<Benchmark | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("benchmarks");

  useEffect(() => {
    if (!isPending && !session?.user) {
      // Demo data
      setBenchmarks([
        {
          id: 1,
          name: "Customer Support Quality",
          description: "Evaluate agent responses for customer support scenarios",
          taskType: "qa",
          isPublic: true,
          createdAt: new Date().toISOString(),
          _stats: {
            participantCount: 12,
            avgAccuracy: 78,
            topPerformer: {
              name: "GPT-4 ReAct Agent",
              architecture: "react",
              accuracy: 94,
            },
          },
        },
        {
          id: 2,
          name: "Code Generation",
          description: "Benchmark agent code generation capabilities",
          taskType: "coding",
          isPublic: true,
          createdAt: new Date().toISOString(),
          _stats: {
            participantCount: 8,
            avgAccuracy: 72,
            topPerformer: {
              name: "Claude CoT Agent",
              architecture: "cot",
              accuracy: 89,
            },
          },
        },
        {
          id: 3,
          name: "Multi-Step Reasoning",
          description: "Complex multi-step problem solving",
          taskType: "reasoning",
          isPublic: false,
          createdAt: new Date().toISOString(),
          _stats: {
            participantCount: 5,
            avgAccuracy: 65,
            topPerformer: {
              name: "GPT-4o ToT Agent",
              architecture: "tot",
              accuracy: 82,
            },
          },
        },
      ]);
      setLeaderboard([
        {
          rank: 1,
          agentConfig: { id: 1, name: "GPT-4 ReAct Agent", architecture: "react", model: "gpt-4o" },
          accuracy: 94,
          latencyP50: 1250,
          successRate: 96,
          score: 92,
        },
        {
          rank: 2,
          agentConfig: {
            id: 2,
            name: "Claude CoT Agent",
            architecture: "cot",
            model: "claude-3.5-sonnet",
          },
          accuracy: 89,
          latencyP50: 980,
          successRate: 91,
          score: 88,
        },
        {
          rank: 3,
          agentConfig: { id: 3, name: "GPT-4o ToT Agent", architecture: "tot", model: "gpt-4o" },
          accuracy: 87,
          latencyP50: 2100,
          successRate: 88,
          score: 84,
        },
        {
          rank: 4,
          agentConfig: {
            id: 4,
            name: "Gemini Custom Agent",
            architecture: "custom",
            model: "gemini-1.5-pro",
          },
          accuracy: 82,
          latencyP50: 1450,
          successRate: 85,
          score: 79,
        },
        {
          rank: 5,
          agentConfig: {
            id: 5,
            name: "Mistral ReAct Agent",
            architecture: "react",
            model: "mistral-large",
          },
          accuracy: 78,
          latencyP50: 890,
          successRate: 82,
          score: 75,
        },
      ]);
      setSelectedBenchmark({
        id: 1,
        name: "Customer Support Quality",
        description: "Evaluate agent responses for customer support scenarios",
        taskType: "qa",
        isPublic: true,
        createdAt: new Date().toISOString(),
      });
      setIsLoading(false);
      return;
    }

    if (session?.user) {
      const token = localStorage.getItem("bearer_token");
      fetch("/api/benchmarks", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json().then((data) => ({ res, data })))
        .then(({ res, data }) => {
          if (res.status === 403 && data?.code === "NO_ORG_MEMBERSHIP") {
            router.push("/onboarding");
            return;
          }
          setBenchmarks(Array.isArray(data) ? data : []);
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [session, isPending, router]);

  if (isPending) {
    return null;
  }

  const isDemo = !session?.user;

  // Radar chart data for comparing architectures
  const radarData = [
    { metric: "Accuracy", react: 85, cot: 82, tot: 78, custom: 75 },
    { metric: "Speed", react: 70, cot: 75, tot: 60, custom: 72 },
    { metric: "Cost Efficiency", react: 65, cot: 70, tot: 55, custom: 80 },
    { metric: "Reliability", react: 88, cot: 85, tot: 82, custom: 78 },
    { metric: "Tool Use", react: 90, cot: 75, tot: 85, custom: 70 },
  ];

  return (
    <div className="space-y-6">
      {isDemo && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            <strong>Demo Mode:</strong> You're viewing sample benchmark data.{" "}
            <Link href="/auth/sign-up" className="underline font-semibold">
              Sign up
            </Link>{" "}
            to create your own benchmarks.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Benchmarks</h1>
          <p className="text-muted-foreground">Compare agent architectures and track performance</p>
        </div>
        {!isDemo && (
          <Button size="sm" asChild>
            <Link href="/benchmarks/new">
              <Plus className="mr-2 h-4 w-4" />
              New Benchmark
            </Link>
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="architectures">Architectures</TabsTrigger>
        </TabsList>

        <TabsContent value="benchmarks" className="space-y-4">
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
          ) : benchmarks.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {benchmarks.map((benchmark) => (
                <Card
                  key={benchmark.id}
                  className="hover:border-primary transition-colors cursor-pointer"
                  onClick={() => setSelectedBenchmark(benchmark)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">{benchmark.name}</h3>
                      </div>
                      <Badge variant={benchmark.isPublic ? "default" : "secondary"}>
                        {benchmark.isPublic ? "Public" : "Private"}
                      </Badge>
                    </div>

                    {benchmark.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {benchmark.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                      <Badge variant="outline">
                        {TASK_TYPE_LABELS[benchmark.taskType] || benchmark.taskType}
                      </Badge>
                      {benchmark._stats && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {benchmark._stats.participantCount} participants
                        </div>
                      )}
                    </div>

                    {benchmark._stats?.topPerformer && (
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Crown className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium">Top Performer</span>
                        </div>
                        <p className="text-sm">{benchmark._stats.topPerformer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {benchmark._stats.topPerformer.accuracy}% accuracy
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Trophy className="h-8 w-8 text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-1">No benchmarks yet</h3>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Create benchmarks to compare agent performance
                </p>
                {!isDemo && (
                  <Button asChild>
                    <Link href="/benchmarks/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Benchmark
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          {selectedBenchmark && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-primary" />
                      {selectedBenchmark.name} Leaderboard
                    </CardTitle>
                    <CardDescription>Ranked by composite score</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    Sort
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Architecture</TableHead>
                      <TableHead className="text-right">Accuracy</TableHead>
                      <TableHead className="text-right">Latency</TableHead>
                      <TableHead className="text-right">Success Rate</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((entry) => (
                      <TableRow key={entry.agentConfig.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {RANK_ICONS[entry.rank] || (
                              <span className="w-5 text-center">{entry.rank}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{entry.agentConfig.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {entry.agentConfig.model}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {entry.agentConfig.architecture}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              entry.accuracy && entry.accuracy >= 90
                                ? "text-green-500 font-medium"
                                : ""
                            }
                          >
                            {entry.accuracy}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{entry.latencyP50}ms</TableCell>
                        <TableCell className="text-right">{entry.successRate}%</TableCell>
                        <TableCell className="text-right font-bold">{entry.score}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="architectures" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Architecture Comparison</CardTitle>
                <CardDescription>Performance across different agent architectures</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" className="text-xs" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar
                      name="ReAct"
                      dataKey="react"
                      stroke="hsl(var(--chart-1))"
                      fill="hsl(var(--chart-1))"
                      fillOpacity={0.3}
                    />
                    <Radar
                      name="Chain-of-Thought"
                      dataKey="cot"
                      stroke="hsl(var(--chart-2))"
                      fill="hsl(var(--chart-2))"
                      fillOpacity={0.3}
                    />
                    <Radar
                      name="Tree-of-Thought"
                      dataKey="tot"
                      stroke="hsl(var(--chart-3))"
                      fill="hsl(var(--chart-3))"
                      fillOpacity={0.3}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Architecture Insights</CardTitle>
                <CardDescription>Best use cases for each architecture</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    name: "ReAct",
                    description: "Best for tool-heavy workflows and interactive tasks",
                    strengths: ["Tool Use", "Reliability", "Accuracy"],
                    icon: <Bot className="h-5 w-5 text-purple-500" />,
                  },
                  {
                    name: "Chain-of-Thought",
                    description: "Best for complex reasoning and explanation tasks",
                    strengths: ["Speed", "Cost Efficiency", "Reliability"],
                    icon: <TrendingUp className="h-5 w-5 text-blue-500" />,
                  },
                  {
                    name: "Tree-of-Thought",
                    description: "Best for exploration and creative problem solving",
                    strengths: ["Tool Use", "Accuracy"],
                    icon: <Target className="h-5 w-5 text-green-500" />,
                  },
                ].map((arch) => (
                  <div key={arch.name} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {arch.icon}
                      <span className="font-medium">{arch.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{arch.description}</p>
                    <div className="flex gap-2">
                      {arch.strengths.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
