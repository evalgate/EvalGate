import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIEvalClient } from "../client";
import {
	createWorkflowTracer,
	traceWorkflowStep,
	WorkflowTracer,
} from "../workflows";

// Mock fetch
const mockFetch = vi.fn();

function createMockClient(): AIEvalClient {
	vi.stubGlobal("fetch", mockFetch);
	mockFetch.mockResolvedValue({
		ok: true,
		json: async () => ({ id: 1, traceId: "trace-1", name: "test" }),
		status: 200,
	});
	return new AIEvalClient({
		apiKey: "test-key",
		baseUrl: "http://localhost:3000",
		organizationId: 1,
	});
}

describe("WorkflowTracer", () => {
	let client: AIEvalClient;
	let tracer: WorkflowTracer;

	beforeEach(() => {
		client = createMockClient();
		tracer = new WorkflowTracer(client, { organizationId: 1 });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		mockFetch.mockReset();
	});

	describe("workflow lifecycle", () => {
		it("should start and end a workflow", async () => {
			const workflow = await tracer.startWorkflow("Test Pipeline");
			expect(workflow.name).toBe("Test Pipeline");
			expect(tracer.isWorkflowActive()).toBe(true);

			await tracer.endWorkflow({ status: "success" });
			expect(tracer.isWorkflowActive()).toBe(false);
		});

		it("should throw if starting a second workflow", async () => {
			await tracer.startWorkflow("First");
			await expect(tracer.startWorkflow("Second")).rejects.toThrow(
				"already active",
			);
		});

		it("should throw if ending without starting", async () => {
			await expect(tracer.endWorkflow()).rejects.toThrow("No active workflow");
		});
	});

	describe("agent spans", () => {
		it("should start and end agent spans", async () => {
			await tracer.startWorkflow("Pipeline");

			const span = await tracer.startAgentSpan("RouterAgent", {
				input: "hello",
			});
			expect(span.agentName).toBe("RouterAgent");
			expect(span.spanId).toBeTruthy();

			await tracer.endAgentSpan(span, { result: "routed" });
			await tracer.endWorkflow();
		});

		it("should throw if no workflow is active", async () => {
			await expect(tracer.startAgentSpan("Agent")).rejects.toThrow(
				"No active workflow",
			);
		});
	});

	describe("decision recording", () => {
		it("should record decisions", async () => {
			await tracer.startWorkflow("Pipeline");

			await tracer.recordDecision({
				agent: "Router",
				type: "route",
				chosen: "technical_support",
				alternatives: [{ action: "billing", confidence: 30 }],
				reasoning: "Detected technical keywords",
				confidence: 85,
			});

			const decisions = tracer.getDecisions();
			expect(decisions).toHaveLength(1);
			expect(decisions[0].agent).toBe("Router");
			expect(decisions[0].chosen).toBe("technical_support");
			expect(decisions[0].confidence).toBe(85);

			await tracer.endWorkflow();
		});

		it("should throw if no workflow is active", async () => {
			await expect(
				tracer.recordDecision({
					agent: "Agent",
					type: "action",
					chosen: "x",
					alternatives: [],
				}),
			).rejects.toThrow("No active workflow");
		});
	});

	describe("handoff recording", () => {
		it("should record handoffs between agents", async () => {
			await tracer.startWorkflow("Pipeline");

			await tracer.recordHandoff(
				"Router",
				"TechAgent",
				{ issue: "API" },
				"delegation",
			);

			const handoffs = tracer.getHandoffs();
			expect(handoffs).toHaveLength(1);
			expect(handoffs[0].fromAgent).toBe("Router");
			expect(handoffs[0].toAgent).toBe("TechAgent");
			expect(handoffs[0].handoffType).toBe("delegation");

			await tracer.endWorkflow();
		});
	});

	describe("cost tracking", () => {
		it("should record and calculate costs", async () => {
			await tracer.startWorkflow("Pipeline");

			const cost = await tracer.recordCost({
				provider: "openai",
				model: "gpt-4o",
				inputTokens: 1000,
				outputTokens: 500,
			});

			// gpt-4o pricing: $5/1M input, $15/1M output
			expect(cost.totalTokens).toBe(1500);
			expect(parseFloat(cost.inputCost)).toBeCloseTo(0.005, 4);
			expect(parseFloat(cost.outputCost)).toBeCloseTo(0.0075, 4);
			expect(parseFloat(cost.totalCost)).toBeCloseTo(0.0125, 4);

			expect(tracer.getTotalCost()).toBeCloseTo(0.0125, 4);

			await tracer.endWorkflow();
		});

		it("should track cost breakdown by category", async () => {
			await tracer.startWorkflow("Pipeline");

			await tracer.recordCost({
				provider: "openai",
				model: "gpt-4o",
				inputTokens: 1000,
				outputTokens: 500,
				category: "llm",
			});

			await tracer.recordCost({
				provider: "openai",
				model: "gpt-4o",
				inputTokens: 200,
				outputTokens: 100,
				category: "tool",
			});

			const breakdown = tracer.getCostBreakdown();
			expect(breakdown.llm).toBeGreaterThan(0);
			expect(breakdown.tool).toBeGreaterThan(0);
			expect(breakdown.embedding).toBe(0);

			await tracer.endWorkflow();
		});

		it("should use default pricing for unknown models", async () => {
			await tracer.startWorkflow("Pipeline");

			const cost = await tracer.recordCost({
				provider: "custom",
				model: "unknown-model",
				inputTokens: 1000000,
				outputTokens: 1000000,
			});

			// Default: $1/1M input, $3/1M output = $4 total
			expect(parseFloat(cost.totalCost)).toBeCloseTo(4.0, 1);

			await tracer.endWorkflow();
		});
	});

	describe("state resets", () => {
		it("should reset state when starting a new workflow", async () => {
			await tracer.startWorkflow("First");
			await tracer.recordCost({
				provider: "openai",
				model: "gpt-4o",
				inputTokens: 1000,
				outputTokens: 500,
			});
			await tracer.recordHandoff(undefined, "Agent1");
			await tracer.recordDecision({
				agent: "A",
				type: "action",
				chosen: "x",
				alternatives: [],
			});
			await tracer.endWorkflow();

			// Start fresh workflow
			await tracer.startWorkflow("Second");
			expect(tracer.getCosts()).toHaveLength(0);
			expect(tracer.getHandoffs()).toHaveLength(0);
			expect(tracer.getDecisions()).toHaveLength(0);
			expect(tracer.getTotalCost()).toBe(0);
			await tracer.endWorkflow();
		});
	});
});

