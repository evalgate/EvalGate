import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, card, badge as badgeStyle } from "../styles";

const stats = [
  { label: "Total Runs", value: "156", color: colors.primary },
  { label: "Success Rate", value: "91.0%", color: colors.green },
  { label: "Avg Duration", value: "1,847ms", color: colors.amber },
  { label: "Total Cost", value: "$12.4200", color: colors.blue },
];

export const WorkflowStats: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 38, fontWeight: 700 }}>Customer Support Pipeline</div>
        <span style={badgeStyle("default")}>active</span>
      </div>

      <div style={{ display: "flex", gap: 24 }}>
        {stats.map((stat, i) => {
          const delay = i * 8;
          const opacity = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
          const translateY = interpolate(frame, [delay, delay + 15], [20, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

          return (
            <div
              key={stat.label}
              style={{ ...card, flex: 1, padding: 28, opacity, transform: `translateY(${translateY}px)` }}
            >
              <div style={{ fontSize: 16, color: colors.textMuted, marginBottom: 12 }}>{stat.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 36, fontWeight: 700 }}>{stat.value}</span>
                <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: stat.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
        {["Overview", "Runs (156)", "Handoffs"].map((tab, i) => (
          <div
            key={tab}
            style={{
              padding: "10px 24px",
              fontSize: 16,
              fontWeight: i === 0 ? 600 : 400,
              color: i === 0 ? colors.text : colors.textMuted,
              backgroundColor: i === 0 ? colors.bgMuted : "transparent",
              borderRadius: 8,
            }}
          >
            {tab}
          </div>
        ))}
      </div>
    </div>
  );
};
