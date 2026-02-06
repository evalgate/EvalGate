import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { colors, fullScreen, contentArea, captionBar, captionText } from "./styles";
import { SEGMENTS, CAPTIONS, FPS } from "./data";

import { Intro } from "./segments/Intro";
import { WorkflowsList } from "./segments/WorkflowsList";
import { WorkflowStats } from "./segments/WorkflowStats";
import { WorkflowDAG } from "./segments/WorkflowDAG";
import { WorkflowRuns } from "./segments/WorkflowRuns";
import { CostsSummary } from "./segments/CostsSummary";
import { CostsCharts } from "./segments/CostsCharts";
import { Benchmarks } from "./segments/Benchmarks";
import { SDK } from "./segments/SDK";
import { Closing } from "./segments/Closing";

const CaptionOverlay: React.FC = () => {
  const frame = useCurrentFrame();

  const activeCaption = CAPTIONS.find(
    (c) => frame >= c.startFrame && frame < c.endFrame
  );

  if (!activeCaption) {
    return (
      <div style={captionBar}>
        <div style={{ ...captionText, color: "rgba(255,255,255,0.2)" }}>...</div>
      </div>
    );
  }

  const fadeIn = interpolate(
    frame,
    [activeCaption.startFrame, activeCaption.startFrame + 8],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const fadeOut = interpolate(
    frame,
    [activeCaption.endFrame - 8, activeCaption.endFrame],
    [1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <div style={captionBar}>
      <div style={{ ...captionText, opacity }}>{activeCaption.text}</div>
    </div>
  );
};

const ProgressIndicator: React.FC = () => {
  const frame = useCurrentFrame();
  const segmentEntries = Object.entries(SEGMENTS);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {segmentEntries.map(([key, seg]) => {
        const isActive = frame >= seg.start && frame < seg.start + seg.duration;
        const isDone = frame >= seg.start + seg.duration;

        return (
          <div
            key={key}
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: isActive
                ? colors.primary
                : isDone
                ? "rgba(139, 92, 246, 0.4)"
                : colors.bgMuted,
              width: isActive ? 32 : 16,
            }}
          />
        );
      })}
    </div>
  );
};

export const DemoVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <div style={fullScreen}>
        <div
          style={{
            padding: "20px 80px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <ProgressIndicator />
        </div>

        <div style={contentArea}>
          <Sequence from={SEGMENTS.intro.start} durationInFrames={SEGMENTS.intro.duration}>
            <Intro />
          </Sequence>

          <Sequence from={SEGMENTS.workflowsList.start} durationInFrames={SEGMENTS.workflowsList.duration}>
            <WorkflowsList />
          </Sequence>

          <Sequence from={SEGMENTS.workflowStats.start} durationInFrames={SEGMENTS.workflowStats.duration}>
            <WorkflowStats />
          </Sequence>

          <Sequence from={SEGMENTS.workflowDag.start} durationInFrames={SEGMENTS.workflowDag.duration}>
            <WorkflowDAG />
          </Sequence>

          <Sequence from={SEGMENTS.workflowRuns.start} durationInFrames={SEGMENTS.workflowRuns.duration}>
            <WorkflowRuns />
          </Sequence>

          <Sequence from={SEGMENTS.costsSummary.start} durationInFrames={SEGMENTS.costsSummary.duration}>
            <CostsSummary />
          </Sequence>

          <Sequence from={SEGMENTS.costsCharts.start} durationInFrames={SEGMENTS.costsCharts.duration}>
            <CostsCharts />
          </Sequence>

          <Sequence from={SEGMENTS.benchmarks.start} durationInFrames={SEGMENTS.benchmarks.duration}>
            <Benchmarks />
          </Sequence>

          <Sequence from={SEGMENTS.sdk.start} durationInFrames={SEGMENTS.sdk.duration}>
            <SDK />
          </Sequence>

          <Sequence from={SEGMENTS.closing.start} durationInFrames={SEGMENTS.closing.duration}>
            <Closing />
          </Sequence>
        </div>

        <CaptionOverlay />
      </div>
    </AbsoluteFill>
  );
};
