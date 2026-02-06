import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, card } from "../styles";
import { COST_TRENDS, TOP_MODELS } from "../data";

export const CostsCharts: React.FC = () => {
  const frame = useCurrentFrame();

  const maxCost = Math.max(...COST_TRENDS.map((d) => d.cost));
  const chartW = 760;
  const chartH = 220;
  const padL = 50;
  const padB = 30;
  const plotW = chartW - padL - 20;
  const plotH = chartH - padB - 10;

  const visiblePoints = Math.min(
    COST_TRENDS.length,
    Math.max(1, Math.floor(interpolate(frame, [0, 60], [0, COST_TRENDS.length], { extrapolateRight: "clamp" })))
  );

  const points = COST_TRENDS.slice(0, visiblePoints).map((d, i) => ({
    x: padL + (i / (COST_TRENDS.length - 1)) * plotW,
    y: 10 + plotH - (d.cost / maxCost) * plotH,
    label: d.date,
    value: d.cost,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const pieOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const totalCost = TOP_MODELS.reduce((s, m) => s + m.cost, 0);
  let pieAngle = 0;

  const listOpacity = interpolate(frame, [70, 90], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ ...card, flex: 1, padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Cost Trend</div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16 }}>Daily spending</div>
          <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const y = 10 + plotH - pct * plotH;
              return (
                <g key={pct}>
                  <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke={colors.border} strokeWidth={1} strokeDasharray="4 4" />
                  <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={11} fill={colors.textDim}>${(maxCost * pct).toFixed(0)}</text>
                </g>
              );
            })}
            {COST_TRENDS.map((d, i) => (
              <text key={i} x={padL + (i / (COST_TRENDS.length - 1)) * plotW} y={chartH - 5} textAnchor="middle" fontSize={11} fill={colors.textDim}>{d.date}</text>
            ))}
            <path d={linePath} fill="none" stroke={colors.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.primary} />)}
            {visiblePoints >= 4 && (
              <g>
                <circle cx={points[3]?.x} cy={points[3]?.y} r={8} fill="none" stroke={colors.red} strokeWidth={2} />
                <text x={(points[3]?.x || 0) + 14} y={(points[3]?.y || 0) - 8} fontSize={12} fill={colors.red} fontWeight={600}>spike</text>
              </g>
            )}
          </svg>
        </div>

        <div style={{ ...card, width: 380, padding: 24, opacity: pieOpacity }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Cost Distribution</div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16 }}>By model</div>
          <svg width={320} height={200} viewBox="0 0 320 200">
            <g transform="translate(160, 100)">
              {TOP_MODELS.map((m) => {
                const angle = (m.cost / totalCost) * 360;
                const startAngle = pieAngle;
                const endAngle = pieAngle + angle;
                pieAngle = endAngle;
                const r1 = 50, r2 = 85;
                const toRad = (deg: number) => (deg * Math.PI) / 180;
                const x1 = Math.cos(toRad(startAngle - 90)) * r2;
                const y1 = Math.sin(toRad(startAngle - 90)) * r2;
                const x2 = Math.cos(toRad(endAngle - 90)) * r2;
                const y2 = Math.sin(toRad(endAngle - 90)) * r2;
                const x3 = Math.cos(toRad(endAngle - 90)) * r1;
                const y3 = Math.sin(toRad(endAngle - 90)) * r1;
                const x4 = Math.cos(toRad(startAngle - 90)) * r1;
                const y4 = Math.sin(toRad(startAngle - 90)) * r1;
                const largeArc = angle > 180 ? 1 : 0;
                return (
                  <path key={m.model} d={`M ${x1} ${y1} A ${r2} ${r2} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 ${largeArc} 0 ${x4} ${y4} Z`} fill={m.color} stroke={colors.bg} strokeWidth={2} />
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      <div style={{ ...card, padding: "16px 24px", opacity: listOpacity }}>
        <div style={{ display: "flex", gap: 16 }}>
          {TOP_MODELS.map((m) => (
            <div key={m.model} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, backgroundColor: colors.bgMuted, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: m.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.model}</div>
                <div style={{ fontSize: 11, color: colors.textDim }}>${m.cost.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
