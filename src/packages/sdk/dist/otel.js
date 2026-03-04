"use strict";
/**
 * OpenTelemetry Export for WorkflowTracer
 *
 * Converts WorkflowTracer spans, decisions, and costs into
 * OpenTelemetry-compatible span data for export to any OTEL collector.
 *
 * Usage:
 *   import { OTelExporter } from "@evalgate/sdk/otel";
 *
 *   const exporter = new OTelExporter({ endpoint: "http://localhost:4318" });
 *   const tracer = new WorkflowTracer(client, { debug: true });
 *   // ... run workflow ...
 *   await exporter.exportFromTracer(tracer);
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OTelExporter = void 0;
exports.createOTelExporter = createOTelExporter;
/**
 * Generate a random 16-byte hex trace ID
 */
function generateTraceId() {
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
/**
 * Generate a random 8-byte hex span ID
 */
function generateSpanId() {
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
/**
 * Convert milliseconds to nanosecond string
 */
function msToNano(ms) {
    return `${BigInt(ms) * BigInt(1000000)}`;
}
/**
 * Create an OTEL attribute
 */
function attr(key, value) {
    if (typeof value === "string") {
        return { key, value: { stringValue: value } };
    }
    if (typeof value === "number") {
        if (Number.isInteger(value)) {
            return { key, value: { intValue: String(value) } };
        }
        return { key, value: { doubleValue: value } };
    }
    return { key, value: { boolValue: value } };
}
/**
 * OpenTelemetry Exporter for EvalGate WorkflowTracer
 */
class OTelExporter {
    constructor(options = {}) {
        this.options = {
            endpoint: options.endpoint ?? "http://localhost:4318/v1/traces",
            serviceName: options.serviceName ?? "evalgate",
            resourceAttributes: options.resourceAttributes ?? {},
            sdkVersion: options.sdkVersion ?? "2.2.4",
            headers: options.headers ?? {},
        };
    }
    /**
     * Export workflow data from a WorkflowTracer instance
     */
    exportFromTracer(tracer) {
        const workflow = tracer.getCurrentWorkflow();
        const handoffs = tracer.getHandoffs();
        const decisions = tracer.getDecisions();
        const costs = tracer.getCosts();
        const traceId = generateTraceId();
        const rootSpanId = generateSpanId();
        const now = Date.now();
        const spans = [];
        // Root workflow span
        if (workflow) {
            spans.push({
                traceId,
                spanId: rootSpanId,
                name: `workflow.${workflow.name}`,
                kind: 1,
                startTimeUnixNano: msToNano(new Date(workflow.startedAt).getTime()),
                endTimeUnixNano: msToNano(now),
                attributes: [
                    attr("evalgate.workflow.name", workflow.name),
                    attr("evalgate.workflow.id", workflow.id),
                    attr("evalgate.workflow.trace_id", workflow.traceId),
                ],
                status: { code: 1 },
                events: [],
            });
        }
        // Decision spans
        for (let i = 0; i < decisions.length; i++) {
            const decision = decisions[i];
            const spanId = generateSpanId();
            spans.push(this.decisionToSpan(traceId, spanId, rootSpanId, decision, now - decisions.length + i));
        }
        // Handoff events
        for (let i = 0; i < handoffs.length; i++) {
            const handoff = handoffs[i];
            const spanId = generateSpanId();
            spans.push(this.handoffToSpan(traceId, spanId, rootSpanId, handoff));
        }
        // Cost spans
        for (let i = 0; i < costs.length; i++) {
            const cost = costs[i];
            const spanId = generateSpanId();
            spans.push(this.costToSpan(traceId, spanId, rootSpanId, cost, now - costs.length + i));
        }
        return this.buildPayload(spans);
    }
    /**
     * Export a run result as OTEL spans
     */
    exportRunResult(runResult) {
        const traceId = generateTraceId();
        const rootSpanId = generateSpanId();
        const spans = [];
        // Root run span
        spans.push({
            traceId,
            spanId: rootSpanId,
            name: `evalgate.run.${runResult.runId}`,
            kind: 1,
            startTimeUnixNano: msToNano(runResult.metadata.startedAt),
            endTimeUnixNano: msToNano(runResult.metadata.completedAt),
            attributes: [
                attr("evalgate.run.id", runResult.runId),
                attr("evalgate.run.mode", runResult.metadata.mode),
                attr("evalgate.run.duration_ms", runResult.metadata.duration),
                attr("evalgate.run.pass_rate", runResult.summary.passRate),
                attr("evalgate.run.passed", runResult.summary.passed),
                attr("evalgate.run.failed", runResult.summary.failed),
            ],
            status: {
                code: runResult.summary.failed > 0 ? 2 : 1,
            },
            events: [],
        });
        // Per-spec child spans
        let offset = 0;
        for (const spec of runResult.results) {
            const spanId = generateSpanId();
            const specStart = runResult.metadata.startedAt + offset;
            const specEnd = specStart + spec.result.duration;
            offset += spec.result.duration;
            const attributes = [
                attr("evalgate.spec.id", spec.specId),
                attr("evalgate.spec.name", spec.name),
                attr("evalgate.spec.file", spec.filePath),
                attr("evalgate.spec.status", spec.result.status),
                attr("evalgate.spec.duration_ms", spec.result.duration),
            ];
            if (spec.result.score !== undefined) {
                attributes.push(attr("evalgate.spec.score", spec.result.score));
            }
            spans.push({
                traceId,
                spanId,
                parentSpanId: rootSpanId,
                name: `evalgate.spec.${spec.name}`,
                kind: 1,
                startTimeUnixNano: msToNano(specStart),
                endTimeUnixNano: msToNano(specEnd),
                attributes,
                status: {
                    code: spec.result.status === "passed" ? 1 : 2,
                    message: spec.result.error,
                },
                events: [],
            });
        }
        return this.buildPayload(spans);
    }
    /**
     * Send payload to OTEL collector via HTTP
     */
    async send(payload) {
        try {
            const response = await fetch(this.options.endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...this.options.headers,
                },
                body: JSON.stringify(payload),
            });
            return response.ok;
        }
        catch (err) {
            console.warn(`[OTelExporter] Failed to send: ${err instanceof Error ? err.message : String(err)}`);
            return false;
        }
    }
    decisionToSpan(traceId, spanId, parentSpanId, decision, timestampMs) {
        return {
            traceId,
            spanId,
            parentSpanId,
            name: `decision.${decision.agent}.${decision.chosen}`,
            kind: 1,
            startTimeUnixNano: msToNano(timestampMs),
            endTimeUnixNano: msToNano(timestampMs + 1),
            attributes: [
                attr("evalgate.decision.agent", decision.agent),
                attr("evalgate.decision.type", decision.type),
                attr("evalgate.decision.chosen", decision.chosen),
                attr("evalgate.decision.alternatives", decision.alternatives.length),
                ...(decision.confidence !== undefined
                    ? [attr("evalgate.decision.confidence", decision.confidence)]
                    : []),
                ...(decision.reasoning
                    ? [attr("evalgate.decision.reasoning", decision.reasoning)]
                    : []),
            ],
            status: { code: 1 },
            events: [],
        };
    }
    handoffToSpan(traceId, spanId, parentSpanId, handoff) {
        const ts = new Date(handoff.timestamp).getTime();
        return {
            traceId,
            spanId,
            parentSpanId,
            name: `handoff.${handoff.fromAgent ?? "start"}.${handoff.toAgent}`,
            kind: 1,
            startTimeUnixNano: msToNano(ts),
            endTimeUnixNano: msToNano(ts + 1),
            attributes: [
                attr("evalgate.handoff.from", handoff.fromAgent ?? "start"),
                attr("evalgate.handoff.to", handoff.toAgent),
                attr("evalgate.handoff.type", handoff.handoffType),
            ],
            status: { code: 1 },
            events: [],
        };
    }
    costToSpan(traceId, spanId, parentSpanId, cost, timestampMs) {
        return {
            traceId,
            spanId,
            parentSpanId,
            name: `cost.${cost.provider}.${cost.model}`,
            kind: 1,
            startTimeUnixNano: msToNano(timestampMs),
            endTimeUnixNano: msToNano(timestampMs + 1),
            attributes: [
                attr("evalgate.cost.provider", cost.provider),
                attr("evalgate.cost.model", cost.model),
                attr("evalgate.cost.input_tokens", cost.inputTokens),
                attr("evalgate.cost.output_tokens", cost.outputTokens),
                attr("evalgate.cost.total_tokens", cost.totalTokens),
                attr("evalgate.cost.total_usd", cost.totalCost),
            ],
            status: { code: 1 },
            events: [],
        };
    }
    buildPayload(spans) {
        const resourceAttrs = [
            attr("service.name", this.options.serviceName),
            attr("telemetry.sdk.name", "evalgate"),
            attr("telemetry.sdk.version", this.options.sdkVersion),
            attr("telemetry.sdk.language", "nodejs"),
        ];
        for (const [key, value] of Object.entries(this.options.resourceAttributes)) {
            resourceAttrs.push(attr(key, value));
        }
        return {
            resourceSpans: [
                {
                    resource: { attributes: resourceAttrs },
                    scopeSpans: [
                        {
                            scope: {
                                name: "evalgate",
                                version: this.options.sdkVersion,
                            },
                            spans,
                        },
                    ],
                },
            ],
        };
    }
}
exports.OTelExporter = OTelExporter;
/**
 * Convenience factory
 */
function createOTelExporter(options) {
    return new OTelExporter(options);
}
