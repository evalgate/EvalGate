/**
 * Scoring Spec API
 *
 * GET /api/quality/spec — returns the current scoring spec for audit/verification.
 * Public (allowAnonymous) — spec is deterministic, no sensitive data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { secureRoute } from '@/lib/api/secure-route';
import { SCORING_SPEC_V1, SCORING_SPEC_VERSION } from '@/lib/scoring/scoring-spec';
import { sha256Hex } from '@/lib/crypto/hash';
import { canonicalizeJson } from '@/lib/crypto/canonical-json';

export const GET = secureRoute(async () => {
  const scoringSpecHash = sha256Hex(canonicalizeJson(SCORING_SPEC_V1));

  return NextResponse.json({
    version: SCORING_SPEC_VERSION,
    spec: SCORING_SPEC_V1,
    specHash: scoringSpecHash,
    description: 'Quality score formula. Scores are computed with this exact spec; specHash enables verification.',
  }, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}, { allowAnonymous: true });
