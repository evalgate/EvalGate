import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { badge, card, colors } from "../styles";

const evaluations = [
	{
		name: "Customer Support Quality",
		type: "unit_test",
		testCases: 12,
		lastRun: "2 min ago",
		passRate: 92,
		status: "active",
	},
	{
		name: "RAG Retrieval Accuracy",
		type: "model_eval",
		testCases: 24,
		lastRun: "1 hr ago",
		passRate: 88,
		status: "active",
	},
	{
		name: "Safety & Toxicity Filter",
		type: "unit_test",
		testCases: 48,
		lastRun: "3 hr ago",
		passRate: 97,
		status: "active",
	},
	{
		name: "Response Tone (Human)",
		type: "human_eval",
		testCases: 8,
		lastRun: "1 day ago",
		passRate: 74,
		status: "active",
	},
	{
		name: "GPT-4o vs Claude A/B",
		type: "ab_test",
		testCases: 16,
		lastRun: "2 days ago",
		passRate: 81,
		status: "completed",
	},
];

const typeBadge: Record<string, { label: string; variant: "default" | "outline" | "destructive" | "amber" }> = {
	unit_test: { label: "Unit Test", variant: "default" },
	model_eval: { label: "Model Eval", variant: "amber" },
	human_eval: { label: "Human Eval", variant: "outline" },
	ab_test: { label: "A/B Test", variant: "outline" },
};

export const EvaluationsList: React.FC = () => {
	const frame = useCurrentFrame();

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
					Evaluations
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
					Create and manage evaluation suites for your AI models
				</div>
			</div>

			<div
				style={{
					display: "flex",
					gap: 12,
					opacity: interpolate(frame, [12, 24], [0, 1], {
						extrapolateRight: "clamp",
						extrapolateLeft: "clamp",
					}),
				}}
			>
				{["All", "Unit Tests", "Model Eval", "Human Eval", "A/B Tests"].map(
					(tab, i) => (
						<div
							key={tab}
							style={{
								padding: "8px 18px",
								borderRadius: 8,
								fontSize: 14,
								fontWeight: 500,
								backgroundColor: i === 0 ? colors.primary : colors.bgMuted,
								color: i === 0 ? "#fff" : colors.textMuted,
								border:
									i === 0 ? "none" : `1px solid ${colors.border}`,
							}}
						>
							{tab}
						</div>
					),
				)}
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
				{evaluations.map((ev, i) => {
					const delay = 20 + i * 10;
					const o = interpolate(frame, [delay, delay + 14], [0, 1], {
						extrapolateRight: "clamp",
						extrapolateLeft: "clamp",
					});
					const y = interpolate(frame, [delay, delay + 14], [16, 0], {
						extrapolateRight: "clamp",
						extrapolateLeft: "clamp",
					});
					const tb = typeBadge[ev.type];
					return (
						<div
							key={ev.name}
							style={{
								...card,
								padding: "20px 24px",
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								opacity: o,
								transform: `translateY(${y}px)`,
							}}
						>
							<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
								<div>
									<div
										style={{
											fontSize: 17,
											fontWeight: 600,
											marginBottom: 4,
										}}
									>
										{ev.name}
									</div>
									<div
										style={{
											display: "flex",
											gap: 10,
											alignItems: "center",
											fontSize: 13,
											color: colors.textDim,
										}}
									>
										<span>{ev.testCases} test cases</span>
										<span>·</span>
										<span>Last run {ev.lastRun}</span>
									</div>
								</div>
							</div>
							<div style={{ display: "flex", gap: 14, alignItems: "center" }}>
								<span style={badge(tb.variant)}>{tb.label}</span>
								<div
									style={{
										width: 80,
										height: 6,
										borderRadius: 3,
										backgroundColor: colors.bgMuted,
										overflow: "hidden",
									}}
								>
									<div
										style={{
											width: `${ev.passRate}%`,
											height: "100%",
											borderRadius: 3,
											backgroundColor:
												ev.passRate >= 90
													? colors.green
													: ev.passRate >= 75
														? colors.amber
														: colors.red,
										}}
									/>
								</div>
								<span
									style={{
										fontSize: 14,
										fontWeight: 600,
										color:
											ev.passRate >= 90
												? colors.green
												: ev.passRate >= 75
													? colors.amber
													: colors.red,
										minWidth: 36,
									}}
								>
									{ev.passRate}%
								</span>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};
