import type React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { CAPTIONS, SEGMENTS } from "./data";
import { Benchmarks } from "./segments/Benchmarks";
import { Closing } from "./segments/Closing";
import { CostsCharts } from "./segments/CostsCharts";
import { CostsSummary } from "./segments/CostsSummary";
import { Dashboard } from "./segments/Dashboard";
import { EvaluationDetail } from "./segments/EvaluationDetail";
import { EvaluationsList } from "./segments/EvaluationsList";
import { Intro } from "./segments/Intro";
import { SDK } from "./segments/SDK";
import { Traces } from "./segments/Traces";
import { WorkflowDAG } from "./segments/WorkflowDAG";
import { WorkflowRuns } from "./segments/WorkflowRuns";
import { WorkflowStats } from "./segments/WorkflowStats";
import { WorkflowsList } from "./segments/WorkflowsList";
import {
	captionBar,
	captionText,
	colors,
	contentArea,
	fullScreen,
} from "./styles";

const CaptionOverlay: React.FC = () => {
	const frame = useCurrentFrame();

	const activeCaption = CAPTIONS.find(
		(c) => frame >= c.startFrame && frame < c.endFrame,
	);

	if (!activeCaption) {
		return (
			<div style={captionBar}>
				<div style={{ ...captionText, color: "rgba(255,255,255,0.2)" }}>
					...
				</div>
			</div>
		);
	}

	const fadeIn = interpolate(
		frame,
		[activeCaption.startFrame, activeCaption.startFrame + 8],
		[0, 1],
		{ extrapolateRight: "clamp", extrapolateLeft: "clamp" },
	);
	const fadeOut = interpolate(
		frame,
		[activeCaption.endFrame - 8, activeCaption.endFrame],
		[1, 0],
		{
			extrapolateRight: "clamp",
			extrapolateLeft: "clamp",
		},
	);
	const opacity = Math.min(fadeIn, fadeOut);

	return (
		<div style={captionBar}>
			<div style={{ ...captionText, opacity }}>{activeCaption.text}</div>
		</div>
	);
};

const ProgressIndicator: React.FC = () => {
	const frame = useCurrentFrame();
	const segmentEntries = Object.entries(SEGMENTS);

	return (
		<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
			{segmentEntries.map(([key, seg]) => {
				const isActive = frame >= seg.start && frame < seg.start + seg.duration;
				const isDone = frame >= seg.start + seg.duration;

				return (
					<div
						key={key}
						style={{
							height: 6,
							borderRadius: 3,
							backgroundColor: isActive
								? colors.primary
								: isDone
									? "rgba(139, 92, 246, 0.4)"
									: colors.bgMuted,
							width: isActive ? 32 : 16,
						}}
					/>
				);
			})}
		</div>
	);
};

export const DemoStills: React.FC = () => {
	return (
		<AbsoluteFill>
			<div
				style={{
					width: 1920,
					height: 1080,
					backgroundColor: colors.bg,
					fontFamily:
						'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
					color: colors.text,
					overflow: "hidden",
					padding: "40px 60px",
					display: "flex",
					flexDirection: "column",
				}}
			>
				{[
					{ seg: SEGMENTS.dashboard, El: Dashboard },
					{ seg: SEGMENTS.evaluationsList, El: EvaluationsList },
					{ seg: SEGMENTS.evaluationDetail, El: EvaluationDetail },
					{ seg: SEGMENTS.traces, El: Traces },
					{ seg: SEGMENTS.workflowsList, El: WorkflowsList },
					{ seg: SEGMENTS.workflowDag, El: WorkflowDAG },
					{ seg: SEGMENTS.costsSummary, El: CostsSummary },
					{ seg: SEGMENTS.benchmarks, El: Benchmarks },
				].map(({ seg, El }) => (
					<Sequence
						key={seg.start}
						from={seg.start}
						durationInFrames={seg.duration}
						style={{ flex: 1 }}
					>
						<div style={{ width: "100%", height: "100%" }}>
							<El />
						</div>
					</Sequence>
				))}
			</div>
		</AbsoluteFill>
	);
};

export const DemoVideo: React.FC = () => {
	return (
		<AbsoluteFill>
			<div style={fullScreen}>
				<div
					style={{
						padding: "20px 80px",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<ProgressIndicator />
				</div>

				<div style={contentArea}>
					<Sequence
						from={SEGMENTS.intro.start}
						durationInFrames={SEGMENTS.intro.duration}
					>
						<Intro />
					</Sequence>

					<Sequence
						from={SEGMENTS.dashboard.start}
						durationInFrames={SEGMENTS.dashboard.duration}
					>
						<Dashboard />
					</Sequence>

					<Sequence
						from={SEGMENTS.evaluationsList.start}
						durationInFrames={SEGMENTS.evaluationsList.duration}
					>
						<EvaluationsList />
					</Sequence>

					<Sequence
						from={SEGMENTS.evaluationDetail.start}
						durationInFrames={SEGMENTS.evaluationDetail.duration}
					>
						<EvaluationDetail />
					</Sequence>

					<Sequence
						from={SEGMENTS.traces.start}
						durationInFrames={SEGMENTS.traces.duration}
					>
						<Traces />
					</Sequence>

					<Sequence
						from={SEGMENTS.workflowsList.start}
						durationInFrames={SEGMENTS.workflowsList.duration}
					>
						<WorkflowsList />
					</Sequence>

					<Sequence
						from={SEGMENTS.workflowStats.start}
						durationInFrames={SEGMENTS.workflowStats.duration}
					>
						<WorkflowStats />
					</Sequence>

					<Sequence
						from={SEGMENTS.workflowDag.start}
						durationInFrames={SEGMENTS.workflowDag.duration}
					>
						<WorkflowDAG />
					</Sequence>

					<Sequence
						from={SEGMENTS.workflowRuns.start}
						durationInFrames={SEGMENTS.workflowRuns.duration}
					>
						<WorkflowRuns />
					</Sequence>

					<Sequence
						from={SEGMENTS.costsSummary.start}
						durationInFrames={SEGMENTS.costsSummary.duration}
					>
						<CostsSummary />
					</Sequence>

					<Sequence
						from={SEGMENTS.costsCharts.start}
						durationInFrames={SEGMENTS.costsCharts.duration}
					>
						<CostsCharts />
					</Sequence>

					<Sequence
						from={SEGMENTS.benchmarks.start}
						durationInFrames={SEGMENTS.benchmarks.duration}
					>
						<Benchmarks />
					</Sequence>

					<Sequence
						from={SEGMENTS.sdk.start}
						durationInFrames={SEGMENTS.sdk.duration}
					>
						<SDK />
					</Sequence>

					<Sequence
						from={SEGMENTS.closing.start}
						durationInFrames={SEGMENTS.closing.duration}
					>
						<Closing />
					</Sequence>
				</div>

				<CaptionOverlay />
			</div>
		</AbsoluteFill>
	);
};
