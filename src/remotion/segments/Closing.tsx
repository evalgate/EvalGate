import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, badge as badgeStyle } from "../styles";

const items = [
  "Visual DAG Orchestration",
  "Cost Analytics",
  "Agent Benchmarking",
  "Published SDK on npm",
];

export const Closing: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const badgesOpacity = interpolate(frame, [100, 120], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 40 }}>
      <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2, opacity: titleOpacity }}>
        Eval<span style={{ color: colors.primary }}>AI</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {items.map((item, i) => {
          const delay = 15 + i * 15;
          const opacity = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
          const translateX = interpolate(frame, [delay, delay + 12], [30, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
          return (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 14, opacity, transform: `translateX(${translateX}px)` }}>
              <span style={{ color: colors.green, fontSize: 24 }}>✓</span>
              <span style={{ fontSize: 28 }}>{item}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 16, opacity: badgesOpacity }}>
        <span style={{ ...badgeStyle("default"), fontSize: 18, padding: "8px 24px" }}>Live on Vercel</span>
        <span style={{ ...badgeStyle("outline"), fontSize: 18, padding: "8px 24px" }}>Code on GitHub</span>
        <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 9999, padding: "8px 24px", fontSize: 18, fontWeight: 600, backgroundColor: colors.bgMuted, color: colors.textMuted }}>SDK on npm</span>
      </div>
    </div>
  );
};
