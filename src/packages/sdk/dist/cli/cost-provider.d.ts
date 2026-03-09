/**
 * Cost provider interface for budget normalization
 * Supports Stripe LLM billing (when GA) and manual cost specification
 */
export interface TraceRecord {
    specId: string;
    model?: string;
    tokens?: {
        input?: number;
        output?: number;
        total?: number;
    };
    duration?: number;
}
export interface CostProvider {
    /**
     * Calculate total cost in USD for a set of traces
     */
    getCostUsd(traces: TraceRecord[]): Promise<number>;
}
/**
 * Manual cost provider - uses user-specified price per trace
 * Fallback for teams not using Stripe LLM billing
 */
export declare class ManualCostProvider implements CostProvider {
    private pricePerTrace;
    constructor(pricePerTrace: number);
    getCostUsd(traces: TraceRecord[]): Promise<number>;
}
/**
 * Stripe cost provider - integrates with Stripe LLM token billing
 * TODO: Wire when Stripe LLM billing is GA (currently private preview)
 *
 * This will connect to Stripe's AI Gateway to get real-time pricing data
 * and actual token consumption from the specified meter ID.
 */
export declare class StripeCostProvider implements CostProvider {
    constructor(_stripeMeterId: string);
    getCostUsd(_traces: TraceRecord[]): Promise<number>;
}
/**
 * Factory to create appropriate cost provider based on config
 */
export declare function createCostProvider(costSource: import("./config").CostSource): CostProvider;
