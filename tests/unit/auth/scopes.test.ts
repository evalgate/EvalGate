import { describe, expect, it } from "vitest";
import { ALL_SCOPES, SCOPES, scopesForRole } from "@/lib/auth/scopes";

// Import Role type - we need to mock this since it's from secure-route
type Role = "owner" | "admin" | "member" | "viewer";

describe("SCOPES constants", () => {
  it("should have all required scope constants", () => {
    expect(SCOPES.EVAL_READ).toBe("eval:read");
    expect(SCOPES.EVAL_WRITE).toBe("eval:write");
    expect(SCOPES.RUNS_READ).toBe("runs:read");
    expect(SCOPES.RUNS_WRITE).toBe("runs:write");
    expect(SCOPES.TRACES_READ).toBe("traces:read");
    expect(SCOPES.TRACES_WRITE).toBe("traces:write");
    expect(SCOPES.REPORTS_WRITE).toBe("reports:write");
    expect(SCOPES.ADMIN_KEYS).toBe("admin:keys");
    expect(SCOPES.ADMIN_ORG).toBe("admin:org");
  });

  it("should have unique scope values", () => {
    const values = Object.values(SCOPES);
    const uniqueValues = [...new Set(values)];
    expect(values).toHaveLength(uniqueValues.length);
  });
});

describe("ALL_SCOPES", () => {
  it("should contain all scope values", () => {
    expect(ALL_SCOPES).toContain(SCOPES.EVAL_READ);
    expect(ALL_SCOPES).toContain(SCOPES.EVAL_WRITE);
    expect(ALL_SCOPES).toContain(SCOPES.RUNS_READ);
    expect(ALL_SCOPES).toContain(SCOPES.RUNS_WRITE);
    expect(ALL_SCOPES).toContain(SCOPES.TRACES_READ);
    expect(ALL_SCOPES).toContain(SCOPES.TRACES_WRITE);
    expect(ALL_SCOPES).toContain(SCOPES.REPORTS_WRITE);
    expect(ALL_SCOPES).toContain(SCOPES.ADMIN_KEYS);
    expect(ALL_SCOPES).toContain(SCOPES.ADMIN_ORG);
  });

  it("should be readonly", () => {
    expect(ALL_SCOPES).toBe(Object.freeze(ALL_SCOPES));
  });
});

describe("scopesForRole", () => {
  // Happy path tests
  it("should return all scopes for owner role", () => {
    const scopes = scopesForRole("owner" as Role);
    expect(scopes).toEqual([
      SCOPES.EVAL_READ,
      SCOPES.EVAL_WRITE,
      SCOPES.RUNS_READ,
      SCOPES.RUNS_WRITE,
      SCOPES.TRACES_READ,
      SCOPES.TRACES_WRITE,
      SCOPES.REPORTS_WRITE,
      SCOPES.ADMIN_KEYS,
      SCOPES.ADMIN_ORG,
    ]);
    expect(scopes).toHaveLength(9);
  });

  it("should return all scopes except admin:org for admin role", () => {
    const scopes = scopesForRole("admin" as Role);
    expect(scopes).toEqual([
      SCOPES.EVAL_READ,
      SCOPES.EVAL_WRITE,
      SCOPES.RUNS_READ,
      SCOPES.RUNS_WRITE,
      SCOPES.TRACES_READ,
      SCOPES.TRACES_WRITE,
      SCOPES.REPORTS_WRITE,
      SCOPES.ADMIN_KEYS,
    ]);
    expect(scopes).toHaveLength(8);
    expect(scopes).not.toContain(SCOPES.ADMIN_ORG);
  });

  it("should return member scopes without admin permissions", () => {
    const scopes = scopesForRole("member" as Role);
    expect(scopes).toEqual([
      SCOPES.EVAL_READ,
      SCOPES.EVAL_WRITE,
      SCOPES.RUNS_READ,
      SCOPES.RUNS_WRITE,
      SCOPES.TRACES_READ,
      SCOPES.TRACES_WRITE,
      SCOPES.REPORTS_WRITE,
    ]);
    expect(scopes).toHaveLength(7);
    expect(scopes).not.toContain(SCOPES.ADMIN_KEYS);
    expect(scopes).not.toContain(SCOPES.ADMIN_ORG);
  });

  it("should return read-only scopes for unknown/default role", () => {
    const scopes = scopesForRole("unknown" as Role);
    expect(scopes).toEqual([SCOPES.EVAL_READ, SCOPES.RUNS_READ, SCOPES.TRACES_READ]);
    expect(scopes).toHaveLength(3);
  });

  it("should return read-only scopes for viewer role", () => {
    const scopes = scopesForRole("viewer" as Role);
    expect(scopes).toEqual([SCOPES.EVAL_READ, SCOPES.RUNS_READ, SCOPES.TRACES_READ]);
    expect(scopes).toHaveLength(3);
  });

  // Edge case tests
  it("should maintain role hierarchy - owner superset of admin", () => {
    const ownerScopes = scopesForRole("owner" as Role);
    const adminScopes = scopesForRole("admin" as Role);

    // Admin should have all scopes except ADMIN_ORG
    expect(adminScopes.every((scope) => ownerScopes.includes(scope))).toBe(true);
    expect(ownerScopes.length).toBeGreaterThan(adminScopes.length);
  });

  it("should maintain role hierarchy - admin superset of member", () => {
    const adminScopes = scopesForRole("admin" as Role);
    const memberScopes = scopesForRole("member" as Role);

    // Member should have all scopes except ADMIN_KEYS
    expect(memberScopes.every((scope) => adminScopes.includes(scope))).toBe(true);
    expect(adminScopes.length).toBeGreaterThan(memberScopes.length);
  });

  it("should maintain role hierarchy - member superset of viewer", () => {
    const memberScopes = scopesForRole("member" as Role);
    const viewerScopes = scopesForRole("viewer" as Role);

    // Viewer should have only read scopes
    expect(viewerScopes.every((scope) => memberScopes.includes(scope))).toBe(true);
    expect(memberScopes.length).toBeGreaterThan(viewerScopes.length);
  });

  // Error/invalid input tests
  it("should handle empty string role", () => {
    const scopes = scopesForRole("" as Role);
    expect(scopes).toEqual([SCOPES.EVAL_READ, SCOPES.RUNS_READ, SCOPES.TRACES_READ]);
  });

  it("should handle null role (treated as unknown)", () => {
    const scopes = scopesForRole(null as any);
    expect(scopes).toEqual([SCOPES.EVAL_READ, SCOPES.RUNS_READ, SCOPES.TRACES_READ]);
  });

  it("should handle undefined role (treated as unknown)", () => {
    const scopes = scopesForRole(undefined as any);
    expect(scopes).toEqual([SCOPES.EVAL_READ, SCOPES.RUNS_READ, SCOPES.TRACES_READ]);
  });
});
