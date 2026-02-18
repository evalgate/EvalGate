/**
 * Route Auth Audit Test
 *
 * Ensures every API route either uses `secureRoute` or is in the explicit
 * public allowlist. Legacy auth patterns (requireAuthWithOrg, requireAuth,
 * getCurrentUser) are flagged as tech debt needing migration.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { globSync } from 'glob';
import path from 'path';

// Routes that are intentionally public / use their own auth mechanisms
const PUBLIC_ROUTE_ALLOWLIST = [
  'api/health',
  'api/debug/db',
  'api/debug/health',
  'api/docs',
  'api/auth',
  'api/demo',
  // api/evaluation-templates: migrated to secureRoute({ allowAnonymous: true })
  'api/subscribers',
  'api/sentry-example-api',
  'api/autumn',
  'api/billing-portal',
  'api/costs/pricing',
  'api/onboarding',
  'api/org/switch',
];

// Routes still using legacy auth that should be migrated to secureRoute
// This list must shrink over time — do NOT add to it.
const LEGACY_AUTH_ALLOWLIST = [
  'api/evaluations/route.ts',
  'api/evaluations/[id]/route.ts',
  'api/decisions/route.ts',
  'api/costs/route.ts',
  'api/organizations/route.ts',
  'api/organizations/current/route.ts',
  'api/developer/api-keys/route.ts',
];

function isAllowlisted(routePath: string): boolean {
  const normalized = routePath.replace(/\\/g, '/');
  return PUBLIC_ROUTE_ALLOWLIST.some((prefix) => normalized.includes(prefix));
}

function isLegacyAllowlisted(routePath: string): boolean {
  const normalized = routePath.replace(/\\/g, '/');
  return LEGACY_AUTH_ALLOWLIST.some((suffix) => normalized.endsWith(suffix));
}

describe('API Route Auth Audit', () => {
  const apiDir = path.resolve(__dirname, '../../app/api');
  const routeFiles = globSync('**/route.ts', { cwd: apiDir });

  it('should find at least 20 route files', () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(20);
  });

  const nonAllowlisted = routeFiles.filter((f) => !isAllowlisted(f));

  describe('secureRoute enforcement', () => {
    const strictRoutes = nonAllowlisted.filter((f) => !isLegacyAllowlisted(f));

    it.each(strictRoutes)('%s uses secureRoute (not legacy auth)', (routeFile) => {
      const fullPath = path.join(apiDir, routeFile);
      const content = readFileSync(fullPath, 'utf-8');

      expect(content).toContain('secureRoute');
    });
  });

  describe('legacy routes have SOME auth', () => {
    const legacyRoutes = nonAllowlisted.filter((f) => isLegacyAllowlisted(f));

    it.each(legacyRoutes)('%s uses some auth pattern (legacy)', (routeFile) => {
      const fullPath = path.join(apiDir, routeFile);
      const content = readFileSync(fullPath, 'utf-8');

      const usesSecureRoute = content.includes('secureRoute');
      const usesRequireAuth = content.includes('requireAuthWithOrg') || content.includes('requireAuth(') || content.includes('requireAdmin');
      const usesGetCurrentUser = content.includes('getCurrentUser');

      expect(
        usesSecureRoute || usesRequireAuth || usesGetCurrentUser,
      ).toBe(true);
    });
  });

  it('legacy allowlist should shrink over time (currently ≤ 8)', () => {
    expect(LEGACY_AUTH_ALLOWLIST.length).toBeLessThanOrEqual(8);
  });
});
