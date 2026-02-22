import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiError, quotaExceeded, zodValidationError } from "./errors";

vi.mock("@/lib/api/request-id", () => ({
  getRequestId: () => "11111111-1111-1111-1111-111111111111",
}));

describe("api errors", () => {
  it("apiError returns envelope with request id header and status", async () => {
    const res = apiError("NOT_FOUND", "missing", undefined);
    const payload = await (res as any).json();

    expect((res as any).status).toBe(404);
    expect(res.headers.get("x-request-id")).toBe("11111111-1111-1111-1111-111111111111");
    expect(payload.error.code).toBe("NOT_FOUND");
    expect(payload.error.message).toBe("missing");
    expect(payload.error.requestId).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("uses explicit status override when provided", () => {
    const res = apiError("VALIDATION_ERROR", "nope", 409);
    expect((res as any).status).toBe(409);
  });

  it("map QUOTA_EXCEEDED to 403 and exposes details", async () => {
    const res = quotaExceeded("blocked", { featureId: "projects" });
    const payload = await (res as any).json();

    expect((res as any).status).toBe(403);
    expect(payload.error.code).toBe("QUOTA_EXCEEDED");
    expect(payload.error.message).toBe("blocked");
    expect(payload.error.details).toEqual({ featureId: "projects" });
  });

  it("zodValidationError includes issues", async () => {
    const error = new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["body"],
        message: "bad",
      },
    ]);
    const res = zodValidationError(error);
    const payload = await (res as any).json();

    expect((res as any).status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(payload.error.details).toBeDefined();
    expect(payload.error.details[0].message).toBe("bad");
  });
});
