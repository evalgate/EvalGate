"use strict";
/**
 * Cost provider interface for budget normalization
 * Supports Stripe LLM billing (when GA) and manual cost specification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeCostProvider = exports.ManualCostProvider = void 0;
exports.createCostProvider = createCostProvider;
/**
 * Manual cost provider - uses user-specified price per trace
 * Fallback for teams not using Stripe LLM billing
 */
class ManualCostProvider {
    constructor(pricePerTrace) {
        this.pricePerTrace = pricePerTrace;
    }
    async getCostUsd(traces) {
        return traces.length * this.pricePerTrace;
    }
}
exports.ManualCostProvider = ManualCostProvider;
/**
 * Stripe cost provider - integrates with Stripe LLM token billing
 * TODO: Wire when Stripe LLM billing is GA (currently private preview)
 *
 * This will connect to Stripe's AI Gateway to get real-time pricing data
 * and actual token consumption from the specified meter ID.
 */
class StripeCostProvider {
    constructor(_stripeMeterId) {
        // TODO: Initialize Stripe client when LLM billing is GA
        throw new Error("Stripe LLM billing is private preview - implementation pending GA");
    }
    async getCostUsd(_traces) {
        // TODO: Implement when Stripe LLM billing is GA:
        // 1. Query Stripe meter for token usage by model
        // 2. Apply current pricing from Stripe's AI Gateway
        // 3. Return actual cost incurred
        throw new Error("Stripe LLM billing integration pending GA release");
    }
}
exports.StripeCostProvider = StripeCostProvider;
/**
 * Factory to create appropriate cost provider based on config
 */
function createCostProvider(costSource) {
    switch (costSource.provider) {
        case "manual":
            if (!costSource.manualPricePerTrace) {
                throw new Error("manualPricePerTrace is required when using manual cost provider");
            }
            return new ManualCostProvider(costSource.manualPricePerTrace);
        case "stripe":
            if (!costSource.stripeMeterId) {
                throw new Error("stripeMeterId is required when using Stripe cost provider");
            }
            return new StripeCostProvider(costSource.stripeMeterId);
        default:
            throw new Error(`Unsupported cost provider: ${costSource.provider}`);
    }
}
