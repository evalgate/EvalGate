# Contributing to EvalAI

Thanks for your interest in contributing! This guide covers the essentials.

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** (latest)
- A PostgreSQL database (e.g. Railway, Supabase, or local `docker run -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres`)
- GitHub and/or Google OAuth credentials (for auth testing)

## Local Setup

```bash
git clone https://github.com/pauly7610/ai-evaluation-platform.git
cd ai-evaluation-platform
pnpm install
cp .env.example .env.local   # fill in secrets
pnpm db:migrate
pnpm dev
```

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run checks locally before pushing (see below)
4. Open a PR against `main`

## Testing

The project uses **three test lanes** to keep concerns separated:

| Lane | Command | Environment | What it covers |
|------|---------|-------------|----------------|
| **Unit** | `pnpm test:unit` | Node (no DB) | Pure logic, services, utilities |
| **DB** | `pnpm test:db` | Node + SQLite | API routes, integration, DB queries |
| **DOM** | `pnpm test:dom` | JSDOM | React components |

Run a specific test file:
```bash
pnpm vitest run tests/unit/your-test.test.ts
```

Run coverage for a lane:
```bash
pnpm test:unit:coverage
pnpm test:db:coverage
pnpm test:dom:coverage
```

> **Important**: Do not run the full test suite unless necessary. Prefer focused test runs on the files you changed.

## Code Style

- **Biome** handles linting and formatting (no ESLint/Prettier)
- Run `pnpm lint` to check and `pnpm format` to auto-fix
- Pre-commit hooks (via Husky) run Biome on staged files automatically

## PR Process

1. Ensure all CI checks pass (`pnpm lint`, `pnpm typecheck`, tests)
2. Keep PRs focused — one concern per PR
3. Add tests for new functionality
4. Update docs if your change affects public APIs or behavior

## Commit Conventions

Use clear, descriptive commit messages. Examples:
- `fix: correct rate-limit error message typo`
- `feat: add drift detection z-score threshold`
- `docs: update API contract for run imports`
- `test: add unit tests for scoring algorithms`
- `ci: add SDK build+test job to platform CI`

## PII & Telemetry Policy

Sentry is configured with `sendDefaultPii: false`. **Do not re-enable it.**

When you need to attach user context for debugging, use the explicit pattern:

```typescript
import * as Sentry from "@sentry/nextjs";

// ✅ Approved: attach only userId (no email, IP, or name)
Sentry.setUser({ id: ctx.userId });

// ❌ Prohibited: never attach PII fields
Sentry.setUser({ email: user.email, ip_address: req.ip });
```

**Rules:**
- Only attach `id` (opaque user ID) via `Sentry.setUser()`
- Never log or send: email addresses, IP addresses, names, OAuth tokens
- Never enable `sendDefaultPii: true` in Sentry configs
- If you need richer debugging context, use the structured logger with non-PII fields (e.g., `organizationId`, `requestId`, `route`)

## Need Help?

- **[Contributor Map](docs/CONTRIBUTOR_MAP.md)** — one-page guide: what lives where, test tiers, how to run locally
- **[Architecture](docs/ARCHITECTURE.md)** — system diagram, product split, data flow
- **[All Docs](docs/INDEX.md)** — canonical index of every doc in the project
- **[Releasing](docs/RELEASING.md)** — how to cut an SDK release
- Open an issue for questions or feature requests
- See `SECURITY.md` for vulnerability reporting
