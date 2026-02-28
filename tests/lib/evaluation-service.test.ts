import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluations, testCases } from "@/db/schema";
import { evaluationService } from "@/lib/services/evaluation.service";

const insertedEvaluation = { id: 999, name: "Created Eval" };

let selectRows: unknown[] = [];
let lastBuilder: Record<string, unknown> | null = null;
let evaluationInsertValues: Record<string, unknown> | null = null;
let testCaseInsertValues: unknown[] | null = null;

const makeBuilder = (result: unknown[]) => {
	const builder: Record<string, unknown> = {
		from: vi.fn(() => builder),
		where: vi.fn(() => builder),
		limit: vi.fn(() => builder),
		offset: vi.fn(() => builder),
		orderBy: vi.fn(() => builder),
		// biome-ignore lint/suspicious/noThenProperty: test mock
		then: (onFulfilled: (value: unknown) => unknown) => {
			return Promise.resolve(result).then(onFulfilled);
		},
	};
	lastBuilder = builder;
	return builder;
};

vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => makeBuilder(selectRows)),
		insert: vi.fn((table: unknown) => ({
			values: (values: unknown) => {
				if (table === evaluations) {
					evaluationInsertValues = values as Record<string, unknown>;
					return {
						returning: () => Promise.resolve([insertedEvaluation]),
					};
				}
				if (table === testCases) {
					testCaseInsertValues = values as unknown[];
					return Promise.resolve();
				}
				return Promise.resolve();
			},
		})),
	},
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
	and: vi.fn((...args: unknown[]) => ({ args })),
	desc: vi.fn((value: unknown) => value),
}));

vi.mock("@/lib/logger", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/services/aggregate-metrics.service", () => ({
	computeAndStoreQualityScore: vi.fn(),
}));

vi.mock("@/lib/services/audit.service", () => ({
	auditService: { log: vi.fn() },
}));

describe("EvaluationService business logic", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		selectRows = [];
		lastBuilder = null;
		evaluationInsertValues = null;
		testCaseInsertValues = null;
	});

	it("list paginates and scopes evaluations by organization + status", async () => {
		selectRows = [{ id: 1 }, { id: 2 }];

		const results = await evaluationService.list(42, {
			limit: 10,
			offset: 5,
			status: "active",
		});

		expect(results).toEqual(selectRows);
		expect(lastBuilder?.limit).toHaveBeenCalledWith(10);
		expect(lastBuilder?.offset).toHaveBeenCalledWith(5);
		expect(vi.mocked(eq)).toHaveBeenCalledWith(evaluations.organizationId, 42);
		expect(vi.mocked(eq)).toHaveBeenCalledWith(evaluations.status, "active");
		expect(vi.mocked(and)).toHaveBeenCalled();
	});

	it("create stores evaluation metadata and associated test cases", async () => {
		const payload = {
			name: "New Eval",
			description: "desc",
			type: "standard",
			executionSettings: { concurrency: 1 },
			modelSettings: { provider: "test" },
			testCases: [
				{
					input: "input 2",
					expectedOutput: "expected",
					metadata: { foo: "bar" },
				},
			],
		};

		const created = await evaluationService.create(
			99,
			"creator",
			payload as unknown as Parameters<typeof evaluationService.create>[2],
		);

		expect(created).toEqual(insertedEvaluation);
		expect(evaluationInsertValues).toMatchObject({
			organizationId: 99,
			createdBy: "creator",
			name: "New Eval",
			description: "desc",
			type: "standard",
		});
		expect(testCaseInsertValues).toHaveLength(1);
		expect((testCaseInsertValues?.[0] as Record<string, unknown>).input).toBe(
			"input 2",
		);
	});
});
