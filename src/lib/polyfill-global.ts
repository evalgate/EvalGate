/**
 * Edge runtime polyfill: Node's `global` doesn't exist in Vercel Edge.
 * Must be imported first (before any other imports) in Edge entry points.
 */
if (typeof (globalThis as typeof globalThis & { global?: typeof globalThis }).global === "undefined") {
  (globalThis as typeof globalThis & { global: typeof globalThis }).global = globalThis;
}
