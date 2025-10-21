"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.traceAnthropic = traceAnthropic;
exports.traceAnthropicCall = traceAnthropicCall;
const context_1 = require("../context");
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
function traceAnthropic(anthropic, evalClient, options = {}) {
    const { captureInput = true, captureOutput = true, captureMetadata = true, organizationId, tracePrefix = 'anthropic' } = options;
    // Create proxy for messages.create
    const originalCreate = anthropic.messages.create.bind(anthropic.messages);
    anthropic.messages.create = async (params, requestOptions) => {
        const startTime = Date.now();
        const traceId = `${tracePrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        try {
            // Call original method
            const message = await originalCreate(params, requestOptions);
            const durationMs = Date.now() - startTime;
            // Create trace with success status and complete metadata
            const traceMetadata = (0, context_1.mergeWithContext)({
                model: params.model,
                temperature: params.temperature,
                max_tokens: params.max_tokens,
                ...(captureInput ? { input: params.messages } : {}),
                ...(captureOutput ? { output: message.content } : {}),
                ...(captureMetadata ? {
                    usage: message.usage,
                    stop_reason: message.stop_reason
                } : {})
            });
            await evalClient.traces.create({
                name: `Anthropic: ${params.model}`,
                traceId,
                organizationId: organizationId || evalClient.getOrganizationId(),
                status: 'success',
                durationMs,
                metadata: traceMetadata
            });
            return message;
        }
        catch (error) {
            const durationMs = Date.now() - startTime;
            // Create trace with error status
            const errorMetadata = (0, context_1.mergeWithContext)({
                model: params.model,
                temperature: params.temperature,
                max_tokens: params.max_tokens,
                ...(captureInput ? { input: params.messages } : {}),
                ...(captureMetadata ? { params } : {}),
                error: error instanceof Error ? error.message : String(error)
            });
            await evalClient.traces.create({
                name: `Anthropic: ${params.model}`,
                traceId,
                organizationId: organizationId || evalClient.getOrganizationId(),
                status: 'error',
                durationMs,
                metadata: errorMetadata
            }).catch(() => {
                // Ignore errors in trace creation to avoid masking the original error
            });
            throw error;
        }
    };
    return anthropic;
}
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
async function traceAnthropicCall(evalClient, name, fn, options = {}) {
    const startTime = Date.now();
    const traceId = `anthropic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
        await evalClient.traces.create({
            name,
            traceId,
            organizationId: options.organizationId || evalClient.getOrganizationId(),
            status: 'pending',
            metadata: (0, context_1.mergeWithContext)({})
        });
        const result = await fn();
        const durationMs = Date.now() - startTime;
        await evalClient.traces.create({
            name,
            traceId,
            organizationId: options.organizationId || evalClient.getOrganizationId(),
            status: 'success',
            durationMs,
            metadata: (0, context_1.mergeWithContext)({})
        });
        return result;
    }
    catch (error) {
        const durationMs = Date.now() - startTime;
        await evalClient.traces.create({
            name,
            traceId,
            organizationId: options.organizationId || evalClient.getOrganizationId(),
            status: 'error',
            durationMs,
            metadata: (0, context_1.mergeWithContext)({
                error: error instanceof Error ? error.message : String(error)
            })
        });
        throw error;
    }
}
