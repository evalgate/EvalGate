# Web App Enhancements Plan

> **Created:** 2026-03-06  
> **Status:** Planning  
> **Total Estimated Effort:** ~40-50 hours

---

## Overview

Six enhancement tickets identified from the platform audit, prioritized by impact and effort.

| # | Feature | Priority | Effort | Status |
|---|---------|----------|--------|--------|
| 1 | Evaluation Reordering | Medium | 4-6h | 🔲 Pending |
| 2 | Workflow DAG Refactor | Low | 3-4h | 🔲 Pending |
| 3 | Arena Real-time Updates | Low | 8-12h | 🔲 Pending |
| 4 | Benchmark Comparison | Medium | 6-8h | 🔲 Pending |
| 5 | Cost Alerts | Medium | 6-8h | 🔲 Pending |
| 6 | Trace Full-text Search | Medium | 8-12h | 🔲 Pending |

---

## Ticket 1: Evaluation Reordering (dnd-kit/sortable)

### Goal
Enable drag-and-drop reordering of selected templates within the evaluation builder canvas.

### Current State
- `@c:\Users\PaulC\Downloads\development\ai-evaluation-platform\src\components\evaluations\builder\evaluation-canvas.tsx` — Uses basic HTML5 drag-and-drop for adding templates
- `GripVertical` icon exists but is non-functional for reordering
- `selectedTemplates` array in `builder-context.tsx` has no reorder handler

### Implementation

