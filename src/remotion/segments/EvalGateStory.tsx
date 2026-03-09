import type React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { card, colors } from "../styles";

export const HookPain: React.FC = () => {
	const frame = useCurrentFrame();
	const opacity = interpolate(frame, [0, 10], [0, 1], {
		extrapolateRight: "clamp",
	});
	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: "0 180px",
				textAlign: "center",
				opacity,
			}}
		>
			<div style={{ fontSize: 74, fontWeight: 800, lineHeight: 1.12 }}>
				You shipped a prompt change. Quality dropped 15%. You found out from a
				user.
			</div>
		</div>
	);
};

export const HookCatch: React.FC = () => {
	const frame = useCurrentFrame();
	const scale = interpolate(frame, [0, 16], [0.9, 1], {
		extrapolateRight: "clamp",
	});
	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				textAlign: "center",
				transform: `scale(${scale})`,
			}}
		>
			<div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1.05 }}>
				EvalGate catches it in CI
				<br />
				before it ships.
			</div>
		</div>
	);
};

export const QuickStartTerminal: React.FC = () => {
	const frame = useCurrentFrame();
	const cmd1 = "npx @evalgate/sdk init";
	const cmd2 = "git push";
	const cmd1Chars = Math.min(
		cmd1.length,
		Math.floor(
			interpolate(frame, [0, 60], [0, cmd1.length], {
				extrapolateRight: "clamp",
			}),
		),
	);
	const cmd2Chars = Math.min(
		cmd2.length,
		Math.floor(
			interpolate(frame, [70, 110], [0, cmd2.length], {
				extrapolateRight: "clamp",
				extrapolateLeft: "clamp",
			}),
		),
	);
	const showResult = frame > 120;
	const cursorVisible = Math.floor(frame / 8) % 2 === 0;

	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<div
				style={{
					...card,
					width: 1300,
					height: 620,
					backgroundColor: "#0b1220",
					border: "1px solid #273449",
					padding: 28,
					fontFamily: "Consolas, Menlo, monospace",
				}}
			>
				<div style={{ fontSize: 18, color: "#7dd3fc", marginBottom: 22 }}>
					Terminal
				</div>
				<div style={{ fontSize: 36, lineHeight: 1.7, color: "#e2e8f0" }}>
					<div>
						<span style={{ color: "#34d399" }}>$</span>{" "}
						{cmd1.slice(0, cmd1Chars)}
						{cmd1Chars < cmd1.length && cursorVisible ? <span>_</span> : null}
					</div>
					<div>
						<span style={{ color: "#34d399" }}>$</span>{" "}
						{cmd2.slice(0, cmd2Chars)}
						{cmd1Chars >= cmd1.length &&
						cmd2Chars < cmd2.length &&
						cursorVisible ? (
							<span>_</span>
						) : null}
					</div>
					{showResult ? (
						<div style={{ marginTop: 18, color: "#22c55e", fontSize: 28 }}>
							Workflow added. Push triggered CI.
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
};

export const QuickStartSummary: React.FC = () => {
	const frame = useCurrentFrame();
	const scale = interpolate(frame, [0, 40], [0.94, 1], {
		extrapolateRight: "clamp",
	});
	const highlightRow = Math.floor(
		interpolate(frame, [30, 270], [0, 3], {
			extrapolateRight: "clamp",
			extrapolateLeft: "clamp",
		}),
	);
	const rowHighlights = [
		{ y: 176, label: "Score" },
		{ y: 200, label: "Pass rate" },
		{ y: 224, label: "Safety" },
	];
	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				gap: 22,
			}}
		>
			<div style={{ fontSize: 34, fontWeight: 700 }}>
				GitHub Actions — blocked before merge
			</div>
			<div
				style={{
					...card,
					padding: 22,
					flex: 1,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					position: "relative",
				}}
			>
				<Img
					src={staticFile("remotion/evalai-gate-step-summary.svg")}
					style={{ width: 1450, transform: `scale(${scale})` }}
				/>
				{highlightRow < rowHighlights.length && (
					<div
						style={{
							position: "absolute",
							top: rowHighlights[highlightRow].y - 120,
							left: 60,
							right: 60,
							height: 28,
							backgroundColor: "rgba(239, 68, 68, 0.15)",
							border: "1px solid rgba(239, 68, 68, 0.4)",
							borderRadius: 4,
						}}
					/>
				)}
			</div>
		</div>
	);
};

const LOOP_STEPS = [
	{
		label: "collect",
		description: "Capture real failures from production traces.",
	},
	{ label: "detect", description: "Classify failure patterns and severity." },
	{
		label: "generate",
		description: "Turn failures into candidate regression tests.",
	},
	{
		label: "promote",
		description: "Approve high-signal cases into your suite.",
	},
	{ label: "gate", description: "Run in CI and compare against baseline." },
	{
		label: "ship",
		description: "Merge with confidence when quality is stable.",
	},
];

