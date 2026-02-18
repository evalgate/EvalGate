// Trace collection SDK for capturing LLM calls and spans

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface SpanData {
  name: string;
  spanType: "llm" | "tool" | "agent" | "retrieval" | "custom";
  input: any;
  output?: any;
  metadata?: Record<string, any>;
  error?: string;
}

export class TraceCollector {
  private apiEndpoint: string;
  private organizationId: string;
  private currentTrace: SpanContext | null = null;
  private spans: Map<string, any> = new Map();

  constructor(apiEndpoint: string, organizationId: string) {
    this.apiEndpoint = apiEndpoint;
    this.organizationId = organizationId;
  }

  /**
   * Start a new trace
   */
  async startTrace(name: string, metadata?: Record<string, any>, tags?: string[]): Promise<string> {
    const traceId = this.generateId();

    try {
      const response = await fetch(`${this.apiEndpoint}/api/traces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: this.organizationId,
          name,
          metadata: metadata || {},
          tags: tags || [],
        }),
      });

      if (!response.ok) {
        console.error("[v0] Failed to create trace:", await response.text());
        return traceId;
      }

      const { trace } = await response.json();
      this.currentTrace = { traceId: trace.id, spanId: trace.id };
      return trace.id;
    } catch (error) {
      console.error("[v0] Error creating trace:", error);
      return traceId;
    }
  }

  /**
   * Start a new span within the current trace
   */
  async startSpan(data: SpanData, parentSpanId?: string): Promise<string> {
    if (!this.currentTrace) {
      console.warn("[v0] No active trace. Call startTrace() first.");
      return this.generateId();
    }

    const spanId = this.generateId();
    const startTime = new Date().toISOString();

    this.spans.set(spanId, {
      ...data,
      spanId,
      traceId: this.currentTrace.traceId,
      parentSpanId: parentSpanId || this.currentTrace.spanId,
      startTime,
    });

    return spanId;
  }

  /**
   * End a span and send it to the server
   */
  async endSpan(spanId: string, output?: any, error?: string): Promise<void> {
    const span = this.spans.get(spanId);
    if (!span) {
      console.warn(`[v0] Span ${spanId} not found`);
      return;
    }

    const endTime = new Date().toISOString();
    const startTime = new Date(span.startTime);
    const durationMs = new Date(endTime).getTime() - startTime.getTime();

    try {
      await fetch(`${this.apiEndpoint}/api/traces/${span.traceId}/spans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: span.name,
          spanType: span.spanType,
          parentSpanId: span.parentSpanId,
          startTime: span.startTime,
          endTime,
          durationMs,
          input: span.input,
          output: output || span.output,
          metadata: span.metadata || {},
          error: error || span.error,
        }),
      });

      this.spans.delete(spanId);
    } catch (error) {
      console.error("[v0] Error ending span:", error);
    }
  }

  /**
   * Trace an async function
   */
  async trace<T>(
    name: string,
    spanType: SpanData["spanType"],
    fn: () => Promise<T>,
    input?: any,
  ): Promise<T> {
    const spanId = await this.startSpan({
      name,
      spanType,
      input: input || {},
    });

    try {
      const result = await fn();
      await this.endSpan(spanId, result);
      return result;
    } catch (error) {
      await this.endSpan(
        spanId,
        undefined,
        error instanceof Error ? error.message : "Unknown error",
      );
      throw error;
    }
  }

  /**
   * End the current trace
   */
  endTrace(): void {
    this.currentTrace = null;
    this.spans.clear();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Helper function to create a trace collector
 */
export function createTraceCollector(organizationId: string): TraceCollector {
  const apiEndpoint = typeof window !== "undefined" ? window.location.origin : "";
  return new TraceCollector(apiEndpoint, organizationId);
}