describe("createWorkflowTracer", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ id: 1, traceId: "t", name: "n" }),
				status: 200,
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("should create a WorkflowTracer instance", () => {
		const client = new AIEvalClient({
			apiKey: "key",
			baseUrl: "http://localhost:3000",
		});
		const tracer = createWorkflowTracer(client, { organizationId: 1 });
		expect(tracer).toBeInstanceOf(WorkflowTracer);
	});
});

describe("traceWorkflowStep", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ id: 1, traceId: "t", name: "n" }),
				status: 200,
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("should trace a function execution", async () => {
		const client = new AIEvalClient({
			apiKey: "key",
			baseUrl: "http://localhost:3000",
			organizationId: 1,
		});
		const tracer = new WorkflowTracer(client, { organizationId: 1 });
		await tracer.startWorkflow("Test");

		const result = await traceWorkflowStep(tracer, "Agent", async () => {
			return "output";
		});

		expect(result).toBe("output");
		await tracer.endWorkflow();
	});

	it("should re-throw errors from the traced function", async () => {
		const client = new AIEvalClient({
			apiKey: "key",
			baseUrl: "http://localhost:3000",
			organizationId: 1,
		});
		const tracer = new WorkflowTracer(client, { organizationId: 1 });
		await tracer.startWorkflow("Test");

		await expect(
			traceWorkflowStep(tracer, "Agent", async () => {
				throw new Error("agent error");
			}),
		).rejects.toThrow("agent error");

		await tracer.endWorkflow({ status: "failed" }, "failed");
	});
});

describe("WorkflowTracer offline mode", () => {
	it("should not call client.traces in offline mode", async () => {
		const mockCreate = vi.fn().mockResolvedValue({ id: 1 });
		const mockUpdate = vi.fn().mockResolvedValue({});
		const mockCreateSpan = vi.fn().mockResolvedValue({});
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ id: 1 }),
				status: 200,
			}),
		);
		const client = new AIEvalClient({
			apiKey: "test-key",
			baseUrl: "http://localhost:3000",
			organizationId: 1,
		});
		// Spy on the actual traces methods
		client.traces.create = mockCreate;
		client.traces.update = mockUpdate;
		(client.traces as any).createSpan = mockCreateSpan;

		const tracer = new WorkflowTracer(client, {
			organizationId: 1,
			offline: true,
		});

		await tracer.startWorkflow("Offline Test");
		const span = await tracer.startAgentSpan("Agent1", { input: "hello" });
		await tracer.endAgentSpan(span, { result: "done" });
		await tracer.endWorkflow({ result: "ok" });

		expect(mockCreate).not.toHaveBeenCalled();
		expect(mockUpdate).not.toHaveBeenCalled();
		expect(mockCreateSpan).not.toHaveBeenCalled();
	});

	it("should still record handoffs in memory when offline", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ id: 1 }),
				status: 200,
			}),
		);
		const client = new AIEvalClient({
			apiKey: "test-key",
			baseUrl: "http://localhost:3000",
			organizationId: 1,
		});
		const tracer = new WorkflowTracer(client, {
			organizationId: 1,
			offline: true,
		});

		await tracer.startWorkflow("Test");
		await tracer.recordHandoff("AgentA", "AgentB", { reason: "escalation" });
		expect(tracer.getHandoffs()).toHaveLength(1);
		expect(tracer.getHandoffs()[0].fromAgent).toBe("AgentA");
		expect(tracer.getHandoffs()[0].toAgent).toBe("AgentB");
		await tracer.endWorkflow();
	});
});
