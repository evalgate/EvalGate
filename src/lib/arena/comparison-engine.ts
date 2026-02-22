// src/lib/arena/comparison-engine.ts
import { logger } from "@/lib/logger";
import { providerKeysService } from "@/lib/services/provider-keys.service";

export interface ComparisonRequest {
  prompt: string;
  models: string[];
  organizationId: number;
}

export interface ModelResponse {
  modelId: string;
  output: string;
  latencyMs: number;
  tokenCount: number;
  cost: number;
  error?: string;
}

export interface ComparisonResult {
  responses: ModelResponse[];
  prompt: string;
  completedAt: string;
}

/**
 * Comparison Engine — runs the same prompt through multiple LLM providers
 * and returns side-by-side results for the Battle Arena.
 */
export class ComparisonEngine {
  private providerEndpoints: Record<string, { url: string; headerKey: string }> = {
    openai: { url: "https://api.openai.com/v1/chat/completions", headerKey: "Authorization" },
    anthropic: { url: "https://api.anthropic.com/v1/messages", headerKey: "x-api-key" },
  };

  private modelToProvider: Record<string, { provider: string; model: string }> = {
    "gpt-4": { provider: "openai", model: "gpt-4" },
    "gpt-4o": { provider: "openai", model: "gpt-4o" },
    "gpt-4o-mini": { provider: "openai", model: "gpt-4o-mini" },
    "gpt-4-turbo": { provider: "openai", model: "gpt-4-turbo" },
    "claude-3.5-sonnet": { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
    "claude-3-opus": { provider: "anthropic", model: "claude-3-opus-20240229" },
    "claude-3-haiku": { provider: "anthropic", model: "claude-3-haiku-20240307" },
  };

  /**
   * Run a comparison across multiple models.
   * Calls real LLM APIs using the org's stored provider keys.
   */
  async compare(request: ComparisonRequest): Promise<ComparisonResult> {
    const responses = await Promise.allSettled(
      request.models.map((modelId) =>
        this.callModel(modelId, request.prompt, request.organizationId),
      ),
    );

    const results: ModelResponse[] = responses.map((res, i) => {
      if (res.status === "fulfilled") return res.value;
      return {
        modelId: request.models[i],
        output: "",
        latencyMs: 0,
        tokenCount: 0,
        cost: 0,
        error: res.reason?.message ?? "Unknown error",
      };
    });

    return {
      responses: results,
      prompt: request.prompt,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Call a single model via its provider's API.
   */
  private async callModel(
    modelId: string,
    prompt: string,
    organizationId: number,
  ): Promise<ModelResponse> {
    const mapping = this.modelToProvider[modelId];
    if (!mapping) throw new Error(`Unknown model: ${modelId}`);

    const apiKey = await this.getProviderKey(mapping.provider, organizationId);
    if (!apiKey) throw new Error(`No API key configured for provider: ${mapping.provider}`);

    const start = Date.now();

    try {
      let output = "";
      let tokenCount = 0;

      if (mapping.provider === "openai") {
        const res = await fetch(this.providerEndpoints.openai.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: mapping.model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1024,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? JSON.stringify(json));
        output = json.choices?.[0]?.message?.content ?? "";
        tokenCount = json.usage?.total_tokens ?? 0;
      } else if (mapping.provider === "anthropic") {
        const res = await fetch(this.providerEndpoints.anthropic.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: mapping.model,
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? JSON.stringify(json));
        output = json.content?.[0]?.text ?? "";
        tokenCount = (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0);
      }

      const latencyMs = Date.now() - start;
      const cost = this.estimateCost(modelId, tokenCount);

      return { modelId, output, latencyMs, tokenCount, cost };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`ComparisonEngine: ${modelId} failed`, { error: errorMessage });
      return {
        modelId,
        output: "",
        latencyMs: Date.now() - start,
        tokenCount: 0,
        cost: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Fetch the org's decrypted API key for a provider.
   */
  private async getProviderKey(provider: string, organizationId: number): Promise<string | null> {
    const key = await providerKeysService.getActiveProviderKey(organizationId, provider);
    return key?.decryptedKey ?? null;
  }

  private estimateCost(modelId: string, tokenCount: number): number {
    const prices: Record<string, number> = {
      "gpt-4": 0.03,
      "gpt-4o": 0.005,
      "gpt-4o-mini": 0.00015,
      "gpt-4-turbo": 0.01,
      "claude-3.5-sonnet": 0.015,
      "claude-3-opus": 0.075,
      "claude-3-haiku": 0.00025,
    };
    return (tokenCount / 1000) * (prices[modelId] ?? 0.01);
  }
}

export const comparisonEngine = new ComparisonEngine();
