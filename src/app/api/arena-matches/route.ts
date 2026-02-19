import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { internalError, zodValidationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { arenaMatchesService } from "@/lib/services/arena-matches.service";
import { parsePaginationParams } from "@/lib/validation";

const createArenaMatchSchema = z.object({
  prompt: z.string().min(1),
  models: z.array(z.string()).min(2).max(10),
  judgeConfigId: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = createArenaMatchSchema.parse(body);

    const result = await arenaMatchesService.createArenaMatch(
      ctx.organizationId,
      parsed,
      ctx.userId,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return zodValidationError(error);
    }
    return internalError(error instanceof Error ? error.message : undefined);
  }
});

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const { limit, offset } = parsePaginationParams(searchParams);
    const options: Record<string, unknown> = { limit, offset };
    if (searchParams.has("winnerId")) {
      options.winnerId = searchParams.get("winnerId");
    }
    if (searchParams.has("start") && searchParams.has("end")) {
      options.dateRange = {
        start: searchParams.get("start"),
        end: searchParams.get("end"),
      };
    }

    const matches = await arenaMatchesService.getArenaMatches(ctx.organizationId, options);
    return NextResponse.json(matches);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
