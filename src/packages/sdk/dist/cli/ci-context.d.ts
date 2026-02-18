/**
 * CI context capture and idempotency key for --onFail import.
 */
import type { CiContext } from './api';
export declare function captureCiContext(): CiContext | undefined;
export declare function computeIdempotencyKey(evaluationId: string, ci: CiContext): string | undefined;
