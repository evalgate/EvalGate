import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { badge, card, colors } from "../styles";

const testCases = [
	{
		input: "What is your refund policy?",
		expected: "We offer a 30-day money-back guarantee…",
		result: "pass",
	},
	{
		input: "I need to cancel my subscription",
		expected: "Go to Settings → Billing → Cancel…",
		result: "pass",
	},
	{
		input: "Your product is terrible!",
		expected: "I'm sorry to hear that. Let me help…",
		result: "fail",
	},
	{
		input: "Can I upgrade to the pro plan?",
		expected: "Absolutely! You can upgrade from…",
		result: "pass",
	},
];

const qualityMetrics = [
	{ label: "Accuracy", value: 92 },
	{ label: "Relevance", value: 88 },
	{ label: "Coherence", value: 95 },
	{ label: "Safety", value: 100 },
];

export const EvaluationDetail: React.FC = () => {
	const frame = useCurrentFrame();

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-start",
					opacity: interpolate(frame, [0, 12], [0, 1], {
						extrapolateRight: "clamp",
					}),
				}}
			>
				<div>
					<div style={{ display: "flex", gap: 12, alignItems: "center" }}>
						<span style={{ fontSize: 28, fontWeight: 700 }}>
							Customer Support Quality
						</span>
						<span style={badge("default")}>Unit Test</span>
					</div>
					<div style={{ fontSize: 16, color: colors.textMuted, marginTop: 4 }}>
						12 test cases · 34 runs · Last run 2 min ago
					</div>
				</div>
			</div>

			<div style={{ display: "flex", gap: 20 }}>
				<div
					style={{
						...card,
						flex: 1,
						padding: 24,
						opacity: interpolate(frame, [10, 22], [0, 1], {
							extrapolateRight: "clamp",
							extrapolateLeft: "clamp",
						}),
					}}
				>
					<div style={{ fontSize: 14, color: colors.textMuted, marginBottom: 6 }}>
						AI Quality Score
					</div>
					<div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
						<span style={{ fontSize: 48, fontWeight: 700, color: colors.green }}>
							A
						</span>
						<span style={{ fontSize: 22, fontWeight: 600, color: colors.green }}>
							92/100
						</span>
					</div>
					<div style={{ fontSize: 13, color: colors.textDim, marginTop: 8 }}>
						Improved +4 pts from last run
					</div>
				</div>

				{[
					{ label: "Test Cases", value: "12", color: colors.primary },
					{ label: "Pass Rate", value: "92%", color: colors.green },
					{ label: "Avg Latency", value: "1.2s", color: colors.blue },
				].map((s, i) => {
					const delay = 14 + i * 6;
					const o = interpolate(frame, [delay, delay + 12], [0, 1], {
						extrapolateRight: "clamp",
						extrapolateLeft: "clamp",
					});
					return (
						<div
							key={s.label}
							style={{ ...card, flex: 1, padding: 24, opacity: o }}
						>
							<div
								style={{ fontSize: 14, color: colors.textMuted, marginBottom: 6 }}
							>
								{s.label}
							</div>
							<div style={{ fontSize: 32, fontWeight: 700, color: s.color }}>
								{s.value}
							</div>
						</div>
					);
				})}
			</div>

			<div style={{ display: "flex", gap: 20 }}>
				<div style={{ flex: 3 }}>
					<div
						style={{
							...card,
							padding: 24,
							opacity: interpolate(frame, [35, 50], [0, 1], {
								extrapolateRight: "clamp",
								extrapolateLeft: "clamp",
							}),
						}}
					>
						<div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
							Test Cases
						</div>
						{testCases.map((tc, i) => {
							const delay = 40 + i * 8;
							const o = interpolate(frame, [delay, delay + 12], [0, 1], {
								extrapolateRight: "clamp",
								extrapolateLeft: "clamp",
							});
							return (
								<div
									key={tc.input}
									style={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										padding: "14px 0",
										borderBottom:
											i < testCases.length - 1
												? `1px solid ${colors.border}`
												: "none",
										opacity: o,
									}}
								>
									<div style={{ flex: 1 }}>
										<div style={{ fontSize: 15, fontWeight: 500 }}>
											{tc.input}
										</div>
										<div
											style={{
												fontSize: 13,
												color: colors.textDim,
												marginTop: 2,
											}}
										>
											Expected: {tc.expected}
										</div>
									</div>
									<span
										style={badge(
											tc.result === "pass" ? "default" : "destructive",
										)}
									>
										{tc.result}
									</span>
								</div>
							);
						})}
					</div>
				</div>

				<div style={{ flex: 2 }}>
					<div
						style={{
							...card,
							padding: 24,
							opacity: interpolate(frame, [45, 60], [0, 1], {
								extrapolateRight: "clamp",
								extrapolateLeft: "clamp",
							}),
						}}
					>
						<div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
							Quality Metrics
						</div>
						{qualityMetrics.map((m, i) => {
							const delay = 50 + i * 8;
							const barWidth = interpolate(
								frame,
								[delay, delay + 20],
								[0, m.value],
								{ extrapolateRight: "clamp", extrapolateLeft: "clamp" },
							);
							return (
								<div key={m.label} style={{ marginBottom: 16 }}>
									<div
										style={{
											display: "flex",
											justifyContent: "space-between",
											fontSize: 14,
											marginBottom: 6,
										}}
									>
										<span style={{ color: colors.textMuted }}>{m.label}</span>
										<span style={{ fontWeight: 600 }}>
											{Math.round(barWidth)}%
										</span>
									</div>
									<div
										style={{
											height: 8,
											borderRadius: 4,
											backgroundColor: colors.bgMuted,
											overflow: "hidden",
										}}
									>
										<div
											style={{
												width: `${barWidth}%`,
												height: "100%",
												borderRadius: 4,
												backgroundColor:
													m.value >= 90 ? colors.green : colors.amber,
											}}
										/>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
};
