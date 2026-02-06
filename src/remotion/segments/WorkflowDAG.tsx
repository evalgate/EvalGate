import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, card, nodeTypeColors } from "../styles";
import { WORKFLOW_NODES, WORKFLOW_EDGES } from "../data";

const NODE_W = 200;
const NODE_H = 70;

const typeIcons: Record<string, string> = {
  agent: "⚡", tool: "🔧", decision: "⑂", parallel: "☰", human: "👤", llm: "🤖",
};

export const WorkflowDAG: React.FC = () => {
  const frame = useCurrentFrame();
  const highlightIdx = Math.floor(frame / 20) % WORKFLOW_NODES.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      <div style={{ ...card, flex: 1, padding: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Workflow Graph</div>
        <div style={{ fontSize: 14, color: colors.textMuted, marginBottom: 20 }}>Click on a node to see details</div>
        <svg viewBox="0 0 880 420" width="100%" height="auto" style={{ maxHeight: 540 }}>
          <defs>
            <marker id="ah" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill={colors.textDim} />
            </marker>
          </defs>
          {WORKFLOW_EDGES.map((edge, i) => {
            const from = WORKFLOW_NODES.find((n) => n.id === edge.from)!;
            const to = WORKFLOW_NODES.find((n) => n.id === edge.to)!;
            const fx = from.x + NODE_W, fy = from.y + NODE_H / 2;
            const tx = to.x, ty = to.y + NODE_H / 2;
            const mx = (fx + tx) / 2;
            const edgeOpacity = interpolate(frame, [i * 5, i * 5 + 15], [0, 0.5], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
            return (
              <g key={i} opacity={edgeOpacity}>
                <path d={`M ${fx} ${fy} C ${mx} ${fy}, ${mx} ${ty}, ${tx} ${ty}`} fill="none" stroke={colors.border} strokeWidth={2} markerEnd="url(#ah)" />
                {edge.label && <text x={mx} y={(fy + ty) / 2 - 10} textAnchor="middle" fill={colors.textDim} fontSize={13}>{edge.label}</text>}
              </g>
            );
          })}
          {WORKFLOW_NODES.map((node, i) => {
            const ntc = nodeTypeColors[node.type] || nodeTypeColors.agent;
            const isHighlighted = i === highlightIdx;
            const nodeOpacity = interpolate(frame, [i * 6, i * 6 + 12], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
            return (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`} opacity={nodeOpacity}>
                <rect width={NODE_W} height={NODE_H} rx={10} fill={colors.bgCard} stroke={isHighlighted ? colors.primary : colors.border} strokeWidth={isHighlighted ? 3 : 1.5} />
                <rect width={5} height={NODE_H} rx={3} fill={ntc.accent} />
                <text x={18} y={28} fontSize={15} fill={colors.text} fontWeight={600}>{typeIcons[node.type] || "●"} {node.name}</text>
                <text x={18} y={48} fontSize={12} fill={colors.textDim}>{node.type}</text>
                <circle cx={NODE_W - 18} cy={20} r={5} fill={node.status === "completed" ? colors.green : node.status === "running" ? colors.blue : colors.textDim} />
                {node.requiresApproval && (
                  <g transform={`translate(${NODE_W - 80}, 42)`}>
                    <rect width={65} height={18} rx={9} fill={colors.amberDim} stroke="rgba(245,158,11,0.3)" strokeWidth={1} />
                    <text x={32} y={13} textAnchor="middle" fontSize={10} fill={colors.amber} fontWeight={600}>Approval</text>
                  </g>
                )}
                {node.blocked && (
                  <g transform={`translate(${NODE_W - 70}, 42)`}>
                    <rect width={55} height={18} rx={9} fill={colors.redDim} stroke="rgba(239,68,68,0.3)" strokeWidth={1} />
                    <text x={27} y={13} textAnchor="middle" fontSize={10} fill={colors.red} fontWeight={600}>Blocked</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
