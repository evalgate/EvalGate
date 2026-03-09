import type React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { CAPTIONS, SEGMENTS } from "./data";
import {
	ExplainShowcase,
	HookCatch,
	HookPain,
	LoopFlow,
	QuickStartSummary,
	QuickStartTerminal,
	RemoveAnytime,
	TrustTable,
} from "./segments/EvalGateStory";
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
					{ seg: SEGMENTS.hookPain, El: HookPain },
					{ seg: SEGMENTS.hookCatch, El: HookCatch },
					{ seg: SEGMENTS.quickStartTerminal, El: QuickStartTerminal },
					{ seg: SEGMENTS.quickStartSummary, El: QuickStartSummary },
					{ seg: SEGMENTS.loop, El: LoopFlow },
					{ seg: SEGMENTS.trust, El: TrustTable },
					{ seg: SEGMENTS.explain, El: ExplainShowcase },
					{ seg: SEGMENTS.remove, El: RemoveAnytime },
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
						from={SEGMENTS.hookPain.start}
						durationInFrames={SEGMENTS.hookPain.duration}
					>
						<HookPain />
					</Sequence>

					<Sequence
						from={SEGMENTS.hookCatch.start}
						durationInFrames={SEGMENTS.hookCatch.duration}
					>
						<HookCatch />
					</Sequence>

					<Sequence
						from={SEGMENTS.quickStartTerminal.start}
						durationInFrames={SEGMENTS.quickStartTerminal.duration}
					>
						<QuickStartTerminal />
					</Sequence>

					<Sequence
						from={SEGMENTS.quickStartSummary.start}
						durationInFrames={SEGMENTS.quickStartSummary.duration}
					>
						<QuickStartSummary />
					</Sequence>

					<Sequence
						from={SEGMENTS.loop.start}
						durationInFrames={SEGMENTS.loop.duration}
					>
						<LoopFlow />
					</Sequence>

					<Sequence
						from={SEGMENTS.trust.start}
						durationInFrames={SEGMENTS.trust.duration}
					>
						<TrustTable />
					</Sequence>

					<Sequence
						from={SEGMENTS.explain.start}
						durationInFrames={SEGMENTS.explain.duration}
					>
						<ExplainShowcase />
					</Sequence>

					<Sequence
						from={SEGMENTS.remove.start}
						durationInFrames={SEGMENTS.remove.duration}
					>
						<RemoveAnytime />
					</Sequence>
				</div>

				<CaptionOverlay />
			</div>
		</AbsoluteFill>
	);
};
