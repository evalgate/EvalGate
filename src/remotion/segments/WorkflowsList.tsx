import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { badge as badgeStyle, card, colors } from "../styles";

const workflows = [
  {
    name: "Customer Support Pipeline",
    status: "active",
    agents: 3,
    nodes: 6,
    runs: 156,
    success: 91,
  },
  { name: "Research Assistant", status: "active", agents: 3, nodes: 3, runs: 89, success: 96 },
  { name: "Code Review Pipeline", status: "draft", agents: 3, nodes: 4, runs: 12, success: 83 },
];

export const WorkflowsList: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30, height: "100%" }}>
      <div>
        <div style={{ fontSize: 42, fontWeight: 700 }}>Workflows</div>
        <div style={{ fontSize: 20, color: colors.textMuted, marginTop: 4 }}>
          Track and evaluate multi-agent workflows
        </div>
      </div>

      <div style={{ display: "flex", gap: 24 }}>
        {workflows.map((wf, i) => {
          const delay = i * 12;
          const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });
          const translateY = interpolate(frame, [delay, delay + 15], [25, 0], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });

          return (
            <div
              key={wf.name}
              style={{
                ...card,
                flex: 1,
                padding: 28,
                opacity,
                transform: `translateY(${translateY}px)`,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  <span style={{ fontSize: 18, fontWeight: 600 }}>{wf.name}</span>
                </div>
                <span style={badgeStyle(wf.status === "active" ? "default" : "outline")}>
                  {wf.status}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                  color: colors.textMuted,
                }}
              >
                <span style={{ color: colors.purple }}>●</span>
                <span>{wf.agents} agents</span>
                <span style={{ color: colors.textDim }}>›</span>
                <span style={{ color: colors.textDim }}>({wf.nodes} nodes)</span>
              </div>

              <div style={{ display: "flex", gap: 20, fontSize: 14, color: colors.textMuted }}>
                <span>{wf.runs} runs</span>
                <span style={{ color: colors.green }}>✓ {wf.success}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
