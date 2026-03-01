import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { SDK_CODE, SDK_INSTALL } from "../data";
import { card } from "../styles";

function colorizeCode(code: string): React.ReactNode {
	const parts: React.ReactNode[] = [];
	let remaining = code;
	let key = 0;
	const rules: Array<{ pattern: RegExp; color: string }> = [
		{ pattern: /^(import|from|const|await|new)\b/, color: "#c084fc" },
		{ pattern: /^('.*?'|".*?")/, color: "#4ade80" },
		{ pattern: /^(\d+)/, color: "#fbbf24" },
		{ pattern: /^(\/\/.*)/, color: "#71717a" },
		{ pattern: /^(\{|\}|\(|\)|;|,|:|\.)/, color: "#71717a" },
	];
	while (remaining.length > 0) {
		let matched = false;
		for (const rule of rules) {
			const match = remaining.match(rule.pattern);
			if (match) {
				parts.push(
					<span key={key++} style={{ color: rule.color }}>
						{match[0]}
					</span>,
				);
				remaining = remaining.slice(match[0].length);
				matched = true;
				break;
			}
		}
		if (!matched) {
			parts.push(<span key={key++}>{remaining[0]}</span>);
			remaining = remaining.slice(1);
		}
	}
	return <>{parts}</>;
}

export const SDK: React.FC = () => {
	const frame = useCurrentFrame();

	const installChars = Math.min(
		SDK_INSTALL.length,
		Math.floor(
			interpolate(frame, [0, 40], [0, SDK_INSTALL.length], {
				extrapolateRight: "clamp",
			}),
		),
	);
	const visibleInstall = SDK_INSTALL.slice(0, installChars);

	const codeChars = Math.min(
		SDK_CODE.length,
		Math.floor(
			interpolate(frame, [30, 130], [0, SDK_CODE.length], {
				extrapolateRight: "clamp",
				extrapolateLeft: "clamp",
			}),
		),
	);
	const visibleCode = SDK_CODE.slice(0, codeChars);

	const cursorVisible = Math.floor(frame / 8) % 2 === 0;

	return (
		<div style={{ display: "flex", gap: 24, height: "100%" }}>
			<div
				style={{
					...card,
					flex: 1,
					backgroundColor: "#0c0c0c",
					border: "1px solid #333",
					padding: 28,
					display: "flex",
					flexDirection: "column",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginBottom: 24,
					}}
				>
					<div
						style={{
							width: 14,
							height: 14,
							borderRadius: "50%",
							backgroundColor: "#ff5f57",
						}}
					/>
					<div
						style={{
							width: 14,
							height: 14,
							borderRadius: "50%",
							backgroundColor: "#febc2e",
						}}
					/>
					<div
						style={{
							width: 14,
							height: 14,
							borderRadius: "50%",
							backgroundColor: "#28c840",
						}}
					/>
					<span style={{ marginLeft: 12, fontSize: 14, color: "#666" }}>
						Terminal
					</span>
				</div>
				<div style={{ fontFamily: "monospace", fontSize: 22, lineHeight: 1.8 }}>
					<span style={{ color: "#4ade80" }}>$</span>{" "}
					<span style={{ color: "#e4e4e7" }}>{visibleInstall}</span>
					{installChars < SDK_INSTALL.length && cursorVisible && (
						<span style={{ color: "#71717a" }}>▊</span>
					)}
				</div>
				{installChars >= SDK_INSTALL.length && (
					<div
						style={{
							marginTop: 16,
							fontFamily: "monospace",
							fontSize: 16,
							color: "#4ade80",
							opacity: interpolate(frame, [45, 55], [0, 1], {
								extrapolateRight: "clamp",
								extrapolateLeft: "clamp",
							}),
						}}
					>
						✓ added 1 package in 2.1s
					</div>
				)}
				<div
					style={{
						marginTop: "auto",
						display: "flex",
						alignItems: "center",
						gap: 12,
						opacity: interpolate(frame, [50, 65], [0, 1], {
							extrapolateRight: "clamp",
							extrapolateLeft: "clamp",
						}),
					}}
				>
					<div
						style={{
							backgroundColor: "#cb3837",
							color: "#fff",
							padding: "4px 12px",
							borderRadius: 4,
							fontSize: 13,
							fontWeight: 700,
							fontFamily: "monospace",
						}}
					>
						npm
					</div>
					<span style={{ color: "#a1a1aa", fontSize: 14 }}>
						@evalgate/sdk v1.3.0
					</span>
				</div>
			</div>

			<div
				style={{
					...card,
					flex: 1,
					backgroundColor: "#0c0c0c",
					border: "1px solid #333",
					padding: 28,
					display: "flex",
					flexDirection: "column",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginBottom: 20,
					}}
				>
					<span style={{ fontSize: 14, color: "#666" }}>📄</span>
					<span style={{ fontSize: 14, color: "#a1a1aa" }}>workflow.ts</span>
				</div>
				<pre
					style={{
						fontFamily: "monospace",
						fontSize: 16,
						lineHeight: 1.6,
						color: "#d4d4d8",
						whiteSpace: "pre-wrap",
						margin: 0,
						flex: 1,
						overflow: "hidden",
					}}
				>
					{colorizeCode(visibleCode)}
					{codeChars < SDK_CODE.length && cursorVisible && (
						<span style={{ color: "#71717a" }}>▊</span>
					)}
				</pre>
			</div>
		</div>
	);
};
