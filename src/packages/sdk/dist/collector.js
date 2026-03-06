"use strict";
/**
 * SDK helper for reporting traces to the collector endpoint.
 *
 * Usage:
 *   import { reportTrace } from '@evalgate/sdk';
 *   await reportTrace(client, { ... });
 *
 * Supports:
 *   - Client-side sampling (sampleRate)
 *   - Error traces always sent
 *   - Thumbs-down feedback always sent
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportTrace = reportTrace;
/**
 * Report a production trace to the collector endpoint.
 *
 * Client-side sampling: set `options.sampleRate` (0-1).
 * Error traces and thumbs-down feedback bypass sampling.
 */
async function reportTrace(client, input, options = {}) {
    const { sampleRate = 1.0 } = options;
    // Client-side sampling — errors and thumbs-down always pass through
    const isError = input.status === "error";
    const isNegativeFeedback = input.user_feedback?.type === "thumbs_down";
    const bypassSampling = isError || isNegativeFeedback;
    if (!bypassSampling && sampleRate < 1.0) {
        if (Math.random() >= sampleRate) {
            return {
                sent: false,
                trace_id: input.trace_id,
                skip_reason: "sampled_out",
            };
        }
    }
    // Use the client's internal fetch to POST to /api/collector
    const response = await client.request("/api/collector", {
        method: "POST",
        body: JSON.stringify(input),
    });
    return {
        sent: true,
        trace_id: input.trace_id,
        trace_db_id: response.trace_db_id,
        span_count: response.span_count,
        queued_for_analysis: response.queued_for_analysis,
    };
}
