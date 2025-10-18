"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.traceOpenAI = traceOpenAI;
exports.traceOpenAICall = traceOpenAICall;
const context_1 = require("../context");
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
function traceOpenAI(openai, evalClient, options = {}) {
    const { captureInput = true, captureOutput = true, captureMetadata = true, organizationId, tracePrefix = 'openai' } = options;
    // Create proxy for chat.completions.create
    const originalCreate = openai.chat.completions.create.bind(openai.chat.completions);
    openai.chat.completions.create = async (params, requestOptions) => {
        const startTime = Date.now();
        const traceId = `${tracePrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        try {
            // Create trace
            const traceMetadata = (0, context_1.mergeWithContext)({
                model: params.model,
                temperature: params.temperature,
                max_tokens: params.max_tokens,
                ...(captureInput ? { input: params.messages } : {}),
                ...(captureMetadata ? { params } : {})
            });
            await evalClient.traces.create({
                name: `OpenAI: ${params.model}`,
                traceId,
                organizationId: organizationId || evalClient.getOrganizationId(),
                status: 'pending',
                metadata: traceMetadata
            });
            // Call original method
            const response = await originalCreate(params, requestOptions);
            const durationMs = Date.now() - startTime;
            // Update trace with success
            const outputMetadata = (0, context_1.mergeWithContext)({
                model: params.model,
                ...(captureOutput ? { output: response.choices[0]?.message } : {}),
                ...(captureMetadata ? {
                    usage: response.usage,
                    finish_reason: response.choices[0]?.finish_reason
                } : {})
            });
            await evalClient.traces.create({
                name: `OpenAI: ${params.model}`,
                traceId,
                organizationId: organizationId || evalClient.getOrganizationId(),
                status: 'success',
                durationMs,
                metadata: outputMetadata
            });
            return response;
        }
        catch (error) {
            const durationMs = Date.now() - startTime;
            // Update trace with error
            await evalClient.traces.create({
                name: `OpenAI: ${params.model}`,
                traceId,
                organizationId: organizationId || evalClient.getOrganizationId(),
                status: 'error',
                durationMs,
                metadata: (0, context_1.mergeWithContext)({
                    model: params.model,
                    error: error instanceof Error ? error.message : String(error)
                })
            });
            throw error;
        }
    };
    return openai;
}
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
async function traceOpenAICall(evalClient, name, fn, options = {}) {
    const startTime = Date.now();
    const traceId = `openai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
