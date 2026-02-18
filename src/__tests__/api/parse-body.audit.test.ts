/**
 * parseBody Audit Test
 *
 * Verifies that migrated routes (Slice 1: evaluations, Slice 2: traces, webhooks, api-keys)
 * use parseBody() instead of raw req.json(). Documents remaining routes for future migration.
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import { globSync } from 'glob';
import { readFileSync } from 'fs';

const API_DIR = path.resolve(__dirname, '../../app/api');

/** Routes that must use parseBody (migrated in T0.2) */
const MUST_USE_PARSE_BODY = [
  'evaluations/route',
  'evaluations/[id]/route',
  'evaluations/[id]/runs/route',
  'evaluations/[id]/publish-run/route',
  'evaluations/[id]/test-cases/route',
  'traces/route',
  'traces/[id]/route',
  'traces/[id]/spans/route',
  'developer/webhooks/route',
  'developer/webhooks/[id]/route',
  'developer/api-keys/route',
  'developer/api-keys/[id]/route',
  'quality/route',
];

function usesParseBody(content: string): boolean {
  return /parseBody\s*\(/.test(content);
}

function usesReqJson(content: string): boolean {
  return /req\.json\s*\(/.test(content);
}

function hasPostPutPatch(content: string): boolean {
  return (
    /\bexport\s+const\s+POST\s*=/.test(content) ||
    /\bexport\s+const\s+PUT\s*=/.test(content) ||
    /\bexport\s+const\s+PATCH\s*=/.test(content)
  );
}

describe('parseBody Audit', () => {
  const routeFiles = globSync('**/route.ts', { cwd: API_DIR });

  it('should find route files', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it('migrated routes must use parseBody for JSON body parsing', () => {
    const violations: { file: string }[] = [];

    for (const routeFile of routeFiles) {
      const normalized = routeFile.replace(/\\/g, '/');
      if (!MUST_USE_PARSE_BODY.some((p) => normalized.startsWith(p) || normalized.includes(p + '/'))) continue;

      const fullPath = path.join(API_DIR, routeFile);
      const content = readFileSync(fullPath, 'utf-8');

      if (hasPostPutPatch(content) && usesReqJson(content) && !usesParseBody(content)) {
        violations.push({ file: routeFile });
      }
    }

    expect(
      violations,
      violations.length > 0
        ? `Migrated routes still using req.json(): ${violations.map((v) => v.file).join(', ')}`
        : undefined
    ).toHaveLength(0);
  });
});
