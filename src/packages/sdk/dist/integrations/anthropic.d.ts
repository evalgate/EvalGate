/**
 * Anthropic Integration
 * Tier 1.2: Framework Auto-Instrumentation - Anthropic wrapper
 *
 * @example
 * ```typescript
 * import { traceAnthropic } from '@ai-eval-platform/sdk/integrations/anthropic';
 * import Anthropic from '@anthropic-ai/sdk';
 *
 * const anthropic = new Anthropic({ apiKey: '...' });
 * const tracedAnthropic = traceAnthropic(anthropic, client);
 *
 * // All calls are automatically traced
 * const message = await tracedAnthropic.messages.create({
 *   model: 'claude-3-5-sonnet-20241022',
 *   max_tokens: 1024,
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 */
import type { AIEvalClient } from '../client';
export interface AnthropicTraceOptions {
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
 * Wrap Anthropic client with automatic tracing
 *
 * @example
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk';
 * import { traceAnthropic } from '@ai-eval-platform/sdk/integrations/anthropic';
 *
 * const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 * const tracedAnthropic = traceAnthropic(anthropic, evalClient);
 *
 * // Automatically traced
 * const message = await tracedAnthropic.messages.create({
 *   model: 'claude-3-5-sonnet-20241022',
 *   max_tokens: 1024,
 *   messages: [{ role: 'user', content: 'Hello, Claude!' }]
 * });
 * ```
 */
export declare function traceAnthropic(anthropic: any, evalClient: AIEvalClient, options?: AnthropicTraceOptions): any;
/**
 * Manual trace wrapper for Anthropic calls
 *
 * @example
 * ```typescript
 * const message = await traceAnthropicCall(
 *   evalClient,
 *   'claude-completion',
 *   async () => {
 *     return await anthropic.messages.create({
 *       model: 'claude-3-5-sonnet-20241022',
 *       max_tokens: 1024,
 *       messages: [{ role: 'user', content: 'Hello!' }]
 *     });
 *   }
 * );
 * ```
 */
export declare function traceAnthropicCall<T>(evalClient: AIEvalClient, name: string, fn: () => Promise<T>, options?: AnthropicTraceOptions): Promise<T>;
