import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { badge, card, colors } from "../styles";

const traces = [
	{
		name: "chat-completion",
		session: "sess_a1b2c3",
		spans: 5,
		duration: "1.24s",
		status: "ok",
		time: "Just now",
	},
	{
		name: "rag-retrieval",
		session: "sess_d4e5f6",
		spans: 8,
		duration: "2.81s",
		status: "ok",
		time: "3 min ago",
	},
	{
		name: "agent-routing",
		session: "sess_g7h8i9",
		spans: 12,
		duration: "4.52s",
		status: "error",
		time: "15 min ago",
	},
	{
		name: "embedding-batch",
		session: "sess_j0k1l2",
		spans: 3,
		duration: "0.89s",
		status: "ok",
		time: "1 hr ago",
	},
];

const spanTimeline = [
	{ name: "RouterAgent", type: "llm", duration: 420, start: 0, depth: 0 },
	{ name: "embed-query", type: "tool", duration: 180, start: 50, depth: 1 },
	{
		name: "vector-search",
		type: "tool",
		duration: 310,
		start: 230,
		depth: 1,
	},
	{
		name: "TechnicalAgent",
		type: "llm",
		duration: 680,
		start: 540,
		depth: 0,
	},
	{
		name: "generate-response",
		type: "llm",
		duration: 520,
		start: 600,
		depth: 1,
	},
];

const typeColors: Record<string, string> = {
	llm: colors.purple,
	tool: colors.green,
};

export const Traces: React.FC = () => {
	const frame = useCurrentFrame();
	const maxEnd = Math.max(...spanTimeline.map((s) => s.start + s.duration));

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
					Traces
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
					Monitor LLM calls, tool invocations, and agent interactions
				</div>
			</div>

			<div style={{ display: "flex", gap: 20 }}>
				<div style={{ flex: 1 }}>
					<div
						style={{
							...card,
							padding: 24,
							opacity: interpolate(frame, [12, 25], [0, 1], {
								extrapolateRight: "clamp",
								extrapolateLeft: "clamp",
							}),
						}}
					>
						<div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
							Recent Traces
						</div>
						{traces.map((t, i) => {
							const delay = 18 + i * 10;
							const o = interpolate(frame, [delay, delay + 12], [0, 1], {
								extrapolateRight: "clamp",
								extrapolateLeft: "clamp",
							});
							return (
								<div
									key={t.name}
									style={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										padding: "14px 0",
										borderBottom:
											i < traces.length - 1
												? `1px solid ${colors.border}`
												: "none",
										opacity: o,
									}}
								>
									<div>
										<div style={{ fontSize: 15, fontWeight: 600 }}>{t.name}</div>
										<div
											style={{
												fontSize: 12,
												color: colors.textDim,
												fontFamily: "monospace",
											}}
										>
											{t.session}
										</div>
									</div>
									<div
										style={{
											display: "flex",
											gap: 14,
											alignItems: "center",
											fontSize: 13,
										}}
									>
										<span style={{ color: colors.textMuted }}>
											{t.spans} spans
										</span>
										<span style={{ color: colors.textMuted }}>{t.duration}</span>
										<span
											style={badge(
												t.status === "ok" ? "default" : "destructive",
											)}
										>
											{t.status}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				<div style={{ flex: 1.2 }}>
					<div
						style={{
							...card,
							padding: 24,
							opacity: interpolate(frame, [40, 55], [0, 1], {
								extrapolateRight: "clamp",
								extrapolateLeft: "clamp",
							}),
						}}
					>
						<div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
							Span Timeline
						</div>
						<div
							style={{
								fontSize: 13,
								color: colors.textDim,
								marginBottom: 20,
							}}
						>
							chat-completion · sess_a1b2c3
						</div>
						{spanTimeline.map((s, i) => {
							const delay = 48 + i * 10;
							const widthPct = (s.duration / maxEnd) * 100;
							const leftPct = (s.start / maxEnd) * 100;
							const barWidth = interpolate(
								frame,
								[delay, delay + 18],
								[0, widthPct],
								{ extrapolateRight: "clamp", extrapolateLeft: "clamp" },
							);
							const o = interpolate(frame, [delay, delay + 12], [0, 1], {
								extrapolateRight: "clamp",
								extrapolateLeft: "clamp",
							});
							return (
								<div
									key={`${s.name}-${s.start}`}
									style={{
										display: "flex",
										alignItems: "center",
										gap: 12,
										marginBottom: 14,
										paddingLeft: s.depth * 24,
										opacity: o,
									}}
								>
									<div
										style={{
											width: 100,
											fontSize: 13,
											fontWeight: 500,
											color: typeColors[s.type] || colors.text,
											flexShrink: 0,
										}}
									>
										{s.name}
									</div>
									<div
										style={{
											flex: 1,
											height: 20,
											position: "relative",
											backgroundColor: colors.bgMuted,
											borderRadius: 4,
											overflow: "hidden",
										}}
									>
										<div
											style={{
												position: "absolute",
												left: `${leftPct}%`,
												width: `${barWidth}%`,
												height: "100%",
												borderRadius: 4,
												backgroundColor: typeColors[s.type] || colors.primary,
												opacity: 0.7,
											}}
										/>
									</div>
									<div
										style={{
											fontSize: 12,
											color: colors.textDim,
											width: 50,
											textAlign: "right",
											flexShrink: 0,
										}}
									>
										{s.duration}ms
									</div>
								</div>
							);
						})}
						<div
							style={{
								display: "flex",
								gap: 16,
								marginTop: 16,
								fontSize: 12,
								color: colors.textDim,
							}}
						>
							<span>
								<span
									style={{
										display: "inline-block",
										width: 10,
										height: 10,
										borderRadius: 2,
										backgroundColor: colors.purple,
										marginRight: 6,
									}}
								/>
								LLM
							</span>
							<span>
								<span
									style={{
										display: "inline-block",
										width: 10,
										height: 10,
										borderRadius: 2,
										backgroundColor: colors.green,
										marginRight: 6,
									}}
								/>
								Tool
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
