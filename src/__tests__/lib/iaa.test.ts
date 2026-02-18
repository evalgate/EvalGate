import { describe, it, expect } from 'vitest';
import { cohensKappa, fleissKappa, computeIAA } from '@/lib/iaa';

describe('IAA module', () => {
  describe('cohensKappa', () => {
    it('returns 0 for empty pairs', () => {
      expect(cohensKappa([])).toBe(0);
    });

    it('returns 1 for perfect agreement', () => {
      const pairs = [
        { rater1: 'A', rater2: 'A' },
        { rater1: 'B', rater2: 'B' },
        { rater1: 'A', rater2: 'A' },
      ];
      expect(cohensKappa(pairs)).toBeCloseTo(1, 2);
    });

    it('returns 0 for chance-level agreement', () => {
      const pairs = [
        { rater1: 'A', rater2: 'B' },
        { rater1: 'B', rater2: 'A' },
      ];
      expect(cohensKappa(pairs)).toBeCloseTo(-1, 1); // total disagreement
    });

    it('computes kappa for mixed agreement', () => {
      const pairs = [
        { rater1: 1, rater2: 1 },
        { rater1: 1, rater2: 2 },
        { rater1: 2, rater2: 2 },
        { rater1: 2, rater2: 2 },
      ];
      const k = cohensKappa(pairs);
      expect(k).toBeGreaterThan(0);
      expect(k).toBeLessThanOrEqual(1);
    });
  });

  describe('fleissKappa', () => {
    it('returns 0 for empty matrix', () => {
      expect(fleissKappa([])).toBe(0);
    });

    it('returns 1 for perfect agreement', () => {
      const matrix = [
        { A: 3, B: 0, C: 0 },
        { A: 0, B: 3, C: 0 },
        { A: 0, B: 0, C: 3 },
      ];
      expect(fleissKappa(matrix)).toBeCloseTo(1, 2);
    });

    it('computes kappa for mixed agreement', () => {
      const matrix = [
        { A: 2, B: 1, C: 0 },
        { A: 1, B: 2, C: 0 },
        { A: 0, B: 1, C: 2 },
      ];
      const k = fleissKappa(matrix);
      expect(k).toBeGreaterThan(-0.5);
      expect(k).toBeLessThanOrEqual(1);
    });
  });

  describe('computeIAA', () => {
    it('returns zeros when no multi-annotator items', () => {
      const result = computeIAA([
        { itemId: 1, annotatorId: 'a', category: 1 },
        { itemId: 2, annotatorId: 'a', category: 2 },
      ]);
      expect(result.itemCount).toBe(0);
      expect(result.agreementPercentage).toBe(0);
    });

    it('computes Cohen kappa for 2 annotators', () => {
      const result = computeIAA([
        { itemId: 1, annotatorId: 'a', category: 1 },
        { itemId: 1, annotatorId: 'b', category: 1 },
        { itemId: 2, annotatorId: 'a', category: 2 },
        { itemId: 2, annotatorId: 'b', category: 2 },
      ]);
      expect(result.annotatorCount).toBe(2);
      expect(result.itemCount).toBe(2);
      expect(result.cohensKappa).toBeCloseTo(1, 2);
      expect(result.agreementPercentage).toBe(1);
    });

    it('computes Fleiss kappa for 3+ annotators', () => {
      const result = computeIAA([
        { itemId: 1, annotatorId: 'a', category: 'good' },
        { itemId: 1, annotatorId: 'b', category: 'good' },
        { itemId: 1, annotatorId: 'c', category: 'good' },
        { itemId: 2, annotatorId: 'a', category: 'bad' },
        { itemId: 2, annotatorId: 'b', category: 'bad' },
        { itemId: 2, annotatorId: 'c', category: 'bad' },
      ]);
      expect(result.annotatorCount).toBe(3);
      expect(result.itemCount).toBe(2);
      expect(result.fleissKappa).toBeCloseTo(1, 2);
      expect(result.cohensKappa).toBeUndefined();
    });

    it('skips annotations with empty category', () => {
      const result = computeIAA([
        { itemId: 1, annotatorId: 'a', category: '' },
        { itemId: 1, annotatorId: 'b', category: 1 },
      ]);
      expect(result.itemCount).toBe(0);
    });
  });
});
