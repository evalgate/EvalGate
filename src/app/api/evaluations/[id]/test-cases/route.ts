import { type NextRequest, NextResponse } from "next/server";
import { notFound, validationError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parse";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { SCOPES } from "@/lib/auth/scopes";
import { testCaseService } from "@/lib/services/test-case.service";
import { createTestCaseBodySchema, parsePaginationParams } from "@/lib/validation";

export const GET = secureRoute(
  async (req: NextRequest, ctx: AuthContext, params) => {
    const evaluationId = parseInt(params.id, 10);

    if (Number.isNaN(evaluationId)) {
      return validationError("Valid evaluation ID is required");
    }

    const { searchParams } = new URL(req.url);
    const { limit, offset } = parsePaginationParams(searchParams);

    const cases = await testCaseService.list(ctx.organizationId, evaluationId, { limit, offset });

    if (cases === null) {
      return notFound("Evaluation not found");
    }

    return NextResponse.json(cases);
  },
  { requiredScopes: [SCOPES.EVAL_READ] },
);

export const POST = secureRoute(
  async (req: NextRequest, ctx: AuthContext, params) => {
    const evaluationId = parseInt(params.id, 10);

    if (Number.isNaN(evaluationId)) {
      return validationError("Valid evaluation ID is required");
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
      return notFound("Evaluation not found");
    }

    return NextResponse.json(newTestCase, { status: 201 });
  },
  { requiredScopes: [SCOPES.EVAL_WRITE] },
);

export const DELETE = secureRoute(
  async (req: NextRequest, ctx: AuthContext, params) => {
    const evaluationId = parseInt(params.id, 10);

    if (Number.isNaN(evaluationId)) {
      return validationError("Valid evaluation ID is required");
    }

    const { searchParams } = new URL(req.url);
    const testCaseId = searchParams.get("testCaseId");

    if (!testCaseId || Number.isNaN(parseInt(testCaseId, 10))) {
      return validationError("Valid test case ID is required");
    }

    const removed = await testCaseService.remove(
      ctx.organizationId,
      evaluationId,
      parseInt(testCaseId, 10),
    );

    if (!removed) {
      return notFound("Test case not found");
    }

    return NextResponse.json({ message: "Test case deleted successfully" });
  },
  { requiredScopes: [SCOPES.EVAL_WRITE] },
);
