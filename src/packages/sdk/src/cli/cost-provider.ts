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
export class ManualCostProvider implements CostProvider {
	constructor(private pricePerTrace: number) {}

	async getCostUsd(traces: TraceRecord[]): Promise<number> {
		return traces.length * this.pricePerTrace;
	}
}

/**
 * Stripe cost provider - integrates with Stripe LLM token billing
 * TODO: Wire when Stripe LLM billing is GA (currently private preview)
 *
 * This will connect to Stripe's AI Gateway to get real-time pricing data
 * and actual token consumption from the specified meter ID.
 */
export class StripeCostProvider implements CostProvider {
	constructor(_stripeMeterId: string) {
		// TODO: Initialize Stripe client when LLM billing is GA
		throw new Error(
			"Stripe LLM billing is private preview - implementation pending GA",
		);
	}

	async getCostUsd(_traces: TraceRecord[]): Promise<number> {
		// TODO: Implement when Stripe LLM billing is GA:
		// 1. Query Stripe meter for token usage by model
		// 2. Apply current pricing from Stripe's AI Gateway
		// 3. Return actual cost incurred

		throw new Error("Stripe LLM billing integration pending GA release");
	}
}

/**
 * Factory to create appropriate cost provider based on config
 */
export function createCostProvider(
	costSource: import("./config").CostSource,
): CostProvider {
	switch (costSource.provider) {
		case "manual":
			if (!costSource.manualPricePerTrace) {
				throw new Error(
					"manualPricePerTrace is required when using manual cost provider",
				);
			}
			return new ManualCostProvider(costSource.manualPricePerTrace);

		case "stripe":
			if (!costSource.stripeMeterId) {
				throw new Error(
					"stripeMeterId is required when using Stripe cost provider",
				);
			}
			return new StripeCostProvider(costSource.stripeMeterId);

		default:
			throw new Error(
				`Unsupported cost provider: ${(costSource as any).provider}`,
			);
	}
}
