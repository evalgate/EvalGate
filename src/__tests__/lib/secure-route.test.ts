import { describe, expect, it } from "vitest";
import { hasMinRole, hasScopes, normalizeRole, ROLE_RANK } from "@/lib/api/secure-route";

describe("normalizeRole", () => {
  it("normalizes known roles", () => {
    expect(normalizeRole("Owner")).toBe("owner");
    expect(normalizeRole("ADMIN")).toBe("admin");
    expect(normalizeRole("member")).toBe("member");
    expect(normalizeRole("viewer")).toBe("viewer");
  });

  it("defaults unknown roles to viewer", () => {
    expect(normalizeRole("unknown")).toBe("viewer");
    expect(normalizeRole("")).toBe("viewer");
  });
});

describe("ROLE_RANK", () => {
  it("has correct hierarchy", () => {
    expect(ROLE_RANK.viewer).toBeLessThan(ROLE_RANK.member);
    expect(ROLE_RANK.member).toBeLessThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeLessThan(ROLE_RANK.owner);
  });
});

describe("hasMinRole", () => {
  it("returns true when role meets minimum", () => {
    expect(hasMinRole("owner", "admin")).toBe(true);
    expect(hasMinRole("admin", "admin")).toBe(true);
    expect(hasMinRole("member", "member")).toBe(true);
  });

  it("returns false when role is below minimum", () => {
    expect(hasMinRole("viewer", "member")).toBe(false);
    expect(hasMinRole("member", "admin")).toBe(false);
    expect(hasMinRole("admin", "owner")).toBe(false);
  });
});

describe("hasScopes", () => {
  it("returns true when all required scopes are granted", () => {
    expect(hasScopes(["eval:read", "eval:write", "runs:read"], ["eval:read", "eval:write"])).toBe(
      true,
    );
  });

  it("returns false when a required scope is missing", () => {
    expect(hasScopes(["eval:read"], ["eval:read", "eval:write"])).toBe(false);
  });

  it("returns true when no scopes are required", () => {
    expect(hasScopes(["eval:read"], [])).toBe(true);
  });

  it("returns true when granted is empty and no scopes required", () => {
    expect(hasScopes([], [])).toBe(true);
  });

  it("returns false when granted is empty but scopes required", () => {
    expect(hasScopes([], ["eval:read"])).toBe(false);
  });
});
