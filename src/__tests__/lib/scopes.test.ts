import { describe, expect, it } from "vitest";
import { ALL_SCOPES, SCOPES, scopesForRole } from "@/lib/auth/scopes";

describe("SCOPES", () => {
  it("contains all expected scope strings", () => {
    expect(SCOPES.EVAL_READ).toBe("eval:read");
    expect(SCOPES.EVAL_WRITE).toBe("eval:write");
    expect(SCOPES.ADMIN_ORG).toBe("admin:org");
  });

  it("ALL_SCOPES includes every value", () => {
    expect(ALL_SCOPES).toContain("eval:read");
    expect(ALL_SCOPES).toContain("admin:keys");
    expect(ALL_SCOPES.length).toBe(Object.keys(SCOPES).length);
  });
});

describe("scopesForRole", () => {
  it("viewer has only read scopes", () => {
    const scopes = scopesForRole("viewer");
    expect(scopes).toContain("eval:read");
    expect(scopes).toContain("runs:read");
    expect(scopes).toContain("traces:read");
    expect(scopes).not.toContain("eval:write");
    expect(scopes).not.toContain("admin:keys");
  });

  it("member has read + write but no admin scopes", () => {
    const scopes = scopesForRole("member");
    expect(scopes).toContain("eval:write");
    expect(scopes).toContain("reports:write");
    expect(scopes).not.toContain("admin:keys");
    expect(scopes).not.toContain("admin:org");
  });

  it("admin has admin:keys but not admin:org", () => {
    const scopes = scopesForRole("admin");
    expect(scopes).toContain("admin:keys");
    expect(scopes).not.toContain("admin:org");
  });

  it("owner has all scopes including admin:org", () => {
    const scopes = scopesForRole("owner");
    for (const scope of ALL_SCOPES) {
      expect(scopes).toContain(scope);
    }
  });

  it("each higher role is a superset of the lower one", () => {
    const viewer = new Set(scopesForRole("viewer"));
    const member = new Set(scopesForRole("member"));
    const admin = new Set(scopesForRole("admin"));
    const owner = new Set(scopesForRole("owner"));

    for (const s of viewer) expect(member.has(s)).toBe(true);
    for (const s of member) expect(admin.has(s)).toBe(true);
    for (const s of admin) expect(owner.has(s)).toBe(true);
  });
});
