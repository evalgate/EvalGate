import { and, desc, eq, like } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { llmJudgeConfigs } from "@/db/schema";
import { internalError, notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { logger } from "@/lib/logger";
import { sanitizeSearchInput } from "@/lib/validation";

export const GET = secureRoute(
  async (req: NextRequest, ctx: AuthContext) => {
    try {
      const searchParams = req.nextUrl.searchParams;
      const id = searchParams.get("id");

      if (id) {
        if (Number.isNaN(parseInt(id, 10))) {
          return validationError("Valid ID is required");
        }

        const config = await db
          .select()
          .from(llmJudgeConfigs)
          .where(
            and(
              eq(llmJudgeConfigs.id, parseInt(id, 10)),
              eq(llmJudgeConfigs.organizationId, ctx.organizationId),
            ),
          )
          .limit(1);

        if (config.length === 0) {
          return notFound("LLM judge config not found");
        }

        return NextResponse.json(config[0], { status: 200 });
      }

      const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
      const offset = parseInt(searchParams.get("offset") || "0", 10);
      const model = searchParams.get("model");
      const search = searchParams.get("search");

      const conditions = [eq(llmJudgeConfigs.organizationId, ctx.organizationId)];

      if (model) {
        conditions.push(eq(llmJudgeConfigs.model, model));
      }

      if (search) {
        const safeSearch = sanitizeSearchInput(search);
        if (safeSearch) {
          conditions.push(like(llmJudgeConfigs.name, `%${safeSearch}%`));
        }
      }

      const results = await db
        .select()
        .from(llmJudgeConfigs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(llmJudgeConfigs.updatedAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json(results, { status: 200 });
    } catch (error: unknown) {
      logger.error(
        { error, route: "/api/llm-judge/configs", method: "GET" },
        "Error fetching LLM judge configs",
      );
      return internalError();
    }
  },
  { rateLimit: "free" },
);

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const body = await req.json();

    if ("userId" in body || "user_id" in body || "createdBy" in body) {
      return validationError("User ID cannot be provided in request body");
    }

    const { name, model, promptTemplate, criteria, settings } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return validationError("Name is required and must be a non-empty string");
    }

    if (!model || typeof model !== "string" || model.trim() === "") {
      return validationError("Model is required and must be a non-empty string");
    }

    if (!promptTemplate || typeof promptTemplate !== "string" || promptTemplate.trim() === "") {
      return validationError("Prompt template is required and must be a non-empty string");
    }

    const now = new Date().toISOString();
    const insertData = {
      name: name.trim(),
      organizationId: ctx.organizationId,
      model: model.trim(),
      promptTemplate: promptTemplate.trim(),
      criteria: criteria ? JSON.stringify(criteria) : null,
      settings: settings ? JSON.stringify(settings) : null,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    };

    const newConfig = await db.insert(llmJudgeConfigs).values(insertData).returning();

    return NextResponse.json(newConfig[0], { status: 201 });
  } catch (error: unknown) {
    logger.error(
      { error, route: "/api/llm-judge/configs", method: "POST" },
      "Error creating LLM judge config",
    );
    return internalError();
  }
});

export const PUT = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id || Number.isNaN(parseInt(id, 10))) {
      return validationError("Valid ID is required");
    }

    const body = await req.json();

    if ("userId" in body || "user_id" in body || "createdBy" in body) {
      return validationError("User ID cannot be provided in request body");
    }

    const existing = await db
      .select()
      .from(llmJudgeConfigs)
      .where(
        and(
          eq(llmJudgeConfigs.id, parseInt(id, 10)),
          eq(llmJudgeConfigs.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      return notFound("LLM judge config not found");
    }

    const { name, model, promptTemplate, criteria } = body;

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return validationError("Name must be a non-empty string");
      }
      updates.name = name.trim();
    }

    if (model !== undefined) {
      if (typeof model !== "string" || model.trim() === "") {
        return validationError("Model must be a non-empty string");
      }
      updates.model = model.trim();
    }

    if (promptTemplate !== undefined) {
      if (typeof promptTemplate !== "string" || promptTemplate.trim() === "") {
        return validationError("Prompt template must be a non-empty string");
      }
      updates.promptTemplate = promptTemplate.trim();
    }

    if (criteria !== undefined) {
      updates.criteria = criteria ? JSON.stringify(criteria) : null;
    }

    const updated = await db
      .update(llmJudgeConfigs)
      .set(updates)
      .where(
        and(
          eq(llmJudgeConfigs.id, parseInt(id, 10)),
          eq(llmJudgeConfigs.organizationId, ctx.organizationId),
        ),
      )
      .returning();

    if (updated.length === 0) {
      return notFound("LLM judge config not found");
    }

    return NextResponse.json(updated[0], { status: 200 });
  } catch (error: unknown) {
    logger.error(
      { error, route: "/api/llm-judge/configs", method: "PUT" },
      "Error updating LLM judge config",
    );
    return internalError();
  }
});

export const DELETE = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id || Number.isNaN(parseInt(id, 10))) {
      return validationError("Valid ID is required");
    }

    const existing = await db
      .select()
      .from(llmJudgeConfigs)
      .where(
        and(
          eq(llmJudgeConfigs.id, parseInt(id, 10)),
          eq(llmJudgeConfigs.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      return notFound("LLM judge config not found");
    }

    const deleted = await db
      .delete(llmJudgeConfigs)
      .where(
        and(
          eq(llmJudgeConfigs.id, parseInt(id, 10)),
          eq(llmJudgeConfigs.organizationId, ctx.organizationId),
        ),
      )
      .returning();

    if (deleted.length === 0) {
      return notFound("LLM judge config not found");
    }

    return NextResponse.json(
      {
        message: "LLM judge config deleted successfully",
        deleted: deleted[0],
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error(
      { error, route: "/api/llm-judge/configs", method: "DELETE" },
      "Error deleting LLM judge config",
    );
    return internalError();
  }
});
