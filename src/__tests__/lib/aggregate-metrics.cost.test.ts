/**
 * Cost aggregation regression test.
 *
 * Ensures multiple cost records for the same run are summed correctly,
 * and avgCostPerTestCaseUsd = runTotalCostUsd / total (not per-record average).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeRunAggregates } from '@/lib/services/aggregate-metrics.service';

const { mockSelect } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

describe('aggregate-metrics cost aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sums multiple cost records for run total; avgCostPerTestCaseUsd = runTotalCostUsd / total', async () => {
    const callCount = { value: 0 };
    mockSelect.mockImplementation(() => {
      callCount.value++;
      const from = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(
          callCount.value === 1
            ? [{ total: 10, passed: 10, failed: 0, avgLatency: 100 }]
            : callCount.value === 2
              ? [
                  { assertionsJson: { version: 'v1', assertions: [{ key: 'pii', category: 'privacy', passed: true }] } },
                  { assertionsJson: { version: 'v1', assertions: [{ key: 'pii', category: 'privacy', passed: true }] } },
                ]
              : callCount.value === 4
                ? [{ totalCost: 0.005, count: 3 }]
                : [],
        ),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      return { from };
    });

    const metrics = await computeRunAggregates(1, 1);

    expect(metrics.total).toBe(10);
    expect(metrics.runTotalCostUsd).toBe(0.005);
    expect(metrics.avgCostPerTestCaseUsd).toBeCloseTo(0.0005, 6);
    expect(metrics.costRecordCount).toBe(3);
    expect(metrics).toHaveProperty('provenanceCoverageRate');
  });
});