#### 1.1 Install Dependencies
```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

#### 1.2 Update `builder-context.tsx`
Add `handleReorderTemplates` function:
```typescript
const handleReorderTemplates = useCallback((oldIndex: number, newIndex: number) => {
  setSelectedTemplates((prev) => {
    const result = [...prev];
    const [removed] = result.splice(oldIndex, 1);
    result.splice(newIndex, 0, removed);
    return result;
  });
}, []);
```

Export in context value.

#### 1.3 Update `evaluation-canvas.tsx`
- Wrap template list with `DndContext` and `SortableContext`
- Replace static `Card` with `SortableTemplateCard` component
- Use `useSortable` hook for each template item
- Apply `CSS.Transform.toString(transform)` for smooth animations

#### 1.4 Create `sortable-template-card.tsx`
New component that wraps template card with sortable behavior:
```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableTemplateCard({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
```

#### 1.5 Add Keyboard Support
- `closestCenter` collision detection
- `KeyboardSensor` with `sortableKeyboardCoordinates`

### Files to Modify
- `src/components/evaluations/builder/builder-context.tsx`
- `src/components/evaluations/builder/evaluation-canvas.tsx`
- `src/components/evaluations/builder/sortable-template-card.tsx` (new)
- `package.json` (add dependencies)

### Tests
- `tests/components/evaluation-canvas.test.tsx` — Add reorder tests

### Acceptance Criteria
- [ ] Templates can be reordered via drag-and-drop
- [ ] Keyboard navigation works (Tab + Space/Enter to pick up, arrows to move)
- [ ] Visual feedback during drag (opacity, shadow)
- [ ] Order persists until deploy

---

## Ticket 2: Workflow DAG Component Refactor

### Goal
Split the 674-line `workflow-dag.tsx` into smaller, maintainable modules.

### Current State
- `@c:\Users\PaulC\Downloads\development\ai-evaluation-platform\src\components\workflow-dag.tsx` — 674 lines
- Contains: types, constants, layout algorithm, node rendering, edge rendering, mini view

### Implementation

#### 2.1 Extract Types
Create `src/components/workflow-dag/types.ts`:
- `WorkflowNode`, `WorkflowEdge`, `WorkflowDefinition`
- `WorkflowDAGProps`, `WorkflowDAGMiniProps`

#### 2.2 Extract Constants
Create `src/components/workflow-dag/constants.ts`:
- `NODE_WIDTH`, `NODE_HEIGHT`, `NODE_SPACING_X`, `NODE_SPACING_Y`, `PADDING`
- `NODE_COLORS`, `NODE_ICONS`

#### 2.3 Extract Layout Algorithm
Create `src/components/workflow-dag/layout.ts`:
- `computeNodePositions(definition: WorkflowDefinition)`
- `computeEdgePaths(nodes, edges)`

#### 2.4 Extract Sub-components
Create `src/components/workflow-dag/components/`:
- `dag-node.tsx` — Single node rendering
- `dag-edge.tsx` — Single edge rendering
- `dag-canvas.tsx` — SVG container with zoom/pan

#### 2.5 Main Component
Refactor `src/components/workflow-dag/index.tsx`:
- Import from sub-modules
- ~100 lines max

### New File Structure
```
src/components/workflow-dag/
├── index.tsx           # Main export (~100 lines)
├── types.ts            # Type definitions
├── constants.ts        # Colors, sizes
├── layout.ts           # Position computation
├── components/
│   ├── dag-node.tsx    # Node component
│   ├── dag-edge.tsx    # Edge component
│   └── dag-canvas.tsx  # SVG wrapper
└── mini.tsx            # WorkflowDAGMini
```

### Tests
- Existing tests should continue to pass
- Add unit tests for `layout.ts` pure functions

### Acceptance Criteria
- [ ] No functional changes to DAG rendering
- [ ] Each file < 150 lines
- [ ] Types exported from `workflow-dag/types`
- [ ] All existing imports continue to work

---

## Ticket 3: Arena Real-time Updates (WebSocket)

### Goal
Add live updates to battle arena so users see results as they stream in.

### Current State
- `@c:\Users\PaulC\Downloads\development\ai-evaluation-platform\src\components\arena\battle-arena.tsx` — Uses `fetch` with loading state
- No streaming or WebSocket support
- Results appear all at once after completion

### Implementation

#### 3.1 Backend: WebSocket Route
Create `src/app/api/arena/ws/route.ts`:
- Use Next.js 14 WebSocket support or Server-Sent Events (SSE)
- Stream model responses as they complete
- Send progress events: `{ type: 'progress', modelId, status }`
- Send result events: `{ type: 'result', modelId, output, latencyMs }`
- Send completion: `{ type: 'complete', winner, scores }`

#### 3.2 Alternative: Server-Sent Events (simpler)
Create `src/app/api/arena/stream/route.ts`:
```typescript
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Stream results as they complete
      for (const model of models) {
        const result = await runModel(model, prompt);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
      }
      controller.close();
    }
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

#### 3.3 Frontend: EventSource Hook
Create `src/hooks/use-arena-stream.ts`:
```typescript
export function useArenaStream(battleId: string | null) {
  const [results, setResults] = useState<ModelResponse[]>([]);
  const [status, setStatus] = useState<'idle' | 'streaming' | 'complete'>('idle');
  
  useEffect(() => {
    if (!battleId) return;
    const es = new EventSource(`/api/arena/stream?id=${battleId}`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'result') {
        setResults(prev => [...prev, data]);
      } else if (data.type === 'complete') {
        setStatus('complete');
        es.close();
      }
    };
    return () => es.close();
  }, [battleId]);
  
  return { results, status };
}
```

#### 3.4 Update `battle-arena.tsx`
- Use `useArenaStream` hook
- Show partial results as they arrive
- Animate new results appearing
- Show "Waiting for X..." placeholder for pending models

### Files to Create/Modify
- `src/app/api/arena/stream/route.ts` (new)
- `src/hooks/use-arena-stream.ts` (new)
- `src/components/arena/battle-arena.tsx` (modify)

### Tests
- `tests/api/arena/stream.test.ts` — SSE endpoint tests
- `tests/components/battle-arena.test.tsx` — Streaming UI tests

### Acceptance Criteria
- [ ] Results appear as each model completes
- [ ] Visual indicator for pending models
- [ ] Graceful handling of connection errors
- [ ] Final winner announced after all complete

---

## Ticket 4: Benchmark Model Comparison View

### Goal
Add side-by-side comparison of two models' benchmark performance.

### Current State
- `@c:\Users\PaulC\Downloads\development\ai-evaluation-platform\src\app\(authenticated)\benchmarks\page.tsx` — Shows leaderboard
- Radar chart exists but shows single model
- No comparison mode

### Implementation

#### 4.1 Add Comparison State
```typescript
const [comparisonModels, setComparisonModels] = useState<[string, string] | null>(null);
```

#### 4.2 Add "Compare" Button to Leaderboard
- Checkbox or radio selection for 2 models
- "Compare Selected" button appears when 2 selected

#### 4.3 Create Comparison Dialog/View
Create `src/components/benchmarks/model-comparison.tsx`:
- Side-by-side stats table
- Overlaid radar chart (both models on same chart)
- Difference indicators (↑ better, ↓ worse)
- Per-task breakdown

#### 4.4 API Endpoint
Create `src/app/api/benchmarks/compare/route.ts`:
- Accept `modelA` and `modelB` query params
- Return comparison data with deltas

### UI Design
```
┌─────────────────────────────────────────────────────────┐
│  Model Comparison: GPT-4o vs Claude 3.5 Sonnet          │
├─────────────────────────────────────────────────────────┤
│  Metric          │  GPT-4o   │  Claude 3.5  │  Delta    │
│  ─────────────────────────────────────────────────────  │
│  Accuracy        │  94.2%    │  91.8%       │  +2.4% ↑  │
│  Latency (p50)   │  1.2s     │  0.9s        │  -0.3s ↓  │
│  Success Rate    │  98.5%    │  99.1%       │  -0.6% ↓  │
│  Cost/1K         │  $0.03    │  $0.015      │  -50% ↓   │
├─────────────────────────────────────────────────────────┤
│  [Radar Chart with both models overlaid]                │
└─────────────────────────────────────────────────────────┘
```

### Files to Create/Modify
- `src/components/benchmarks/model-comparison.tsx` (new)
- `src/app/api/benchmarks/compare/route.ts` (new)
- `src/app/(authenticated)/benchmarks/page.tsx` (modify)

### Tests
- `tests/api/benchmarks/compare.test.ts`
- `tests/components/model-comparison.test.tsx`

### Acceptance Criteria
- [ ] Can select 2 models from leaderboard
- [ ] Comparison view shows all metrics side-by-side
- [ ] Radar chart overlays both models
- [ ] Clear visual indicators for which model is better per metric

---

## Ticket 5: Cost Alerts & Budget Thresholds

### Goal
Notify users when spending approaches or exceeds budget thresholds.

### Current State
- `@c:\Users\PaulC\Downloads\development\ai-evaluation-platform\src\app\(authenticated)\costs\page.tsx` — Shows cost data
- No alerting or threshold configuration
- No notification system for costs

### Implementation

#### 5.1 Database Schema
Add to `src/db/schema.ts`:
```typescript
export const costAlerts = pgTable("cost_alerts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  thresholdAmount: text("threshold_amount").notNull(), // decimal as string
  period: text("period").notNull(), // 'daily' | 'weekly' | 'monthly'
  notifyEmail: boolean("notify_email").default(true),
  notifyInApp: boolean("notify_in_app").default(true),
  isActive: boolean("is_active").default(true),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const costAlertHistory = pgTable("cost_alert_history", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id").references(() => costAlerts.id).notNull(),
  triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
  actualAmount: text("actual_amount").notNull(),
  thresholdAmount: text("threshold_amount").notNull(),
});
```

#### 5.2 API Endpoints
- `GET /api/costs/alerts` — List alerts for org
- `POST /api/costs/alerts` — Create alert
- `PATCH /api/costs/alerts/[id]` — Update alert
- `DELETE /api/costs/alerts/[id]` — Delete alert

#### 5.3 Alert Checker Job
Create `src/lib/jobs/handlers/cost-alert-checker.ts`:
- Runs on cron (hourly)
- Queries current spend per org
- Compares against active thresholds
- Triggers notifications if exceeded
- Records in `costAlertHistory`

#### 5.4 UI: Alert Configuration
Add to costs page:
- "Set Budget Alert" button
- Dialog with threshold amount, period, notification preferences
- List of active alerts with edit/delete

#### 5.5 In-App Notifications
- Toast notification when threshold exceeded
- Badge on costs nav item
- Alert banner on dashboard

### Files to Create/Modify
- `src/db/schema.ts` (add tables)
- `drizzle/XXXX_cost_alerts.sql` (migration)
- `src/app/api/costs/alerts/route.ts` (new)
- `src/app/api/costs/alerts/[id]/route.ts` (new)
- `src/lib/jobs/handlers/cost-alert-checker.ts` (new)
- `src/lib/jobs/types.ts` (add job type)
- `src/app/(authenticated)/costs/page.tsx` (modify)
- `src/components/costs/alert-config-dialog.tsx` (new)

### Tests
- `tests/api/costs/alerts.test.ts`
- `tests/unit/jobs/cost-alert-checker.test.ts`

### Acceptance Criteria
- [ ] Can create/edit/delete budget alerts
- [ ] Alerts trigger when threshold exceeded
- [ ] In-app notification appears
- [ ] Alert history is recorded
- [ ] Alerts don't re-trigger within cooldown period

---

## Ticket 6: Trace Full-text Search

### Goal
Enable searching across span input/output content, not just trace names.

### Current State
- `@c:\Users\PaulC\Downloads\development\ai-evaluation-platform\src\app\(authenticated)\traces\page.tsx` — Searches by trace name only
- `spans.input` and `spans.output` are text columns
- No full-text index

### Implementation

#### 6.1 Database: Add Full-text Index
PostgreSQL migration:
```sql
-- Add tsvector column for full-text search
ALTER TABLE spans ADD COLUMN search_vector tsvector;

-- Populate search vector
UPDATE spans SET search_vector = 
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(input, '') || ' ' || coalesce(output, ''));

-- Create GIN index
CREATE INDEX idx_spans_search ON spans USING GIN(search_vector);

-- Add trigger to keep it updated
CREATE FUNCTION spans_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    coalesce(NEW.name, '') || ' ' || coalesce(NEW.input, '') || ' ' || coalesce(NEW.output, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER spans_search_update BEFORE INSERT OR UPDATE ON spans
FOR EACH ROW EXECUTE FUNCTION spans_search_trigger();
```

#### 6.2 API: Search Endpoint
Create `src/app/api/traces/search/route.ts`:
```typescript
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  const results = await db.execute(sql`
    SELECT t.*, s.name as span_name, s.input, s.output,
           ts_rank(s.search_vector, plainto_tsquery('english', ${query})) as rank
    FROM traces t
    JOIN spans s ON s.trace_id = t.id
    WHERE s.search_vector @@ plainto_tsquery('english', ${query})
      AND t.organization_id = ${ctx.organizationId}
    ORDER BY rank DESC
    LIMIT 50
  `);
  return NextResponse.json(results);
}
```

#### 6.3 UI: Enhanced Search
Update traces page:
- Add "Search in content" toggle
- Show matching spans highlighted
- Snippet preview with match context

#### 6.4 Search Results Component
Create `src/components/traces/search-results.tsx`:
- Shows trace with matching spans
- Highlights search terms in snippets
- Links to full trace detail

### Files to Create/Modify
- `drizzle/XXXX_spans_fulltext_search.sql` (migration)
- `src/db/schema.ts` (add search_vector column type)
- `src/app/api/traces/search/route.ts` (new)
- `src/app/(authenticated)/traces/page.tsx` (modify)
- `src/components/traces/search-results.tsx` (new)

### Tests
- `tests/api/traces/search.test.ts`
- `tests/components/search-results.test.tsx`

### Acceptance Criteria
- [ ] Can search across span input/output content
- [ ] Results ranked by relevance
- [ ] Matching text highlighted in results
- [ ] Search is performant (< 500ms for typical queries)
- [ ] Works with partial matches

---

## Implementation Order (Recommended)

1. **Ticket 1: Evaluation Reordering** (4-6h) — Quick UX win, low risk
2. **Ticket 2: Workflow DAG Refactor** (3-4h) — Technical debt, enables future work
3. **Ticket 5: Cost Alerts** (6-8h) — High user value, moderate complexity
4. **Ticket 4: Benchmark Comparison** (6-8h) — Feature addition, self-contained
5. **Ticket 6: Trace Search** (8-12h) — Requires migration, higher complexity
6. **Ticket 3: Arena Real-time** (8-12h) — Nice-to-have, most complex

---

## Dependencies

| Ticket | Depends On | Blocks |
|--------|------------|--------|
| 1 | None | None |
| 2 | None | None |
| 3 | None | None |
| 4 | None | None |
| 5 | Job system (exists) | None |
| 6 | PostgreSQL full-text (exists) | None |

---

## Risk Assessment

| Ticket | Risk | Mitigation |
|--------|------|------------|
| 1 | Low | Well-documented library, isolated change |
| 2 | Low | Pure refactor, no functional changes |
| 3 | Medium | SSE simpler than WebSocket, fallback to polling |
| 4 | Low | Additive feature, no breaking changes |
| 5 | Medium | Test job thoroughly, add cooldown logic |
| 6 | Medium | Test migration on staging first, monitor query perf |
