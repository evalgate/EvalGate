import type { CSSProperties } from "react";

export const colors = {
  bg: "#09090b",
  bgCard: "#18181b",
  bgMuted: "#27272a",
  border: "#3f3f46",
  text: "#fafafa",
  textMuted: "#a1a1aa",
  textDim: "#71717a",
  primary: "#8b5cf6",
  primaryDim: "rgba(139, 92, 246, 0.15)",
  green: "#22c55e",
  greenDim: "rgba(34, 197, 94, 0.15)",
  red: "#ef4444",
  redDim: "rgba(239, 68, 68, 0.15)",
  amber: "#f59e0b",
  amberDim: "rgba(245, 158, 11, 0.15)",
  blue: "#3b82f6",
  blueDim: "rgba(59, 130, 246, 0.15)",
  pink: "#ec4899",
  pinkDim: "rgba(236, 72, 153, 0.15)",
  cyan: "#06b6d4",
  cyanDim: "rgba(6, 182, 212, 0.15)",
  purple: "#8b5cf6",
  purpleDim: "rgba(139, 92, 246, 0.15)",
};

export const nodeTypeColors: Record<string, { accent: string; dim: string }> = {
  agent: { accent: colors.purple, dim: colors.purpleDim },
  tool: { accent: colors.green, dim: colors.greenDim },
  decision: { accent: colors.amber, dim: colors.amberDim },
  parallel: { accent: colors.blue, dim: colors.blueDim },
  human: { accent: colors.pink, dim: colors.pinkDim },
  llm: { accent: colors.cyan, dim: colors.cyanDim },
};

export const fullScreen: CSSProperties = {
  width: 1920,
  height: 1080,
  backgroundColor: colors.bg,
  display: "flex",
  flexDirection: "column",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: colors.text,
  overflow: "hidden",
};

export const contentArea: CSSProperties = {
  flex: 1,
  padding: "60px 80px 0 80px",
  display: "flex",
  flexDirection: "column",
};

export const captionBar: CSSProperties = {
  backgroundColor: "rgba(0, 0, 0, 0.85)",
  padding: "18px 80px",
  minHeight: 64,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const captionText: CSSProperties = {
  color: "#ffffff",
  fontSize: 26,
  fontWeight: 500,
  textAlign: "center",
  lineHeight: 1.4,
};

export const card: CSSProperties = {
  backgroundColor: colors.bgCard,
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  overflow: "hidden",
};

export const badge = (
  variant: "default" | "outline" | "destructive" | "amber" | "red" = "default",
): CSSProperties => {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 9999,
    padding: "2px 10px",
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.5,
  };
  switch (variant) {
    case "outline":
      return { ...base, border: `1px solid ${colors.border}`, color: colors.textMuted };
    case "destructive":
      return { ...base, backgroundColor: colors.redDim, color: colors.red };
    case "amber":
      return {
        ...base,
        backgroundColor: colors.amberDim,
        color: colors.amber,
        border: `1px solid rgba(245,158,11,0.3)`,
      };
    case "red":
      return {
        ...base,
        backgroundColor: colors.redDim,
        color: colors.red,
        border: `1px solid rgba(239,68,68,0.3)`,
      };
    default:
      return { ...base, backgroundColor: colors.primary, color: "#fff" };
  }
};
