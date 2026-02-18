import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COST_SUMMARY } from "../data";
import { card, colors } from "../styles";

const cards = [
  {
    label: "30-Day Spend",
    value: COST_SUMMARY.spend30d,
    sub: `${COST_SUMMARY.requests30d} requests`,
    icon: "💲",
  },
  {
    label: "7-Day Spend",
    value: COST_SUMMARY.spend7d,
    badge: COST_SUMMARY.spend7dChange,
    icon: "📅",
  },
  { label: "Total Tokens", value: COST_SUMMARY.tokens30d, sub: "Last 30 days", icon: "🪙" },
  { label: "Avg Cost/Request", value: COST_SUMMARY.avgCost, sub: "Per API call", icon: "📊" },
];

export const CostsSummary: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30, height: "100%" }}>
      <div>
        <div style={{ fontSize: 42, fontWeight: 700 }}>Cost Analytics</div>
        <div style={{ fontSize: 20, color: colors.textMuted, marginTop: 4 }}>
          Track and optimize your LLM spending
        </div>
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        {cards.map((c, i) => {
          const delay = i * 8;
          const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });
          const translateY = interpolate(frame, [delay, delay + 15], [20, 0], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });
          return (
            <div
              key={c.label}
              style={{
                ...card,
                flex: 1,
                padding: 28,
                opacity,
                transform: `translateY(${translateY}px)`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 16,
                  color: colors.textMuted,
                  marginBottom: 14,
                }}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 36, fontWeight: 700 }}>{c.value}</span>
                {c.badge && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: colors.redDim,
                      color: colors.red,
                      borderRadius: 9999,
                      padding: "3px 12px",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    ↑ {c.badge}
                  </span>
                )}
              </div>
              {c.sub && (
                <div style={{ fontSize: 14, color: colors.textDim, marginTop: 6 }}>{c.sub}</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {["Overview", "By Model", "Pricing"].map((tab, i) => (
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
