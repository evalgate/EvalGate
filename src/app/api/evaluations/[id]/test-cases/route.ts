import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { notFound, validationError } from '@/lib/api/errors';
import { parseBody } from '@/lib/api/parse';
import { createTestCaseBodySchema } from '@/lib/validation';
import { SCOPES } from '@/lib/auth/scopes';
import { testCaseService } from '@/lib/services/test-case.service';

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const evaluationId = parseInt(params.id);

  if (isNaN(evaluationId)) {
    return validationError('Valid evaluation ID is required');
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  const cases = await testCaseService.list(ctx.organizationId, evaluationId, { limit, offset });

  if (cases === null) {
    return notFound('Evaluation not found');
  }

  return NextResponse.json(cases);
}, { requiredScopes: [SCOPES.EVAL_READ] });

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const evaluationId = parseInt(params.id);

  if (isNaN(evaluationId)) {
    return validationError('Valid evaluation ID is required');
  }

  const parsed = await parseBody(req, createTestCaseBodySchema);
  if (!parsed.ok) return parsed.response;

  const { name, input, expectedOutput, metadata } = parsed.data;

  const newTestCase = await testCaseService.create(ctx.organizationId, evaluationId, {
    name,
    input,
    expectedOutput,
    metadata,
  });

  if (newTestCase === null) {
    return notFound('Evaluation not found');
  }

  return NextResponse.json(newTestCase, { status: 201 });
}, { requiredScopes: [SCOPES.EVAL_WRITE] });

export const DELETE = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const evaluationId = parseInt(params.id);

  if (isNaN(evaluationId)) {
    return validationError('Valid evaluation ID is required');
  }

  const { searchParams } = new URL(req.url);
  const testCaseId = searchParams.get('testCaseId');

  if (!testCaseId || isNaN(parseInt(testCaseId))) {
    return validationError('Valid test case ID is required');
  }

  const removed = await testCaseService.remove(
    ctx.organizationId,
    evaluationId,
    parseInt(testCaseId),
  );

  if (!removed) {
    return notFound('Test case not found');
  }

  return NextResponse.json({ message: 'Test case deleted successfully' });
}, { requiredScopes: [SCOPES.EVAL_WRITE] });
