// src/components/arena/leaderboard.tsx
"use client";

import {
	BarChart3,
	Clock,
	DollarSign,
	Filter,
	Minus,
	RefreshCw,
	TrendingDown,
	TrendingUp,
	Trophy,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
	modelId: string;
	modelLabel: string;
	totalMatches: number;
	wins: number;
	losses: number;
	draws: number;
	winRate: number;
	averageScore: number;
	averageResponseTime: number;
	totalCost: number;
	lastMatchAt: string;
	streak: number;
}

interface ArenaLeaderboardProps {
	organizationId: number;
	className?: string;
}

export function ArenaLeaderboard({
	organizationId: _organizationId,
	className,
}: ArenaLeaderboardProps) {
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [timeRange, setTimeRange] = useState(30);
	const [_sortBy, _setSortBy] = useState<
		"winRate" | "totalMatches" | "averageScore"
	>("winRate");

	const fetchLeaderboard = useCallback(async () => {
		setIsLoading(true);
		try {
			const response = await fetch(
				`/api/arena-matches/leaderboard?limit=50&days=${timeRange}`,
				{
					method: "GET",
					headers: {
						"Content-Type": "application/json",
					},
				},
			);

			if (!response.ok) {
				throw new Error("Failed to fetch leaderboard");
			}

			const data = await response.json();
			setLeaderboard(data);
		} catch (error) {
			logger.error("Leaderboard fetch error", error);
		} finally {
			setIsLoading(false);
		}
	}, [timeRange]);

	useEffect(() => {
		fetchLeaderboard();
	}, [fetchLeaderboard]);

	const getStreakIcon = (streak: number) => {
		if (streak > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
		if (streak < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
		return <Minus className="h-4 w-4 text-gray-500" />;
	};

	const getStreakColor = (streak: number) => {
		if (streak > 0) return "text-green-600";
		if (streak < 0) return "text-red-600";
		return "text-gray-600";
	};

	const getRankIcon = (rank: number) => {
		if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
		if (rank === 2) return <Trophy className="h-5 w-5 text-gray-400" />;
		if (rank === 3) return <Trophy className="h-5 w-5 text-orange-600" />;
		return (
			<span className="text-sm font-medium text-muted-foreground">#{rank}</span>
		);
	};

	const getWinRateColor = (winRate: number) => {
		if (winRate >= 80) return "text-green-600";
		if (winRate >= 60) return "text-yellow-600";
		return "text-red-600";
	};

	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Trophy className="h-5 w-5" />
						Arena Leaderboard
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8">
						<RefreshCw className="h-8 w-8 animate-spin" />
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Trophy className="h-5 w-5" />
							Arena Leaderboard
						</CardTitle>
						<CardDescription>
							Track model performance in competitive battles
						</CardDescription>
					</div>
					<Button variant="outline" size="sm" onClick={fetchLeaderboard}>
						<RefreshCw className="h-4 w-4 mr-2" />
						Refresh
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<Tabs defaultValue="leaderboard" className="w-full">
					<div className="flex items-center justify-between mb-4">
						<TabsList>
							<TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
							<TabsTrigger value="stats">Statistics</TabsTrigger>
						</TabsList>

						<div className="flex items-center gap-2">
							<Filter className="h-4 w-4" />
							<select
								value={timeRange.toString()}
								onChange={(e) => setTimeRange(parseInt(e.target.value, 10))}
								className="text-sm border rounded px-2 py-1"
							>
								<option value="7">Last 7 days</option>
								<option value="30">Last 30 days</option>
								<option value="90">Last 90 days</option>
								<option value="365">Last year</option>
							</select>
						</div>
					</div>

					<TabsContent value="leaderboard" className="space-y-4">
						<div className="space-y-2">
							{leaderboard.map((entry, index) => (
								<div
									key={entry.modelId}
									className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
								>
									<div className="flex items-center gap-4">
										<div className="flex items-center justify-center w-12">
											{getRankIcon(index + 1)}
										</div>

										<div className="space-y-1">
											<div className="font-semibold">{entry.modelLabel}</div>
											<div className="flex items-center gap-2 text-sm text-muted-foreground">
												<span>{entry.totalMatches} matches</span>
												<span>•</span>
												<span>
													{entry.wins}W - {entry.losses}L - {entry.draws}D
												</span>
											</div>
										</div>
									</div>

									<div className="flex items-center gap-6">
										<div className="text-right">
											<div
												className={cn(
													"text-lg font-bold",
													getWinRateColor(entry.winRate),
												)}
											>
												{entry.winRate.toFixed(1)}%
											</div>
											<div className="text-xs text-muted-foreground">
												Win Rate
											</div>
										</div>

										<div className="text-right">
											<div className="text-lg font-bold">
												{entry.averageScore.toFixed(0)}
											</div>
											<div className="text-xs text-muted-foreground">
												Avg Score
											</div>
										</div>

										<div className="text-right">
											<div className="flex items-center gap-1">
												{getStreakIcon(entry.streak)}
												<span
													className={cn(
														"font-medium",
														getStreakColor(entry.streak),
													)}
												>
													{Math.abs(entry.streak)}
												</span>
											</div>
											<div className="text-xs text-muted-foreground">
												Streak
											</div>
										</div>

										<div className="text-right">
											<div className="flex items-center gap-1 text-sm">
												<Clock className="h-3 w-3" />
												<span>
													{(entry.averageResponseTime / 1000).toFixed(1)}s
												</span>
											</div>
											<div className="text-xs text-muted-foreground">
												Avg Time
											</div>
										</div>

										<div className="text-right">
											<div className="flex items-center gap-1 text-sm">
												<DollarSign className="h-3 w-3" />
												<span>${entry.totalCost.toFixed(2)}</span>
											</div>
											<div className="text-xs text-muted-foreground">
												Total Cost
											</div>
										</div>
									</div>
								</div>
							))}
						</div>

						{leaderboard.length === 0 && (
							<div className="text-center py-8 text-muted-foreground">
								<BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
								<p>No arena matches found</p>
								<p className="text-sm">
									Start some battles to see the leaderboard!
								</p>
							</div>
						)}
					</TabsContent>

					<TabsContent value="stats" className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm">Total Battles</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{leaderboard.reduce(
											(sum, entry) => sum + entry.totalMatches,
											0,
										)}
									</div>
									<p className="text-xs text-muted-foreground">
										Across all models
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm">Average Score</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{leaderboard.length > 0
											? (
													leaderboard.reduce(
														(sum, entry) => sum + entry.averageScore,
														0,
													) / leaderboard.length
												).toFixed(1)
											: "0"}
									</div>
									<p className="text-xs text-muted-foreground">
										Across all matches
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm">Total Cost</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										$
										{leaderboard
											.reduce((sum, entry) => sum + entry.totalCost, 0)
											.toFixed(2)}
									</div>
									<p className="text-xs text-muted-foreground">
										In arena battles
									</p>
								</CardContent>
							</Card>
						</div>

						<div className="space-y-4">
							<h3 className="text-lg font-semibold">Model Performance</h3>
							<div className="space-y-3">
								{leaderboard.map((entry) => (
									<div key={entry.modelId} className="space-y-2">
										<div className="flex items-center justify-between">
											<span className="font-medium">{entry.modelLabel}</span>
											<Badge
												variant={entry.winRate >= 70 ? "default" : "secondary"}
											>
												{entry.winRate.toFixed(1)}% Win Rate
											</Badge>
										</div>
										<div className="grid grid-cols-4 gap-4 text-sm">
											<div>
												<span className="text-muted-foreground">Score:</span>
												<span className="font-medium ml-1">
													{entry.averageScore.toFixed(0)}
												</span>
											</div>
											<div>
												<span className="text-muted-foreground">Time:</span>
												<span className="font-medium ml-1">
													{(entry.averageResponseTime / 1000).toFixed(1)}s
												</span>
											</div>
											<div>
												<span className="text-muted-foreground">Cost:</span>
												<span className="font-medium ml-1">
													${entry.totalCost.toFixed(2)}
												</span>
											</div>
											<div>
												<span className="text-muted-foreground">Streak:</span>
												<span
													className={cn(
														"font-medium ml-1",
														getStreakColor(entry.streak),
													)}
												>
													{entry.streak > 0 ? "+" : ""}
													{entry.streak}
												</span>
											</div>
										</div>
										<Progress value={entry.winRate} className="h-2" />
									</div>
								))}
							</div>
						</div>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}
