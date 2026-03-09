# Remotion Video Update — EvalGate 85s Developer Story

## Summary

Replaced the existing 70s product-tour Remotion video with a narrative-driven 85s EvalGate developer story, matching the exact sequence and timing requested.

## Files Changed

### Core Remotion Files

- **`src/remotion/data.ts`**
  - Updated `SEGMENTS` timeline to match 85s narrative:
    - `hookPain` (0–2s) → `hookCatch` (2–5s) → `quickStartTerminal` (5–13s) → `quickStartSummary` (13–25s) → `loop` (25–45s) → `trust` (45–55s) → `explain` (55–75s) → `remove` (75–85s)
  - Updated `CAPTIONS` to match new story beats
  - Changed `TOTAL_FRAMES` from `70 * FPS` to `85 * FPS`

- **`src/remotion/DemoVideo.tsx`**
  - Swapped imports from old dashboard/workflow segments to new EvalGate story components
  - Updated both `DemoStills` and `DemoVideo` compositions to render the new sequence
  - Removed legacy segments (`Intro`, `Dashboard`, `EvaluationsList`, etc.)

- **`src/remotion/Root.tsx`**
  - Updated composition `durationInFrames` for both `DemoVideo` and `DemoStills` to `30 * 85`

### New Story Segments

- **`src/remotion/segments/EvalGateStory.tsx`** (new file)
  - `HookPain`: Big-text problem hook (“You shipped a prompt change…”)
  - `HookCatch`: Solution hook (“EvalGate catches it in CI…”)
  - `QuickStartTerminal`: Animated terminal typing:
    ```bash
    npx @evalgate/sdk init
    git push
    ```
  - `QuickStartSummary`: GitHub Actions step summary frame with delta table
  - `LoopFlow`: Animated `collect → detect → generate → promote → gate → ship` flow
  - `TrustTable`: Offline/online trust table highlighting `gate` + `explain` never phone home
  - `ExplainShowcase`: `npx evalgate explain` visual moment
  - `RemoveAnytime`: Closer with `rm evalgate.config.json evals/ .github/workflows/evalgate-gate.yml`

### Static Assets

- **`public/remotion/evalai-gate-step-summary.svg`** (copied from `docs/images/`)
- **`public/remotion/evalai-explain-terminal.svg`** (copied from `docs/images/`)
  - Made available to Remotion via `staticFile()` for in-video rendering

## Render Command

```bash
pnpm remotion:render
```

- Renders `src/remotion/index.ts` → `DemoVideo` → `out/demo-video.mp4`
- Output: `out/demo-video.mp4` (~5.9 MB, 85s at 30fps)

## Narrative Flow (85s)

| Segment | Time | Content |
|---------|------|---------|
| Hook (pain) | 0–2s | “You shipped a prompt change. Quality dropped 15%. You found out from a user.” |
| Hook (solution) | 2–5s | “EvalGate catches it in CI before it ships.” |
| 2-minute setup | 5–13s | Terminal typing: `npx @evalgate/sdk init` → `git push` |
| CI proof | 13–25s | GitHub Actions step summary with delta table |
| Loop explainer | 25–45s | Animated `collect → detect → generate → promote → gate → ship` |
| Trust signal | 45–55s | Offline/online table; `gate` + `explain` never phone home |
| Explain command | 55–75s | `npx evalgate explain` shows root cause + fix commands |
| Remove anytime | 75–85s | `rm …` closer; no lock-in message |

## Key Design Choices

- **Developer-first**: Lead with pain point, not branding
- **Visual proof**: Hold on GitHub Actions step summary and `explain` terminal output
- **Trust focus**: Explicit offline/online table to remove adoption objections
- **No lock-in**: End with exact removal command and confidence message

## Result

Video now follows the requested 85s narrative arc and is ready for use in marketing/launch materials.
