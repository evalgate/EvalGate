/**
 * Assertions envelope invariant tests.
 *
 * Ensures:
 * - Malformed assertionsJson is rejected or normalized
 * - Unknown keys are dropped but version + structure remains valid
 * - Writers produce canonical envelope or null, never half-legacy
 */

import { describe, it, expect } from 'vitest';
import {
  parseAssertionsJson,
  validateAssertionsEnvelope,
  toAssertionsEnvelope,
  normalizeAssertionsForWrite,
  computeSafetyPassRate,
  type AssertionsEnvelope,
} from '@/lib/eval/assertions';

describe('assertions envelope invariants', () => {
  describe('parseAssertionsJson', () => {
    it('returns null for malformed payloads', () => {
      expect(parseAssertionsJson(null)).toBeNull();
      expect(parseAssertionsJson(undefined)).toBeNull();
      expect(parseAssertionsJson('string')).toBeNull();
      expect(parseAssertionsJson(123)).toBeNull();
      expect(parseAssertionsJson([])).toBeNull();
    });

    it('returns null for v1 envelope with invalid assertions array', () => {
      expect(parseAssertionsJson({ version: 'v1', assertions: 'not-array' })).toBeNull();
      expect(parseAssertionsJson({ version: 'v1' })).toBeNull();
      expect(parseAssertionsJson({ version: 'v1', assertions: [{}] })).toBeNull();
    });

    it('accepts valid v1 envelope', () => {
      const valid = {
        version: 'v1',
        assertions: [
          { key: 'pii', category: 'privacy', passed: true },
          { key: 'toxicity', category: 'safety', passed: false },
        ],
      };
      const parsed = parseAssertionsJson(valid);
      expect(parsed).not.toBeNull();
      expect(parsed).toHaveProperty('version', 'v1');
      expect((parsed as AssertionsEnvelope).assertions).toHaveLength(2);
    });

    it('accepts legacy format', () => {
      const legacy = { pii: false, toxicity: true };
      const parsed = parseAssertionsJson(legacy);
      expect(parsed).not.toBeNull();
      expect(parsed).toHaveProperty('pii', false);
      expect(parsed).toHaveProperty('toxicity', true);
    });
  });

  describe('validateAssertionsEnvelope', () => {
    it('drops unknown assertion keys but keeps structure valid', () => {
      const envelope: AssertionsEnvelope = {
        version: 'v1',
        assertions: [
          { key: 'pii', category: 'privacy', passed: true },
          { key: 'unknown_key' as any, category: 'safety', passed: false },
          { key: 'toxicity', category: 'safety', passed: true },
        ],
      };
      const validated = validateAssertionsEnvelope(envelope);
      expect(validated.version).toBe('v1');
      expect(validated.assertions).toHaveLength(2);
      expect(validated.assertions.map((a) => a.key)).toEqual(['pii', 'toxicity']);
    });

    it('returns valid envelope when all keys are known', () => {
      const envelope: AssertionsEnvelope = {
        version: 'v1',
        assertions: [
          { key: 'pii', category: 'privacy', passed: true },
          { key: 'json_schema', category: 'format', passed: true },
        ],
      };
      const validated = validateAssertionsEnvelope(envelope);
      expect(validated.assertions).toHaveLength(2);
    });
  });

  describe('toAssertionsEnvelope (legacy → canonical)', () => {
    it('converts legacy to canonical envelope', () => {
      const legacy = { pii: false, toxicity: true };
      const envelope = toAssertionsEnvelope(legacy);
      expect(envelope.version).toBe('v1');
      expect(envelope.assertions).toHaveLength(2);
      const pii = envelope.assertions.find((a) => a.key === 'pii');
      const tox = envelope.assertions.find((a) => a.key === 'toxicity');
      expect(pii?.passed).toBe(true);
      expect(tox?.passed).toBe(false);
    });
  });

  describe('computeSafetyPassRate', () => {
    it('returns null for null/empty', () => {
      expect(computeSafetyPassRate(null)).toBeNull();
    });

    it('computes from v1 envelope', () => {
      const envelope: AssertionsEnvelope = {
        version: 'v1',
        assertions: [
          { key: 'toxicity', category: 'safety', passed: true },
          { key: 'pii', category: 'privacy', passed: true },
        ],
      };
      expect(computeSafetyPassRate(envelope)).toBe(1);
    });

    it('computes from legacy', () => {
      expect(computeSafetyPassRate({ pii: false, toxicity: false })).toBe(1);
      expect(computeSafetyPassRate({ pii: true })).toBe(0);
    });
  });

  describe('normalizeAssertionsForWrite', () => {
    it('returns null for malformed input', () => {
      expect(normalizeAssertionsForWrite(null)).toBeNull();
      expect(normalizeAssertionsForWrite('invalid')).toBeNull();
      expect(normalizeAssertionsForWrite({ version: 'v1', assertions: 'bad' })).toBeNull();
    });

    it('normalizes legacy to canonical envelope', () => {
      const out = normalizeAssertionsForWrite({ pii: false, toxicity: true });
      expect(out).not.toBeNull();
      expect(out!.version).toBe('v1');
      expect(out!.assertions.length).toBeGreaterThan(0);
    });

    it('validates and drops unknown keys from v1 envelope', () => {
      const out = normalizeAssertionsForWrite({
        version: 'v1',
        assertions: [
          { key: 'pii', category: 'privacy', passed: true },
          { key: 'invalid_key' as any, category: 'safety', passed: false },
        ],
      });
      expect(out).not.toBeNull();
      expect(out!.assertions.map((a) => a.key)).toEqual(['pii']);
    });
  });
});
