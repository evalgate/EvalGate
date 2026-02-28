# ADR-001: Use Next.js App Router over Pages Router

**Status:** Accepted
**Date:** 2026-02-28
**Decision makers:** Paul Cavallo

## Context

The platform needed a routing architecture that supports server-side rendering with fine-grained control, streaming responses, nested layouts, and co-located API routes. Next.js offers two routing paradigms: the legacy Pages Router and the newer App Router (introduced in Next.js 13, stable in 14+).

The Pages Router uses a flat file-based routing model with `getServerSideProps`/`getStaticProps` for data fetching. The App Router introduces React Server Components by default, nested layouts via `layout.tsx` files, streaming with `loading.tsx`, and route handlers co-located alongside pages.

## Decision

We adopted the Next.js App Router for all routing. All pages live under `src/app/` using the App Router conventions: `page.tsx` for routes, `layout.tsx` for nested layouts, `route.ts` for API endpoints, and `loading.tsx`/`error.tsx` for streaming and error boundaries.

Server Components are used by default. The `'use client'` directive is added only when a component requires hooks, event handlers, or browser APIs. This minimizes client-side JavaScript and improves initial load performance.

## Consequences

**Easier:**
- Server Components reduce client bundle size and enable direct database/API access without client-side fetch watchers.
- Nested layouts eliminate prop drilling and redundant re-renders across shared UI shells (e.g., authenticated layout with sidebar).
- Streaming via `loading.tsx` and `Suspense` provides instant navigation feedback without full-page loading states.
- API route handlers (`route.ts`) are co-located with their feature, improving discoverability.

**More difficult:**
- The Server/Client component boundary requires careful attention — functions and non-serializable values cannot be passed as props from Server to Client Components.
- Some third-party libraries assume a client-only environment and need `'use client'` wrapper components.
- Error debugging can be harder when issues cross the server/client boundary.
