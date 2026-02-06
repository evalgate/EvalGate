import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, badge as badgeStyle } from "../styles";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleScale = interpolate(frame, [0, 25], [0.85, 1], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const badgesOpacity = interpolate(frame, [35, 55], [0, 1], { extrapolateRight: "clamp" });
  const badgesY = interpolate(frame, [35, 55], [20, 0], { extrapolateRight: "clamp" });

  const badges = ["Visual Workflows", "Cost Tracking", "Benchmarking", "Published SDK"];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 30,
      }}
    >
      <div
        style={{
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 90, fontWeight: 800, letterSpacing: -2 }}>
          Eval<span style={{ color: colors.primary }}>AI</span>
        </div>
        <div
          style={{
            fontSize: 32,
            color: colors.textMuted,
            marginTop: 12,
            opacity: subtitleOpacity,
          }}
        >
          Agent Orchestration Platform
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          opacity: badgesOpacity,
          transform: `translateY(${badgesY}px)`,
        }}
      >
        {badges.map((b) => (
          <span key={b} style={{ ...badgeStyle("outline"), fontSize: 18, padding: "6px 20px" }}>
            {b}
          </span>
        ))}
      </div>
    </div>
  );
};
