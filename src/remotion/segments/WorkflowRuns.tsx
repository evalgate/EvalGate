import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, card, badge as badgeStyle } from "../styles";
import { WORKFLOW_RUNS, HANDOFF_STATS } from "../data";

const statusColors: Record<string, { dot: string; label: string }> = {
  completed: { dot: colors.green, label: "✓ Completed" },
  failed: { dot: colors.red, label: "✗ Failed" },
  running: { dot: colors.blue, label: "● Running" },
};

export const WorkflowRuns: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", gap: 24, height: "100%" }}>
      <div style={{ ...card, flex: 1, padding: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Runs</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {WORKFLOW_RUNS.map((run, i) => {
            const delay = i * 12;
            const opacity = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
            const sc = statusColors[run.status];
            return (
              <div key={run.id} style={{ backgroundColor: colors.bgMuted, borderRadius: 10, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: sc.dot }} />
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{sc.label}</span>
                  <div style={{ display: "flex", gap: 16, fontSize: 14, color: colors.textMuted }}>
                    {run.duration && <span>⚡ {run.duration}ms</span>}
                    {run.cost && <span>💲 {run.cost}</span>}
                    <span>🤖 {run.agents} agents</span>
                    <span>→ {run.handoffs} handoffs</span>
                  </div>
                </div>
                <span style={{ fontSize: 13, color: colors.textDim }}>{run.time}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ ...card, flex: 1, padding: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Handoff Patterns</div>
        <div style={{ fontSize: 14, color: colors.textMuted, marginBottom: 20 }}>Agent-to-agent transitions</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {HANDOFF_STATS.map((h, i) => {
            const delay = 20 + i * 10;
            const opacity = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
            return (
              <div key={i} style={{ backgroundColor: colors.bgMuted, borderRadius: 10, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={badgeStyle("outline")}>{h.type}</span>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{h.from}</span>
                  <span style={{ color: colors.textDim }}>→</span>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{h.to}</span>
                </div>
                <span style={{ fontSize: 14, color: colors.textMuted }}>{h.count}×</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
