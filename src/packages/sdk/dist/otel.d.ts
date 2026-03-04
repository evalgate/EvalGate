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
import type { WorkflowTracer } from "./workflows";
/**
 * OTEL-compatible span representation
 * Follows the OpenTelemetry Trace specification
 */
export interface OTelSpan {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    name: string;
    /** OTLP SpanKind: 0=UNSPECIFIED, 1=INTERNAL, 2=SERVER, 3=CLIENT, 4=PRODUCER, 5=CONSUMER */
    kind: 0 | 1 | 2 | 3 | 4 | 5;
    startTimeUnixNano: string;
    endTimeUnixNano: string;
    attributes: OTelAttribute[];
    /** OTLP StatusCode: 0=STATUS_CODE_UNSET, 1=STATUS_CODE_OK, 2=STATUS_CODE_ERROR */
    status: {
        code: 0 | 1 | 2;
        message?: string;
    };
    events: OTelEvent[];
}
export interface OTelAttribute {
    key: string;
    value: {
        stringValue?: string;
        intValue?: string;
        doubleValue?: number;
        boolValue?: boolean;
    };
}
export interface OTelEvent {
    name: string;
    timeUnixNano: string;
    attributes: OTelAttribute[];
}
/**
 * OTEL export payload (OTLP JSON format)
 */
export interface OTelExportPayload {
    resourceSpans: Array<{
        resource: {
            attributes: OTelAttribute[];
        };
        scopeSpans: Array<{
            scope: {
                name: string;
                version: string;
            };
            spans: OTelSpan[];
        }>;
    }>;
}
export interface OTelExporterOptions {
    /** OTEL collector endpoint (default: http://localhost:4318/v1/traces) */
    endpoint?: string;
    /** Service name for resource attributes */
    serviceName?: string;
    /** Additional resource attributes */
    resourceAttributes?: Record<string, string>;
    /** SDK version */
    sdkVersion?: string;
    /** Headers for the export request */
    headers?: Record<string, string>;
}
/**
 * OpenTelemetry Exporter for EvalGate WorkflowTracer
 */
export declare class OTelExporter {
    private options;
    constructor(options?: OTelExporterOptions);
    /**
     * Export workflow data from a WorkflowTracer instance
     */
    exportFromTracer(tracer: WorkflowTracer): OTelExportPayload;
    /**
     * Export a run result as OTEL spans
     */
    exportRunResult(runResult: {
        runId: string;
        metadata: {
            startedAt: number;
            completedAt: number;
            duration: number;
            mode: string;
        };
        results: Array<{
            specId: string;
            name: string;
            filePath: string;
            result: {
                status: string;
                score?: number;
                duration: number;
                error?: string;
            };
        }>;
        summary: {
            passed: number;
            failed: number;
            passRate: number;
        };
    }): OTelExportPayload;
    /**
     * Send payload to OTEL collector via HTTP
     */
    send(payload: OTelExportPayload): Promise<boolean>;
    private decisionToSpan;
    private handoffToSpan;
    private costToSpan;
    private buildPayload;
}
/**
 * Convenience factory
 */
export declare function createOTelExporter(options?: OTelExporterOptions): OTelExporter;
