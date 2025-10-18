/**
 * OpenAI Integration
 * Tier 1.2: Framework Auto-Instrumentation - OpenAI wrapper
 *
 * @example
 * ```typescript
 * import { traceOpenAI } from '@ai-eval-platform/sdk/integrations/openai';
 * import OpenAI from 'openai';
 *
 * const openai = new OpenAI({ apiKey: '...' });
 * const tracedOpenAI = traceOpenAI(openai, client);
 *
 * // All calls are automatically traced
 * const response = await tracedOpenAI.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 */
import type { AIEvalClient } from '../client';
export interface OpenAITraceOptions {
    /** Whether to capture input (default: true) */
    captureInput?: boolean;
    /** Whether to capture output (default: true) */
    captureOutput?: boolean;
    /** Whether to capture metadata (default: true) */
    captureMetadata?: boolean;
    /** Organization ID for traces */
    organizationId?: number;
    /** Custom trace name prefix */
    tracePrefix?: string;
}
/**
 * Wrap OpenAI client with automatic tracing
 *
 * @example
 * ```typescript
 * import OpenAI from 'openai';
 * import { traceOpenAI } from '@ai-eval-platform/sdk/integrations/openai';
 *
 * const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 * const tracedOpenAI = traceOpenAI(openai, evalClient);
 *
 * // Automatically traced
 * const completion = await tracedOpenAI.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 */
export declare function traceOpenAI(openai: any, evalClient: AIEvalClient, options?: OpenAITraceOptions): any;
/**
 * Manual trace wrapper for OpenAI calls
 *
 * @example
 * ```typescript
 * const response = await traceOpenAICall(
 *   evalClient,
 *   'gpt-4-completion',
 *   async () => {
 *     return await openai.chat.completions.create({
 *       model: 'gpt-4',
 *       messages: [{ role: 'user', content: 'Hello!' }]
 *     });
 *   }
 * );
 * ```
 */
export declare function traceOpenAICall<T>(evalClient: AIEvalClient, name: string, fn: () => Promise<T>, options?: OpenAITraceOptions): Promise<T>;
