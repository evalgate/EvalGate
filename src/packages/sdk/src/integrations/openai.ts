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

import type { AIEvalClient } from "../client";
import { mergeWithContext } from "../context";

interface OpenAIChatParams {
	model: string;
	messages: unknown[];
	temperature?: number;
	max_tokens?: number;
	[key: string]: unknown;
}

interface OpenAIChatCompletion {
	choices: Array<{ message?: unknown; finish_reason?: unknown }>;
	usage?: unknown;
	[key: string]: unknown;
}

interface OpenAIClient {
	chat: {
		completions: {
			create: (
				params: OpenAIChatParams,
				requestOptions?: Record<string, unknown>,
			) => Promise<OpenAIChatCompletion>;
		};
	};
}

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
export function traceOpenAI(
	openai: OpenAIClient,
	evalClient: AIEvalClient,
	options: OpenAITraceOptions = {},
): OpenAIClient {
	const {
		captureInput = true,
		captureOutput = true,
		captureMetadata = true,
		organizationId,
		tracePrefix = "openai",
	} = options;

	// Create proxy for chat.completions.create
	const originalCreate = openai.chat.completions.create.bind(
		openai.chat.completions,
	);

	openai.chat.completions.create = async (
		params: OpenAIChatParams,
		requestOptions?: Record<string, unknown>,
	) => {
		const startTime = Date.now();
		const traceId = `${tracePrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		try {
			// Call original method
			const response = await originalCreate(params, requestOptions);
			const durationMs = Date.now() - startTime;

			// Create trace with success status and complete metadata
			// Trace creation is non-fatal — never lose the OpenAI result due to tracing issues
			try {
				const traceMetadata = mergeWithContext({
					model: params.model,
					temperature: params.temperature,
					max_tokens: params.max_tokens,
					...(captureInput ? { input: params.messages } : {}),
					...(captureOutput ? { output: response.choices[0]?.message } : {}),
					...(captureMetadata
						? {
								usage: response.usage,
								finish_reason: response.choices[0]?.finish_reason,
							}
						: {}),
				});

				await evalClient.traces?.create({
					name: `OpenAI: ${params.model}`,
					traceId,
					organizationId: organizationId || evalClient.getOrganizationId(),
					status: "success",
					durationMs,
					metadata: traceMetadata,
				});
			} catch {
				/* trace failure is non-fatal */
			}

			return response;
		} catch (error) {
			const durationMs = Date.now() - startTime;

			// Create trace with error status — non-fatal
			try {
				const errorMetadata = mergeWithContext({
					model: params.model,
					temperature: params.temperature,
					max_tokens: params.max_tokens,
					...(captureInput ? { input: params.messages } : {}),
					...(captureMetadata ? { params } : {}),
					error: error instanceof Error ? error.message : String(error),
				});

				await evalClient.traces?.create({
					name: `OpenAI: ${params.model}`,
					traceId,
					organizationId: organizationId || evalClient.getOrganizationId(),
					status: "error",
					durationMs,
					metadata: errorMetadata,
				});
			} catch {
				/* trace failure is non-fatal */
			}

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
export async function traceOpenAICall<T>(
	evalClient: AIEvalClient,
	name: string,
	fn: () => Promise<T>,
	options: OpenAITraceOptions = {},
): Promise<T> {
	const startTime = Date.now();
	const traceId = `openai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

	// Trace creation is non-fatal — never lose the fn() result due to tracing issues
	try {
		await evalClient.traces?.create({
			name,
			traceId,
			organizationId: options.organizationId || evalClient.getOrganizationId(),
			status: "pending",
			metadata: mergeWithContext({}),
		});
	} catch {
		/* trace failure is non-fatal */
	}

	try {
		const result = await fn();
		const durationMs = Date.now() - startTime;

		try {
			await evalClient.traces?.create({
				name,
				traceId,
				organizationId:
					options.organizationId || evalClient.getOrganizationId(),
				status: "success",
				durationMs,
				metadata: mergeWithContext({}),
			});
		} catch {
			/* trace failure is non-fatal */
		}

		return result;
	} catch (error) {
		const durationMs = Date.now() - startTime;

		try {
			await evalClient.traces?.create({
				name,
				traceId,
				organizationId:
					options.organizationId || evalClient.getOrganizationId(),
				status: "error",
				durationMs,
				metadata: mergeWithContext({
					error: error instanceof Error ? error.message : String(error),
				}),
			});
		} catch {
			/* trace failure is non-fatal */
		}

		throw error;
	}
}
