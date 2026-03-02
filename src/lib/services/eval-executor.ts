/**
 * Evaluation Executor Abstraction
 *
 * Defines the interface for executing inputs during evaluation runs
 * and provides built-in executor implementations.
 */

import crypto from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { costRecords, spans, traces } from "@/db/schema";
import { sha256Hex } from "@/lib/crypto/hash";
import { sha256Input } from "@/lib/utils/input-hash";
import { providerKeysService } from "./provider-keys.service";

// ── Interface ──

export interface EvalExecutorResult {
	output: string;
	latencyMs?: number;
	tokens?: { input: number; output: number };
	model?: string;
	provider?: string;
	meta?: { matched?: boolean; reason?: string; hasProvenance?: boolean };
}

export interface EvalExecutor {
	run(
		input: string,
		ctx?: { traceId?: string; metadata?: Record<string, unknown> },
	): Promise<EvalExecutorResult>;
}

// ── Direct LLM Executor ──

export class DirectLLMExecutor implements EvalExecutor {
	constructor(
		private organizationId: number,
		private model: string = "gpt-4o-mini",
		private provider: string = "openai",
		private systemPrompt?: string,
	) {}

	async run(input: string): Promise<EvalExecutorResult> {
		const t0 = Date.now();

		if (this.provider === "openai") {
			const providerKey = await providerKeysService.getActiveProviderKey(
				this.organizationId,
				"openai",
			);
			if (!providerKey) {
				throw new Error(
					"No OpenAI provider key configured for this organization",
				);
			}

			const response = await fetch(
				"https://api.openai.com/v1/chat/completions",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${providerKey.decryptedKey}`,
					},
					body: JSON.stringify({
						model: this.model,
						messages: [
							...(this.systemPrompt
								? [{ role: "system" as const, content: this.systemPrompt }]
								: []),
							{ role: "user" as const, content: input },
						],
						temperature: 0.1,
					}),
				},
			);

			if (!response.ok) {
				const errorBody = await response.text();
				throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
			}

			const data = await response.json();
			const content = data.choices?.[0]?.message?.content ?? "";
			const usage = data.usage;

			return {
				output: content,
				latencyMs: Date.now() - t0,
				tokens: usage
					? { input: usage.prompt_tokens, output: usage.completion_tokens }
					: undefined,
				model: this.model,
				provider: "openai",
			};
		}

		if (this.provider === "anthropic") {
			const providerKey = await providerKeysService.getActiveProviderKey(
				this.organizationId,
				"anthropic",
			);
			if (!providerKey) {
				throw new Error(
					"No Anthropic provider key configured for this organization",
				);
			}

			const response = await fetch("https://api.anthropic.com/v1/messages", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": providerKey.decryptedKey,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify({
					model: this.model,
					max_tokens: 4096,
					...(this.systemPrompt ? { system: this.systemPrompt } : {}),
					messages: [{ role: "user", content: input }],
				}),
			});

			if (!response.ok) {
				const errorBody = await response.text();
				throw new Error(
					`Anthropic API error (${response.status}): ${errorBody}`,
				);
			}

			const data = await response.json();
			const content = data.content?.[0]?.text ?? "";
			const usage = data.usage;

			return {
				output: content,
				latencyMs: Date.now() - t0,
				tokens: usage
					? { input: usage.input_tokens, output: usage.output_tokens }
					: undefined,
				model: this.model,
				provider: "anthropic",
			};
		}

		throw new Error(`Unsupported provider: ${this.provider}`);
	}
}

// ── Webhook Executor ──

export class WebhookExecutor implements EvalExecutor {
	constructor(
		private url: string,
		private secret?: string,
	) {}

	async run(
		input: string,
		ctx?: { traceId?: string; metadata?: Record<string, unknown> },
	): Promise<EvalExecutorResult> {
		const t0 = Date.now();
		const timestamp = new Date().toISOString();
		const metadata = ctx?.metadata ?? {};
		const evaluationRunId = metadata.evaluationRunId as number | undefined;
		const testCaseId = metadata.testCaseId as number | undefined;
		const inputHash = sha256Input(input);
		const idempotencyKey =
			evaluationRunId != null && testCaseId != null
				? sha256Hex(`${evaluationRunId}.${testCaseId}.${inputHash}`)
				: crypto.randomUUID();
		const rawBody = JSON.stringify({ input, ...ctx });

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"X-EvalGate-Timestamp": timestamp,
			"X-EvalGate-Idempotency-Key": idempotencyKey,
		};

		if (this.secret) {
			const payloadToSign = `${timestamp}.${rawBody}`;
			const signature = crypto
				.createHmac("sha256", this.secret)
				.update(payloadToSign)
				.digest("hex");
			headers["X-EvalGate-Signature"] = `sha256=${signature}`;
		}

		const response = await fetch(this.url, {
			method: "POST",
			headers,
			body: rawBody,
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(`Webhook error (${response.status}): ${errorBody}`);
		}

		const json = await response.json();

		return {
			output: json.output ?? "",
			latencyMs: Date.now() - t0,
			tokens: json.tokens,
			model: json.model,
			provider: json.provider,
		};
	}
}

// ── Trace-Linked Executor ──

/**
 * Looks up the most recent span matching the test case input from the unified
 * spans table. Run-aware, single-query, uses inputHash for deterministic matching.
 * For post-hoc evaluation of outputs captured from instrumentation.
 */
export class TraceLinkedExecutor implements EvalExecutor {
	constructor(
		private organizationId: number,
		private evaluationRunId?: number,
		private runStartedAt?: string,
	) {}

	async run(input: string): Promise<EvalExecutorResult> {
		const t0 = Date.now();
		const inputHash = sha256Input(input);

		// Single query: join spans → traces, filter by org + inputHash + time/run
		const conditions = [
			eq(traces.organizationId, this.organizationId),
			eq(spans.inputHash, inputHash),
		];

		// Apply BOTH when available (defense-in-depth: createdAt floor prevents old spans
		// from matching even if a client stamps the wrong runId maliciously)
		if (this.evaluationRunId) {
			conditions.push(eq(spans.evaluationRunId, this.evaluationRunId));
		}
		if (this.runStartedAt) {
			conditions.push(gte(spans.createdAt, new Date(this.runStartedAt)));
		}

		// Subquery: aggregate cost/provenance per span (avoids row explosion from retries)
		const latestCost = db
			.select({
				spanId: costRecords.spanId,
				model: sql<string>`max(${costRecords.model})`.as("model"),
				provider: sql<string>`max(${costRecords.provider})`.as("provider"),
				totalCost: sql<string>`max(${costRecords.totalCost})`.as("totalCost"),
			})
			.from(costRecords)
			.where(
				and(
					eq(costRecords.organizationId, this.organizationId),
					...(this.evaluationRunId
						? [eq(costRecords.evaluationRunId, this.evaluationRunId)]
						: []),
				),
			)
			.groupBy(costRecords.spanId)
			.as("latestCost");

		const [matched] = await db
			.select({
				id: spans.id,
				output: spans.output,
				durationMs: spans.durationMs,
				model: latestCost.model,
				provider: latestCost.provider,
				totalCost: latestCost.totalCost,
			})
			.from(spans)
			.innerJoin(traces, eq(spans.traceId, traces.id))
			.leftJoin(latestCost, eq(latestCost.spanId, spans.id))
			.where(and(...conditions))
			.orderBy(desc(spans.createdAt))
			.limit(1);

		if (matched) {
			const hasProvenance = !!matched.model; // model comes from cost_records join
			return {
				output: matched.output ?? "",
				latencyMs: matched.durationMs ?? Date.now() - t0,
				model: matched.model ?? undefined,
				provider: matched.provider ?? "trace-linked",
				meta: { matched: true, hasProvenance },
			};
		}

		return {
			output: "",
			latencyMs: Date.now() - t0,
			provider: "trace-linked",
			meta: { matched: false, reason: "NO_SPAN_MATCH" },
		};
	}
}

// ── Factory ──

export type ExecutorType = "direct_llm" | "webhook" | "trace_linked";

export interface ExecutorConfig {
	model?: string;
	provider?: string;
	systemPrompt?: string;
	url?: string;
	secret?: string;
}

export interface RunContext {
	evaluationRunId?: number;
	runStartedAt?: string;
}

/**
 * Create an executor instance from a type and config.
 */
export function createExecutor(
	type: ExecutorType,
	config: ExecutorConfig,
	organizationId: number,
	runContext?: RunContext,
): EvalExecutor {
	switch (type) {
		case "direct_llm":
			return new DirectLLMExecutor(
				organizationId,
				config.model,
				config.provider,
				config.systemPrompt,
			);
		case "webhook":
			if (!config.url)
				throw new Error("Webhook executor requires a url in config");
			return new WebhookExecutor(config.url, config.secret);
		case "trace_linked":
			return new TraceLinkedExecutor(
				organizationId,
				runContext?.evaluationRunId,
				runContext?.runStartedAt,
			);
		default:
			throw new Error(`Unknown executor type: ${type}`);
	}
}
