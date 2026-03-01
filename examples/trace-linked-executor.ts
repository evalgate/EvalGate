/**
 * Example: Trace-Linked Executor
 *
 * Instead of calling a model directly, this executor scores outputs
 * that were captured through instrumentation (tracing).
 *
 * Use case: You've instrumented your production app with the SDK's
 * WorkflowTracer. Now you want to evaluate the quality of responses
 * that were already served to users.
 *
 * Usage:
 *   Set EVALAI_API_KEY + EVALAI_BASE_URL env vars, then:
 *   npx ts-node examples/trace-linked-executor.ts
 */

import { AIEvalClient, WorkflowTracer } from "@evalgate/sdk";

async function main() {
	const client = new AIEvalClient({
		baseUrl: process.env.EVALAI_BASE_URL || "http://localhost:3000",
		apiKey: process.env.EVALAI_API_KEY || "",
	});

	// ── Phase 1: Instrument your production code ──
	// In a real app, this happens inside your request handlers.
	const tracer = new WorkflowTracer(client, {
		workflowName: "customer-support-bot",
	});

	// Simulate capturing 3 production interactions
	const traceIds: string[] = [];

	for (let i = 0; i < 3; i++) {
		const trace = await tracer.startWorkflow({
			name: `support-interaction-${i}`,
			metadata: { userId: `user-${i}`, channel: "web" },
		});

		// Simulate spans (each represents an LLM call or tool use)
		await tracer.addSpan({
			traceId: trace.traceId,
			name: "classify-intent",
			input: `User message ${i}: How do I reset my password?`,
			output: "intent: password_reset",
			durationMs: 150,
			model: "gpt-4o-mini",
		});

		await tracer.addSpan({
			traceId: trace.traceId,
			name: "generate-response",
			input: "intent: password_reset",
			output:
				"To reset your password, go to Settings > Security > Reset Password.",
			durationMs: 800,
			model: "gpt-4o",
		});

		await tracer.endWorkflow(trace.traceId);
		traceIds.push(trace.traceId);
	}

	console.log(`Captured ${traceIds.length} production traces`);

	// ── Phase 2: Create a trace-linked evaluation ──
	const evaluation = await client.evaluations.create({
		name: "Support Bot Quality (Production Traces)",
		description: "Scores production interactions captured via tracing",
		type: "model_eval",
		executorType: "trace_linked",
		executorConfig: {
			traceIds,
			spanFilter: { name: "generate-response" }, // Only score the final response span
		},
	});

	console.log(`Created evaluation: ${evaluation.id}`);

	// 3. Add assertions as test cases
	const testCases = [
		{
			name: "Response relevance",
			input: "password_reset",
			expectedOutput: "Contains password reset instructions",
		},
		{
			name: "Response safety",
			input: "*",
			expectedOutput: "No harmful content",
		},
	];

	for (const tc of testCases) {
		await client.evaluations.addTestCase(evaluation.id, tc);
	}

	// 4. Run the evaluation
	const run = await client.evaluations.run(evaluation.id);
	console.log(`Started run: ${run.id}`);

	// 5. Wait for results
	let status = run.status;
	while (status === "pending" || status === "running") {
		await new Promise((r) => setTimeout(r, 2000));
		const updated = await client.evaluations.getRun(evaluation.id, run.id);
		status = updated.status;
		console.log(`  Status: ${status}`);
	}

	// 6. Get quality score
	const quality = await client.quality.latest(evaluation.id);
	console.log(`\nQuality Score: ${quality.score}/100`);
	console.log(
		"This score represents the quality of REAL production interactions.",
	);
}

main().catch(console.error);
