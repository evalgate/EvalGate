import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { LEADERBOARD, RADAR_DATA, RADAR_METRICS } from "../data";
import { badge as badgeStyle, card, colors } from "../styles";

const RANK_ICONS = ["👑", "🥈", "🥉"];

export const Benchmarks: React.FC = () => {
  const frame = useCurrentFrame();

  const cx = 170,
    cy = 140,
    r = 110;
  const angleStep = (2 * Math.PI) / RADAR_METRICS.length;

  const getPoint = (value: number, idx: number) => {
    const angle = idx * angleStep - Math.PI / 2;
    const dist = (value / 100) * r;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  };

  const makePolygon = (values: number[]) => {
    const animProgress = interpolate(frame, [20, 60], [0, 1], {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    });
    return values
      .map((v, i) => {
        const p = getPoint(v * animProgress, i);
        return `${p.x},${p.y}`;
      })
      .join(" ");
  };

  const radarSeries = [
    { key: "react", label: "ReAct", color: "#8b5cf6", data: RADAR_DATA.react },
    { key: "cot", label: "CoT", color: "#3b82f6", data: RADAR_DATA.cot },
    { key: "tot", label: "ToT", color: "#22c55e", data: RADAR_DATA.tot },
  ];

  return (
    <div style={{ display: "flex", gap: 24, height: "100%" }}>
      <div style={{ ...card, flex: 1, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 20 }}>🏆</span>
          <span style={{ fontSize: 20, fontWeight: 600 }}>Leaderboard</span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "40px 1fr 80px 70px 70px 60px",
            gap: 8,
            padding: "0 12px 8px",
            fontSize: 12,
            color: colors.textDim,
            fontWeight: 600,
          }}
        >
          <span>#</span>
          <span>Agent</span>
          <span>Arch</span>
          <span style={{ textAlign: "right" }}>Acc</span>
          <span style={{ textAlign: "right" }}>Lat</span>
          <span style={{ textAlign: "right" }}>Score</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LEADERBOARD.map((entry, i) => {
            const delay = i * 8;
            const opacity = interpolate(frame, [delay, delay + 12], [0, 1], {
              extrapolateRight: "clamp",
              extrapolateLeft: "clamp",
            });
            return (
              <div
                key={entry.rank}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr 80px 70px 70px 60px",
                  gap: 8,
                  alignItems: "center",
                  backgroundColor: colors.bgMuted,
                  borderRadius: 8,
                  padding: "12px",
                  fontSize: 14,
                  opacity,
                }}
              >
                <span style={{ fontSize: 18 }}>{RANK_ICONS[i] || `${entry.rank}`}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{entry.name}</div>
                  <div style={{ fontSize: 11, color: colors.textDim }}>{entry.model}</div>
                </div>
                <span style={badgeStyle("outline")}>{entry.arch}</span>
                <span
                  style={{
                    textAlign: "right",
                    fontWeight: entry.accuracy >= 90 ? 700 : 400,
                    color: entry.accuracy >= 90 ? colors.green : colors.text,
                  }}
                >
                  {entry.accuracy}%
                </span>
                <span style={{ textAlign: "right", color: colors.textMuted }}>
                  {entry.latency}ms
                </span>
                <span style={{ textAlign: "right", fontWeight: 700 }}>{entry.score}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ ...card, width: 400, padding: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>
          Architecture Comparison
        </div>
        <svg width={340} height={300} viewBox="0 0 340 300">
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <polygon
              key={pct}
              points={RADAR_METRICS.map((_, i) => {
                const p = getPoint(pct * 100, i);
                return `${p.x},${p.y}`;
              }).join(" ")}
              fill="none"
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {RADAR_METRICS.map((_, i) => {
            const p = getPoint(100, i);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={p.x}
                y2={p.y}
                stroke={colors.border}
                strokeWidth={1}
              />
            );
          })}
          {RADAR_METRICS.map((label, i) => {
            const p = getPoint(120, i);
            return (
              <text
                key={i}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12}
                fill={colors.textMuted}
              >
                {label}
              </text>
            );
          })}
          {radarSeries.map((series) => (
            <polygon
              key={series.key}
              points={makePolygon(series.data)}
              fill={series.color}
              fillOpacity={0.2}
              stroke={series.color}
              strokeWidth={2}
            />
          ))}
        </svg>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 8 }}>
          {radarSeries.map((s) => (
            <div
              key={s.key}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              <div
                style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: s.color }}
              />
              <span style={{ color: colors.textMuted }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
