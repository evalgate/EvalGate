/**
 * Canonical assertion envelope for testResults.assertionsJson.
 *
 * Provides deterministic parsing and safety rate computation from
 * both v1 envelope and legacy { pii, toxicity, harmful } format.
 */

export type AssertionKey =
  | 'pii'
  | 'toxicity'
  | 'hallucination'
  | 'instruction_following'
  | 'json_schema'
  | 'readability';

export type AssertionCategory = 'safety' | 'privacy' | 'quality' | 'format' | 'policy';

export interface AssertionResult {
  key: AssertionKey;
  category: AssertionCategory;
  passed: boolean;
  score?: number; // 0..1
  severity?: 'low' | 'med' | 'high';
  details?: string;
}

export interface AssertionsEnvelope {
  version: 'v1';
  assertions: AssertionResult[];
}

/** Legacy format: boolean flags for pii, toxicity, harmful */
export interface LegacyAssertions {
  pii?: boolean;
  toxicity?: boolean;
  harmful?: boolean;
}

/** Convert legacy format to canonical envelope */
export function toAssertionsEnvelope(legacy: Record<string, boolean>): AssertionsEnvelope {
  const assertions: AssertionResult[] = [];
  const mapping: Array<[key: AssertionKey, category: AssertionCategory]> = [
    ['pii', 'privacy'],
    ['toxicity', 'safety'],
    ['hallucination', 'quality'],
  ];
  for (const [key, category] of mapping) {
    if (key in legacy) {
      assertions.push({
        key,
        category,
        passed: !legacy[key],
      });
    }
  }
  return { version: 'v1', assertions };
}

/** Compute safety pass rate from envelope (category === 'safety') */
export function safetyPassRateFromEnvelope(envelope: AssertionsEnvelope): number {
  const safetyAssertions = envelope.assertions.filter((a) => a.category === 'safety');
  if (safetyAssertions.length === 0) return 1;
  const passed = safetyAssertions.filter((a) => a.passed).length;
  return passed / safetyAssertions.length;
}

/** Parse assertionsJson: returns envelope, legacy, or null */
export function parseAssertionsJson(
  val: unknown,
): AssertionsEnvelope | LegacyAssertions | null {
  if (val == null) return null;
  if (typeof val !== 'object') return null;

  const obj = val as Record<string, unknown>;

  // v1 envelope
  if (obj.version === 'v1' && Array.isArray(obj.assertions)) {
    const assertions = obj.assertions as AssertionResult[];
    if (assertions.length === 0) return { version: 'v1', assertions };
    const first = assertions[0];
    if (typeof first === 'object' && first !== null && 'key' in first && 'category' in first) {
      return { version: 'v1', assertions };
    }
  }

  // Legacy format
  if ('pii' in obj || 'toxicity' in obj || 'harmful' in obj) {
    return {
      pii: obj.pii as boolean | undefined,
      toxicity: obj.toxicity as boolean | undefined,
      harmful: obj.harmful as boolean | undefined,
    };
  }

  return null;
}

/** Compute safety pass rate from parsed value (envelope or legacy) */
export function computeSafetyPassRate(parsed: AssertionsEnvelope | LegacyAssertions | null): number | null {
  if (!parsed) return null;
  if ('version' in parsed && parsed.version === 'v1') {
    return safetyPassRateFromEnvelope(parsed);
  }
  const legacy = parsed as LegacyAssertions;
  const hasAny = legacy.pii !== undefined || legacy.toxicity !== undefined || legacy.harmful !== undefined;
  if (!hasAny) return null;
  const passed = !legacy.pii && !legacy.toxicity && !legacy.harmful;
  return passed ? 1 : 0;
}
