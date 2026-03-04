/**
 * OTEL Integration Verification Script
 *
 * This script sends a real OTLP trace to a local collector and then
 * queries Jaeger to verify it landed. Run this AFTER docker compose up.
 *
 * Usage:
 *   cd src/packages/sdk/otel-integration
 *   docker compose up -d
 *   npx tsx verify-otel.ts
 *
 * Expected output:
 *   ✅ OTLP POST accepted (HTTP 200)
 *   ✅ Trace found in Jaeger: <traceId>
 *   ✅ Span count matches: 3 spans
 *
 * If any step fails, the script exits with code 1 and prints diagnostics.
 */

import { OTelExporter } from "../src/otel";

const COLLECTOR_URL = "http://localhost:4318/v1/traces";
const JAEGER_API = "http://localhost:16686/api";
const SERVICE_NAME = "evalgate-integration-test";

async function main() {
	console.log("\n🔬 EvalGate OTEL Integration Test\n");

	// Step 1: Build a realistic run result payload
	const exporter = new OTelExporter({
		endpoint: COLLECTOR_URL,
		serviceName: SERVICE_NAME,
		resourceAttributes: {
			"deployment.environment": "integration-test",
		},
	});

	const runResult = {
		runId: `integration-test-${Date.now()}`,
		metadata: {
			startedAt: Date.now() - 5000,
			completedAt: Date.now(),
			duration: 5000,
			mode: "spec" as const,
		},
		results: [
			{
				specId: "spec-integration-1",
				name: "chatbot-quality",
				filePath: "eval/chatbot.eval.ts",
				result: { status: "passed", score: 0.92, duration: 1200 },
			},
			{
				specId: "spec-integration-2",
				name: "safety-guard",
				filePath: "eval/safety.eval.ts",
				result: {
					status: "failed",
					duration: 800,
					error: "Jailbreak attempt not blocked",
				},
			},
		],
		summary: { passed: 1, failed: 1, passRate: 0.5 },
	};

	// Step 2: Export as OTLP payload
	const payload = exporter.exportRunResult(runResult);
	const traceId = payload.resourceSpans[0]?.scopeSpans[0]?.spans[0]?.traceId;
	const spanCount = payload.resourceSpans[0]?.scopeSpans[0]?.spans.length ?? 0;

	console.log(`  Trace ID:   ${traceId}`);
	console.log(`  Span count: ${spanCount}`);
	console.log(`  Service:    ${SERVICE_NAME}`);

	// Step 3: POST to collector
	console.log(`\n  POST ${COLLECTOR_URL}`);
	let _postOk = false;
	try {
		const res = await fetch(COLLECTOR_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		_postOk = res.ok;
		if (res.ok) {
			console.log(`  ✅ OTLP POST accepted (HTTP ${res.status})`);
		} else {
			const body = await res.text();
			console.error(`  ❌ OTLP POST rejected (HTTP ${res.status}): ${body}`);
			process.exit(1);
		}
	} catch (err) {
		console.error(`  ❌ Failed to connect to collector at ${COLLECTOR_URL}`);
		console.error(`     ${err instanceof Error ? err.message : String(err)}`);
		console.error(`\n  Is the collector running? Try: docker compose up -d\n`);
		process.exit(1);
	}

	// Step 4: Wait for Jaeger to ingest, then query
	console.log(`\n  Waiting 3s for Jaeger ingestion...`);
	await new Promise((resolve) => setTimeout(resolve, 3000));

	try {
		// Query Jaeger for our service
		const servicesRes = await fetch(`${JAEGER_API}/services`);
		if (!servicesRes.ok) {
			console.error(
				`  ❌ Jaeger API not responding (HTTP ${servicesRes.status})`,
			);
			process.exit(1);
		}
		const services = (await servicesRes.json()) as {
			data: string[];
		};
		if (!services.data.includes(SERVICE_NAME)) {
			console.error(`  ❌ Service "${SERVICE_NAME}" not found in Jaeger.`);
			console.error(`     Available services: ${services.data.join(", ")}`);
			process.exit(1);
		}
		console.log(`  ✅ Service "${SERVICE_NAME}" found in Jaeger`);

		// Query for the specific trace
		const traceRes = await fetch(`${JAEGER_API}/traces/${traceId}`);
		if (!traceRes.ok) {
			console.error(
				`  ❌ Trace ${traceId} not found in Jaeger (HTTP ${traceRes.status})`,
			);
			process.exit(1);
		}
		const traceData = (await traceRes.json()) as {
			data: Array<{
				traceID: string;
				spans: Array<{ spanID: string; operationName: string }>;
			}>;
		};

		const trace = traceData.data[0];
		if (!trace) {
			console.error(`  ❌ Trace data empty for ${traceId}`);
			process.exit(1);
		}

		console.log(`  ✅ Trace found in Jaeger: ${trace.traceID}`);

		// Verify span count
		const jaegerSpanCount = trace.spans.length;
		if (jaegerSpanCount === spanCount) {
			console.log(`  ✅ Span count matches: ${jaegerSpanCount} spans`);
		} else {
			console.error(
				`  ⚠️  Span count mismatch: expected ${spanCount}, got ${jaegerSpanCount}`,
			);
		}

		// List operations
		console.log(`\n  Spans in Jaeger:`);
		for (const span of trace.spans) {
			console.log(`    - ${span.operationName} (${span.spanID})`);
		}

		console.log(`\n  🎉 Integration test passed!\n`);
		console.log(
			`  View in Jaeger UI: http://localhost:16686/trace/${traceId}\n`,
		);
	} catch (err) {
		console.error(`  ❌ Failed to query Jaeger API at ${JAEGER_API}`);
		console.error(`     ${err instanceof Error ? err.message : String(err)}`);
		console.error(`\n  Is Jaeger running? Try: docker compose up -d\n`);
		process.exit(1);
	}
}

main();
