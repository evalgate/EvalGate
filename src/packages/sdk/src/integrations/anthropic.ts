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
import { getCurrentContext, mergeWithContext } from '../context';

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
export function traceAnthropic(
  anthropic: any,
  evalClient: AIEvalClient,
  options: AnthropicTraceOptions = {}
): any {
  const {
    captureInput = true,
    captureOutput = true,
    captureMetadata = true,
    organizationId,
    tracePrefix = 'anthropic'
  } = options;

  // Create proxy for messages.create
  const originalCreate = anthropic.messages.create.bind(anthropic.messages);

  anthropic.messages.create = async (params: any, requestOptions?: any) => {
    const startTime = Date.now();
    const traceId = `${tracePrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Call original method
      const message = await originalCreate(params, requestOptions);
      const durationMs = Date.now() - startTime;

      // Create trace with success status and complete metadata
      const traceMetadata = mergeWithContext({
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
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Create trace with error status
      const errorMetadata = mergeWithContext({
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
export async function traceAnthropicCall<T>(
  evalClient: AIEvalClient,
  name: string,
  fn: () => Promise<T>,
  options: AnthropicTraceOptions = {}
): Promise<T> {
  const startTime = Date.now();
  const traceId = `anthropic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    await evalClient.traces.create({
      name,
      traceId,
      organizationId: options.organizationId || evalClient.getOrganizationId(),
      status: 'pending',
      metadata: mergeWithContext({})
    });

    const result = await fn();
    const durationMs = Date.now() - startTime;

    await evalClient.traces.create({
      name,
      traceId,
      organizationId: options.organizationId || evalClient.getOrganizationId(),
      status: 'success',
      durationMs,
      metadata: mergeWithContext({})
    });

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;

    await evalClient.traces.create({
      name,
      traceId,
      organizationId: options.organizationId || evalClient.getOrganizationId(),
      status: 'error',
      durationMs,
      metadata: mergeWithContext({
        error: error instanceof Error ? error.message : String(error)
      })
    });

    throw error;
  }
}