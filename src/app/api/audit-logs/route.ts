import { type NextRequest, NextResponse } from "next/server";
import { forbidden } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { SCOPES } from "@/lib/auth/scopes";
import { auditService } from "@/lib/services/audit.service";
import { parsePaginationParams } from "@/lib/validation";

export const GET = secureRoute(
  async (req: NextRequest, ctx: AuthContext) => {
    // Only admins / owners can view audit logs
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return forbidden("Admin access required to view audit logs");
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || undefined;
    const resourceType = searchParams.get("resourceType") || undefined;
    const since = searchParams.get("since") || undefined;
    const until = searchParams.get("until") || undefined;
    const { limit, offset } = parsePaginationParams(searchParams);

    const logs = await auditService.list(ctx.organizationId, {
      action,
      resourceType,
      since,
      until,
      limit,
      offset,
    });

    return NextResponse.json({ data: logs, count: logs.length });
  },
  { minRole: "admin", requiredScopes: [SCOPES.ADMIN_ORG] },
);
