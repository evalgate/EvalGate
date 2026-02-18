/**
 * Canonical scope strings and role-to-scope mapping.
 *
 * Scopes follow the pattern `resource:action` and are the primary
 * authorization primitive for API key auth.  Session users derive
 * their scopes from their organization role via `scopesForRole()`.
 */

export const SCOPES = {
  EVAL_READ: "eval:read",
  EVAL_WRITE: "eval:write",
  RUNS_READ: "runs:read",
  RUNS_WRITE: "runs:write",
  TRACES_READ: "traces:read",
  TRACES_WRITE: "traces:write",
  REPORTS_WRITE: "reports:write",
  ADMIN_KEYS: "admin:keys",
  ADMIN_ORG: "admin:org",
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

/** All recognised scope values (useful for validation). */
export const ALL_SCOPES: readonly string[] = Object.values(SCOPES);

// Re-export the Role type from secure-route to keep a single source of truth.
// The actual Role type + ranking live in secure-route.ts (P0.4b).
import type { Role } from "@/lib/api/secure-route";

/**
 * Derive the set of scopes a session user holds based on their org role.
 *
 * Higher roles are strict supersets of lower roles.
 */
export function scopesForRole(role: Role): string[] {
  switch (role) {
    case "owner":
      return [
        SCOPES.EVAL_READ,
        SCOPES.EVAL_WRITE,
        SCOPES.RUNS_READ,
        SCOPES.RUNS_WRITE,
        SCOPES.TRACES_READ,
        SCOPES.TRACES_WRITE,
        SCOPES.REPORTS_WRITE,
        SCOPES.ADMIN_KEYS,
        SCOPES.ADMIN_ORG,
      ];
    case "admin":
      return [
        SCOPES.EVAL_READ,
        SCOPES.EVAL_WRITE,
        SCOPES.RUNS_READ,
        SCOPES.RUNS_WRITE,
        SCOPES.TRACES_READ,
        SCOPES.TRACES_WRITE,
        SCOPES.REPORTS_WRITE,
        SCOPES.ADMIN_KEYS,
      ];
    case "member":
      return [
        SCOPES.EVAL_READ,
        SCOPES.EVAL_WRITE,
        SCOPES.RUNS_READ,
        SCOPES.RUNS_WRITE,
        SCOPES.TRACES_READ,
        SCOPES.TRACES_WRITE,
        SCOPES.REPORTS_WRITE,
      ];
    default:
      return [SCOPES.EVAL_READ, SCOPES.RUNS_READ, SCOPES.TRACES_READ];
  }
}
