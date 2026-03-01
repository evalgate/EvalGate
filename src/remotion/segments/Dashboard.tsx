import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { badge, card, colors } from "../styles";

const stats = [
	{ label: "Total Evaluations", value: "24", color: colors.primary },
	{ label: "Recent Runs", value: "156", color: colors.green },
	{ label: "Active Traces", value: "1,247", color: colors.blue },
	{ label: "Avg Quality Score", value: "87%", color: colors.amber },
];

const quickActions = [
	{ label: "Create Evaluation", accent: colors.primary },
	{ label: "View Traces", accent: colors.blue },
	{ label: "Browse Templates", accent: colors.green },
];

const recentRuns = [
	{
		name: "Customer Support v3",
		status: "passed",
		score: "92%",
		time: "2 min ago",
	},
	{
		name: "RAG Retrieval Pipeline",
		status: "passed",
		score: "88%",
		time: "18 min ago",
	},
	{
		name: "Code Review Agent",
		status: "failed",
		score: "61%",
		time: "1 hr ago",
	},
	{
		name: "Safety Filter v2",
		status: "passed",
		score: "95%",
		time: "3 hr ago",
	},
];

export const Dashboard: React.FC = () => {
	const frame = useCurrentFrame();

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
			<div>
				<div
					style={{
						fontSize: 32,
						fontWeight: 700,
						opacity: interpolate(frame, [0, 12], [0, 1], {
							extrapolateRight: "clamp",
						}),
					}}
				>
					Dashboard
				</div>
				<div
					style={{
						fontSize: 18,
						color: colors.textMuted,
						marginTop: 4,
						opacity: interpolate(frame, [5, 18], [0, 1], {
							extrapolateRight: "clamp",
						}),
					}}
				>
					Welcome back! Here's an overview of your evaluation platform.
				</div>
			</div>

			<div style={{ display: "flex", gap: 20 }}>
				{stats.map((s, i) => {
					const delay = 10 + i * 8;
					const o = interpolate(frame, [delay, delay + 15], [0, 1], {
						extrapolateRight: "clamp",
						extrapolateLeft: "clamp",
					});
					const y = interpolate(frame, [delay, delay + 15], [18, 0], {
						extrapolateRight: "clamp",
						extrapolateLeft: "clamp",
					});
					return (
						<div
							key={s.label}
							style={{
								...card,
								flex: 1,
								padding: 24,
								opacity: o,
								transform: `translateY(${y}px)`,
							}}
						>
							<div
								style={{ fontSize: 14, color: colors.textMuted, marginBottom: 8 }}
							>
								{s.label}
							</div>
							<div style={{ fontSize: 36, fontWeight: 700, color: s.color }}>
								{s.value}
							</div>
						</div>
					);
				})}
			</div>

			<div style={{ display: "flex", gap: 20 }}>
				<div style={{ flex: 2 }}>
					<div
						style={{
							...card,
							padding: 24,
							opacity: interpolate(frame, [50, 65], [0, 1], {
								extrapolateRight: "clamp",
								extrapolateLeft: "clamp",
							}),
						}}
					>
						<div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
							Recent Runs
						</div>
						{recentRuns.map((r, i) => {
							const delay = 55 + i * 10;
							const o = interpolate(frame, [delay, delay + 12], [0, 1], {
								extrapolateRight: "clamp",
								extrapolateLeft: "clamp",
							});
							return (
								<div
									key={r.name}
									style={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										padding: "12px 0",
										borderBottom:
											i < recentRuns.length - 1
												? `1px solid ${colors.border}`
												: "none",
										opacity: o,
									}}
								>
									<div>
										<div style={{ fontSize: 15, fontWeight: 500 }}>{r.name}</div>
										<div style={{ fontSize: 13, color: colors.textDim }}>
											{r.time}
										</div>
									</div>
									<div style={{ display: "flex", gap: 12, alignItems: "center" }}>
										<span style={{ fontSize: 16, fontWeight: 600 }}>
											{r.score}
										</span>
										<span
											style={badge(
												r.status === "passed" ? "default" : "destructive",
											)}
										>
											{r.status}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				<div style={{ flex: 1 }}>
					<div
						style={{
							...card,
							padding: 24,
							opacity: interpolate(frame, [50, 65], [0, 1], {
								extrapolateRight: "clamp",
								extrapolateLeft: "clamp",
							}),
						}}
					>
						<div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
							Quick Actions
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
							{quickActions.map((a, i) => {
								const delay = 60 + i * 10;
								const o = interpolate(frame, [delay, delay + 12], [0, 1], {
									extrapolateRight: "clamp",
									extrapolateLeft: "clamp",
								});
								return (
									<div
										key={a.label}
										style={{
											padding: "14px 18px",
											borderRadius: 10,
											backgroundColor: colors.bgMuted,
											border: `1px solid ${colors.border}`,
											fontSize: 15,
											fontWeight: 500,
											color: a.accent,
											opacity: o,
										}}
									>
										{a.label}
									</div>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
