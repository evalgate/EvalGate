/**
 * Input normalization and hashing for deterministic matching.
 * Must match platform's @/lib/utils/input-hash.ts for reportToEvalAI.
 */
/** Normalize input for stable matching (whitespace, JSON key order). */
export declare function normalizeInput(input: string): string;
/** SHA-256 hash of normalized input. */
export declare function sha256Input(s: string): string;