export const LoopFlow: React.FC = () => {
	const frame = useCurrentFrame();
	const stepWindow = 18;
	const activeIndex = Math.min(
		LOOP_STEPS.length - 1,
		Math.floor(frame / stepWindow),
	);

	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				gap: 34,
			}}
		>
			<div
				style={{
					display: "flex",
					gap: 14,
					flexWrap: "wrap",
					justifyContent: "center",
				}}
			>
				{LOOP_STEPS.map((step, idx) => {
					const isActive = idx === activeIndex;
					const isDone = idx < activeIndex;
					return (
						<div
							key={step.label}
							style={{
								padding: "14px 20px",
								borderRadius: 999,
								fontSize: 34,
								fontWeight: 800,
								letterSpacing: 0.2,
								backgroundColor: isActive
									? colors.primary
									: isDone
										? colors.greenDim
										: colors.bgMuted,
								color: isActive
									? "#fff"
									: isDone
										? colors.green
										: colors.textMuted,
							}}
						>
							{step.label}
						</div>
					);
				})}
			</div>
			<div
				style={{ textAlign: "center", fontSize: 30, color: colors.textMuted }}
			>
				{LOOP_STEPS[activeIndex]?.description}
			</div>
		</div>
	);
};

const NETWORK_ROWS = [
	{
		command: "gate",
		network: "Offline",
		notes: "Runs tests + compares local baseline",
	},
	{
		command: "check",
		network: "Online",
		notes: "Posts annotations, fetches quality data",
	},
	{ command: "import", network: "Online", notes: "Uploads run data" },
	{ command: "traces", network: "Online", notes: "Sends spans to platform" },
	{
		command: "explain",
		network: "Offline",
		notes: "Reads local report artifact",
	},
];

export const TrustTable: React.FC = () => {
	const frame = useCurrentFrame();
	const highlight = interpolate(frame, [16, 40], [0, 1], {
		extrapolateRight: "clamp",
		extrapolateLeft: "clamp",
	});
	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				gap: 20,
			}}
		>
			<div style={{ fontSize: 36, fontWeight: 800 }}>
				Offline vs Online Trust Signal
			</div>
			<div style={{ ...card, padding: 20 }}>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "1.2fr 1fr 2.6fr",
						padding: "0 10px 12px",
						color: colors.textMuted,
						fontSize: 20,
						borderBottom: `1px solid ${colors.border}`,
					}}
				>
					<div>Command</div>
					<div>Network</div>
					<div>Notes</div>
				</div>
				{NETWORK_ROWS.map((row) => {
					const offline = row.network === "Offline";
					return (
						<div
							key={row.command}
							style={{
								display: "grid",
								gridTemplateColumns: "1.2fr 1fr 2.6fr",
								padding: "16px 10px",
								borderBottom: `1px solid ${colors.bgMuted}`,
								fontSize: 24,
								backgroundColor: offline
									? `rgba(34,197,94,${0.1 + 0.16 * highlight})`
									: "transparent",
							}}
						>
							<div style={{ fontWeight: 700 }}>{row.command}</div>
							<div
								style={{
									color: offline ? colors.green : colors.amber,
									fontWeight: 700,
								}}
							>
								{row.network}
							</div>
							<div style={{ color: colors.textMuted }}>{row.notes}</div>
						</div>
					);
				})}
			</div>
			<div style={{ fontSize: 30, color: colors.green, fontWeight: 700 }}>
				gate + explain never phone home.
			</div>
		</div>
	);
};

export const ExplainShowcase: React.FC = () => {
	const frame = useCurrentFrame();
	const highlightSection = Math.floor(
		interpolate(frame, [30, 97, 103, 197, 203, 400], [0, 1, 1, 2, 2, 3], {
			extrapolateRight: "clamp",
			extrapolateLeft: "clamp",
		}),
	);
	const sectionHighlights = [
		{ y: 116, label: "Verdict" },
		{ y: 188, label: "What changed" },
		{ y: 260, label: "Top failing cases" },
	];
	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				gap: 20,
			}}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<div style={{ fontSize: 34, fontWeight: 800 }}>
					Debug regressions in seconds
				</div>
				<div
					style={{
						fontFamily: "Consolas, monospace",
						fontSize: 26,
						color: colors.green,
					}}
				>
					npx evalgate explain
				</div>
			</div>
			<div
				style={{
					...card,
					padding: 24,
					flex: 1,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					position: "relative",
				}}
			>
				<Img
					src={staticFile("remotion/evalai-explain-terminal.svg")}
					style={{ width: 1400 }}
				/>
				{highlightSection < sectionHighlights.length && (
					<div
						style={{
							position: "absolute",
							top: sectionHighlights[highlightSection].y - 90,
							left: 40,
							right: 40,
							height: 32,
							backgroundColor: "rgba(34, 197, 94, 0.12)",
							border: "1px solid rgba(34, 197, 94, 0.3)",
							borderRadius: 4,
						}}
					/>
				)}
			</div>
		</div>
	);
};

export const RemoveAnytime: React.FC = () => {
	const frame = useCurrentFrame();
	const opacity = interpolate(frame, [0, 18], [0, 1], {
		extrapolateRight: "clamp",
	});
	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				alignItems: "center",
				gap: 30,
				opacity,
			}}
		>
			<div style={{ fontSize: 58, fontWeight: 800, textAlign: "center" }}>
				Remove anytime.
			</div>
			<div
				style={{
					...card,
					padding: "22px 28px",
					fontFamily: "Consolas, monospace",
					fontSize: 30,
					color: "#e2e8f0",
					backgroundColor: "#0b1220",
				}}
			>
				$ rm evalgate.config.json evals/ .github/workflows/evalgate-gate.yml
			</div>
			<div
				style={{ fontSize: 34, color: colors.textMuted, textAlign: "center" }}
			>
				No account cancellation. No data export. Your tests keep working.
			</div>
		</div>
	);
};
