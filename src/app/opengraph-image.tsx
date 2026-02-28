import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "EvalAI — Stop LLM regressions in CI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
	return new ImageResponse(
		<div
			style={{
				fontSize: 60,
				background: "linear-gradient(to bottom right, #0f172a, #1e293b)",
				color: "white",
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: 60,
			}}
		>
			<div style={{ fontSize: 80, fontWeight: "bold", marginBottom: 20 }}>
				EvalAI
			</div>
			<div style={{ fontSize: 36, opacity: 0.8 }}>
				Stop LLM regressions in CI in 2 minutes
			</div>
			<div style={{ fontSize: 24, opacity: 0.6, marginTop: 20 }}>
				No infra. No lock-in. Remove anytime.
			</div>
		</div>,
		{ ...size },
	);
}
