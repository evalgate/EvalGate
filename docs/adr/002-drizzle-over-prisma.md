# ADR-002: Use Drizzle ORM over Prisma

**Status:** Accepted
**Date:** 2026-02-28
**Decision makers:** Paul Cavallo

## Context

The platform requires a type-safe ORM for PostgreSQL with support for complex queries, migrations, and schema management. The two leading options in the TypeScript ecosystem are Prisma and Drizzle ORM.

Prisma uses a custom schema language (`.prisma` files), generates a client at build time, and includes a query engine binary (~4 MB). Drizzle defines schemas as TypeScript objects, generates SQL migrations from diffs, and compiles away at build time with zero runtime overhead.

We needed an ORM that works well in serverless environments (Vercel), supports advanced PostgreSQL features (enums, JSON columns, composite indexes), and keeps the schema co-located with application code.

## Decision

We chose Drizzle ORM with the `postgres` driver. All table definitions live in `src/db/schema.ts` as TypeScript objects. Migrations are generated via Drizzle Kit and stored in `drizzle/`. The schema serves as both the source of truth for the database structure and the TypeScript type definitions.

## Consequences

**Easier:**
- Zero runtime overhead — Drizzle compiles to plain SQL with no query engine binary, reducing cold start times in serverless.
- Schema-as-code in TypeScript means table definitions are version-controlled, diffable, and benefit from IDE autocomplete.
- Migration generation from schema diffs (`pnpm db:generate`) is deterministic and reviewable.
- Advanced PostgreSQL features (enums, `jsonb`, partial indexes) are first-class citizens.
- The query builder produces predictable SQL, making debugging and performance tuning straightforward.

**More difficult:**
- Drizzle's ecosystem is younger than Prisma's — fewer tutorials, community plugins, and Stack Overflow answers.
- No built-in GUI database browser (Prisma Studio equivalent), though Drizzle Studio has been added.
- Developers familiar with Prisma's schema language need to learn the Drizzle TypeScript DSL.
