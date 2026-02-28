"use client";

import {
	AlertTriangle,
	BarChart3,
	Calendar,
	Coins,
	Cpu,
	DollarSign,
	RefreshCw,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/lib/auth-client";

interface CostSummary {
	last30Days: {
		totalCost: number;
		totalTokens: number;
		requestCount: number;
	};
	last7Days: {
		totalCost: number;
		totalTokens: number;
		requestCount: number;
	};
	topModels: Array<{
		provider: string;
		model: string;
		totalCost: number;
		requestCount: number;
	}>;
}

interface CostTrend {
	date: string;
	totalCost: number;
	tokenCount: number;
	requestCount: number;
}

const CHART_COLORS = [
	"hsl(var(--chart-1))",
	"hsl(var(--chart-2))",
	"hsl(var(--chart-3))",
	"hsl(var(--chart-4))",
	"hsl(var(--chart-5))",
];

export default function CostsPage() {
	const { data: session, isPending } = useSession();
	const [summary, setSummary] = useState<CostSummary | null>(null);
	const [trends, setTrends] = useState<CostTrend[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [activeTab, setActiveTab] = useState("overview");
	const [noOrg, setNoOrg] = useState(false);
	const [_refreshTrigger, setRefreshTrigger] = useState(0);

	const handleRefresh = () => {
		if (!isLoading) setRefreshTrigger((n) => n + 1);
	};

	useEffect(() => {
		if (!isPending && !session?.user) {
			// Demo data
			setSummary({
				last30Days: {
					totalCost: 245.67,
					totalTokens: 12500000,
					requestCount: 8420,
				},
				last7Days: {
					totalCost: 58.23,
					totalTokens: 3100000,
					requestCount: 2105,
				},
				topModels: [
					{
						provider: "openai",
						model: "gpt-4o",
						totalCost: 125.5,
						requestCount: 3200,
					},
					{
						provider: "anthropic",
						model: "claude-3.5-sonnet",
						totalCost: 78.3,
						requestCount: 2800,
					},
					{
						provider: "openai",
						model: "gpt-4o-mini",
						totalCost: 25.12,
						requestCount: 1500,
					},
					{
						provider: "openai",
						model: "text-embedding-3-small",
						totalCost: 12.45,
						requestCount: 820,
					},
					{
						provider: "google",
						model: "gemini-1.5-flash",
						totalCost: 4.3,
						requestCount: 100,
					},
				],
			});
			setTrends([
				{
					date: "2024-01-01",
					totalCost: 8.5,
					tokenCount: 450000,
					requestCount: 280,
				},
				{
					date: "2024-01-02",
					totalCost: 9.2,
					tokenCount: 480000,
					requestCount: 295,
				},
				{
					date: "2024-01-03",
					totalCost: 7.8,
					tokenCount: 420000,
					requestCount: 260,
				},
				{
					date: "2024-01-04",
					totalCost: 10.5,
					tokenCount: 520000,
					requestCount: 320,
				},
				{
					date: "2024-01-05",
					totalCost: 11.2,
					tokenCount: 580000,
					requestCount: 350,
				},
				{
					date: "2024-01-06",
					totalCost: 6.3,
					tokenCount: 350000,
					requestCount: 210,
				},
				{
					date: "2024-01-07",
					totalCost: 4.9,
					tokenCount: 280000,
					requestCount: 180,
				},
			]);
			setIsLoading(false);
			return;
		}

		if (session?.user) {
			const fetchData = async () => {
				try {
					setNoOrg(false);
					const orgRes = await fetch("/api/organizations/current", {
						credentials: "include",
					});
					if (!orgRes.ok) {
						if (orgRes.status === 404) {
							setNoOrg(true);
							setSummary(null);
							setTrends([]);
							setIsLoading(false);
							return;
						}
						throw new Error("Failed to fetch organization");
					}
					const [costsRes, trendsRes] = await Promise.all([
						fetch("/api/costs", { credentials: "include" }),
						fetch("/api/costs/trends", { credentials: "include" }),
					]);

					const summaryData = await costsRes.json();
					if (!costsRes.ok || summaryData?.error) {
						setSummary(null);
						setTrends([]);
						setIsLoading(false);
						return;
					}
					setSummary(summaryData);

					if (trendsRes.ok) {
						const trendsData = await trendsRes.json();
						setTrends(trendsData?.trends ?? []);
					} else {
						setTrends([]);
					}
				} catch {
					setSummary(null);
					setTrends([]);
				} finally {
					setIsLoading(false);
				}
			};
			fetchData();
		}
	}, [session, isPending]);

	if (isPending) {
		return null;
	}

	const isDemo = !session?.user;
	const prev3Weeks =
		summary?.last30Days && summary?.last7Days
			? (summary.last30Days.totalCost - summary.last7Days.totalCost) / 3
			: 0;
	const weekOverWeekChange =
		summary?.last7Days && prev3Weeks > 0
			? ((summary.last7Days.totalCost - prev3Weeks) / prev3Weeks) * 100
			: 0;

	const pieChartData =
		summary?.topModels.map((model, i) => ({
			name: model.model,
			value: model.totalCost,
			color: CHART_COLORS[i % CHART_COLORS.length],
		})) || [];

	return (
		<div className="space-y-6">
			{noOrg && (
				<div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
					<p className="text-sm text-amber-600 dark:text-amber-400">
						<strong>Setup required:</strong> Complete your organization setup to
						view cost analytics.{" "}
						<Link href="/onboarding" className="underline font-semibold">
							Go to onboarding
						</Link>
					</p>
				</div>
			)}

			{isDemo && (
				<div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
					<p className="text-sm text-blue-600 dark:text-blue-400">
						<strong>Demo Mode:</strong> You're viewing sample cost data.{" "}
						<Link href="/auth/sign-up" className="underline font-semibold">
							Sign up
						</Link>{" "}
						to track your actual LLM costs.
					</p>
				</div>
			)}

			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold">Cost Analytics</h1>
					<p className="text-muted-foreground">
						Track and optimize your LLM spending
					</p>
				</div>
				{!noOrg && (
					<Button
						variant="outline"
						size="sm"
						disabled={isLoading}
						onClick={handleRefresh}
					>
						<RefreshCw
							className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
				)}
			</div>

			{noOrg ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16 text-center">
						<p className="text-muted-foreground mb-4">
							Set up your organization to start tracking LLM costs.
						</p>
						<Button asChild>
							<Link href="/onboarding">Complete setup</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<>
					{/* Summary Cards */}
					{isLoading ? (
						<div className="grid gap-4 md:grid-cols-4">
							{[1, 2, 3, 4].map((i) => (
								<Card key={i}>
									<CardContent className="p-6">
										<Skeleton className="h-4 w-24 mb-2" />
										<Skeleton className="h-8 w-20" />
									</CardContent>
								</Card>
							))}
						</div>
					) : (
						summary && (
							<div className="grid gap-4 md:grid-cols-4">
								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
											<DollarSign className="h-4 w-4" />
											30-Day Spend
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="text-2xl font-bold">
											${summary.last30Days.totalCost.toFixed(2)}
										</div>
										<p className="text-xs text-muted-foreground mt-1">
											{summary.last30Days.requestCount.toLocaleString()}{" "}
											requests
										</p>
									</CardContent>
								</Card>

								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
											<Calendar className="h-4 w-4" />
											7-Day Spend
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="flex items-center gap-2">
											<span className="text-2xl font-bold">
												${summary.last7Days.totalCost.toFixed(2)}
											</span>
											{weekOverWeekChange !== 0 && (
												<Badge
													variant={
														weekOverWeekChange > 0 ? "destructive" : "secondary"
													}
													className="flex items-center gap-1"
												>
													{weekOverWeekChange > 0 ? (
														<TrendingUp className="h-3 w-3" />
													) : (
														<TrendingDown className="h-3 w-3" />
													)}
													{Math.abs(weekOverWeekChange).toFixed(1)}%
												</Badge>
											)}
										</div>
									</CardContent>
								</Card>

								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
											<Coins className="h-4 w-4" />
											Total Tokens
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="text-2xl font-bold">
											{(summary.last30Days.totalTokens / 1_000_000).toFixed(2)}M
										</div>
										<p className="text-xs text-muted-foreground mt-1">
											Last 30 days
										</p>
									</CardContent>
								</Card>

								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
											<BarChart3 className="h-4 w-4" />
											Avg Cost/Request
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="text-2xl font-bold">
											$
											{summary.last30Days.requestCount > 0
												? (
														summary.last30Days.totalCost /
														summary.last30Days.requestCount
													).toFixed(4)
												: "0.0000"}
										</div>
										<p className="text-xs text-muted-foreground mt-1">
											Per API call
										</p>
									</CardContent>
								</Card>
							</div>
						)
					)}

					{/* Tabs */}
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList>
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="models">By Model</TabsTrigger>
							<TabsTrigger value="pricing">Pricing</TabsTrigger>
						</TabsList>

						<TabsContent value="overview" className="space-y-4">
							{/* Cost Trend Chart */}
							<Card>
								<CardHeader>
									<CardTitle>Cost Trend</CardTitle>
									<CardDescription>Daily spending over time</CardDescription>
								</CardHeader>
								<CardContent>
									{isLoading ? (
										<Skeleton className="h-[300px] w-full" />
									) : trends.length > 0 ? (
										<ResponsiveContainer width="100%" height={300}>
											<LineChart data={trends}>
												<CartesianGrid
													strokeDasharray="3 3"
													className="stroke-border"
												/>
												<XAxis
													dataKey="date"
													tickFormatter={(v) =>
														new Date(v).toLocaleDateString("en-US", {
															month: "short",
															day: "numeric",
														})
													}
													className="text-xs"
												/>
												<YAxis
													tickFormatter={(v) => `$${v.toFixed(2)}`}
													className="text-xs"
												/>
												<Tooltip
													formatter={(value: number) => [
														`$${value.toFixed(4)}`,
														"Cost",
													]}
													labelFormatter={(label) =>
														new Date(label).toLocaleDateString()
													}
												/>
												<Line
													type="monotone"
													dataKey="totalCost"
													stroke="hsl(var(--primary))"
													strokeWidth={2}
													dot={false}
												/>
											</LineChart>
										</ResponsiveContainer>
									) : (
										<div className="h-[300px] flex items-center justify-center text-muted-foreground">
											No data available
										</div>
									)}
								</CardContent>
							</Card>

							{/* Token Usage Chart */}
							<Card>
								<CardHeader>
									<CardTitle>Token Usage</CardTitle>
									<CardDescription>Daily token consumption</CardDescription>
								</CardHeader>
								<CardContent>
									{isLoading ? (
										<Skeleton className="h-[250px] w-full" />
									) : trends.length > 0 ? (
										<ResponsiveContainer width="100%" height={250}>
											<BarChart data={trends}>
												<CartesianGrid
													strokeDasharray="3 3"
													className="stroke-border"
												/>
												<XAxis
													dataKey="date"
													tickFormatter={(v) =>
														new Date(v).toLocaleDateString("en-US", {
															month: "short",
															day: "numeric",
														})
													}
													className="text-xs"
												/>
												<YAxis
													tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
													className="text-xs"
												/>
												<Tooltip
													formatter={(value: number) => [
														value.toLocaleString(),
														"Tokens",
													]}
													labelFormatter={(label) =>
														new Date(label).toLocaleDateString()
													}
												/>
												<Bar
													dataKey="tokenCount"
													fill="hsl(var(--chart-2))"
													radius={[4, 4, 0, 0]}
												/>
											</BarChart>
										</ResponsiveContainer>
									) : (
										<div className="h-[250px] flex items-center justify-center text-muted-foreground">
											No data available
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="models" className="space-y-4">
							<div className="grid gap-4 md:grid-cols-2">
								{/* Top Models Table */}
								<Card>
									<CardHeader>
										<CardTitle>Top Models by Cost</CardTitle>
										<CardDescription>Highest spending models</CardDescription>
									</CardHeader>
									<CardContent>
										{isLoading ? (
											<div className="space-y-3">
												{[1, 2, 3, 4, 5].map((i) => (
													<Skeleton key={i} className="h-12 w-full" />
												))}
											</div>
										) : summary?.topModels && summary.topModels.length > 0 ? (
											<div className="space-y-3">
												{summary.topModels.map((model, i) => (
													<div
														key={`${model.provider}-${model.model}`}
														className="flex items-center justify-between p-3 bg-muted rounded-lg"
													>
														<div className="flex items-center gap-3">
															<div
																className="w-3 h-3 rounded-full"
																style={{
																	backgroundColor:
																		CHART_COLORS[i % CHART_COLORS.length],
																}}
															/>
															<div>
																<p className="font-medium text-sm">
																	{model.model}
																</p>
																<p className="text-xs text-muted-foreground">
																	{model.provider}
																</p>
															</div>
														</div>
														<div className="text-right">
															<p className="font-medium">
																${model.totalCost.toFixed(2)}
															</p>
															<p className="text-xs text-muted-foreground">
																{model.requestCount.toLocaleString()} requests
															</p>
														</div>
													</div>
												))}
											</div>
										) : (
											<div className="py-8 text-center text-muted-foreground">
												No model data available
											</div>
										)}
									</CardContent>
								</Card>

								{/* Pie Chart */}
								<Card>
									<CardHeader>
										<CardTitle>Cost Distribution</CardTitle>
										<CardDescription>By model</CardDescription>
									</CardHeader>
									<CardContent>
										{isLoading ? (
											<Skeleton className="h-[250px] w-full" />
										) : pieChartData.length > 0 ? (
											<ResponsiveContainer width="100%" height={250}>
												<PieChart>
													<Pie
														data={pieChartData}
														cx="50%"
														cy="50%"
														innerRadius={60}
														outerRadius={100}
														paddingAngle={2}
														dataKey="value"
													>
														{pieChartData.map((entry) => (
															<Cell
																key={`cell-${entry.name}`}
																fill={entry.color}
															/>
														))}
													</Pie>
													<Tooltip
														formatter={(value: number) =>
															`$${value.toFixed(2)}`
														}
													/>
												</PieChart>
											</ResponsiveContainer>
										) : (
											<div className="h-[250px] flex items-center justify-center text-muted-foreground">
												No data available
											</div>
										)}
									</CardContent>
								</Card>
							</div>
						</TabsContent>

						<TabsContent value="pricing" className="space-y-4">
							<Card>
								<CardHeader>
									<CardTitle>Model Pricing Reference</CardTitle>
									<CardDescription>
										Current pricing per million tokens
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
										{[
											{
												provider: "OpenAI",
												models: [
													{ name: "GPT-4o", input: "$5.00", output: "$15.00" },
													{
														name: "GPT-4o-mini",
														input: "$0.15",
														output: "$0.60",
													},
													{
														name: "GPT-4 Turbo",
														input: "$10.00",
														output: "$30.00",
													},
												],
											},
											{
												provider: "Anthropic",
												models: [
													{
														name: "Claude 3.5 Sonnet",
														input: "$3.00",
														output: "$15.00",
													},
													{
														name: "Claude 3 Haiku",
														input: "$0.25",
														output: "$1.25",
													},
													{
														name: "Claude 3 Opus",
														input: "$15.00",
														output: "$75.00",
													},
												],
											},
											{
												provider: "Google",
												models: [
													{
														name: "Gemini 1.5 Pro",
														input: "$3.50",
														output: "$10.50",
													},
													{
														name: "Gemini 1.5 Flash",
														input: "$0.075",
														output: "$0.30",
													},
												],
											},
										].map((provider) => (
											<Card key={provider.provider} className="border">
												<CardHeader className="pb-2">
													<CardTitle className="text-base flex items-center gap-2">
														<Cpu className="h-4 w-4" />
														{provider.provider}
													</CardTitle>
												</CardHeader>
												<CardContent>
													<div className="space-y-2 text-sm">
														{provider.models.map((model) => (
															<div
																key={model.name}
																className="flex justify-between"
															>
																<span className="text-muted-foreground">
																	{model.name}
																</span>
																<span className="font-mono text-xs">
																	{model.input} / {model.output}
																</span>
															</div>
														))}
													</div>
												</CardContent>
											</Card>
										))}
									</div>
								</CardContent>
							</Card>

							{/* Cost Alerts */}
							<Card className="border-amber-500/50">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<AlertTriangle className="h-5 w-5 text-amber-500" />
										Cost Alerts
									</CardTitle>
									<CardDescription>
										Set up alerts for cost thresholds
									</CardDescription>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-muted-foreground">
										Cost alerting is coming soon. You'll be able to set daily,
										weekly, and monthly budget alerts.
									</p>
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>
				</>
			)}
		</div>
	);
}
