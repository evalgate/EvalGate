/**
 * Type-safe DB mocking utilities based on Pattern A from service tests.
 *
 * This provides a reusable, typed pattern for mocking Drizzle ORM queries
 * while working with Vitest's vi.hoisted() constraints.
 *
 * Usage pattern:
 * ```ts
 * import { createDbState, createDbMockFactory, makeBuilder } from "../helpers/mock-db";
 *
 * // State must be created inline in vi.hoisted() - can't import modules there
 * const state = vi.hoisted(() => createDbState());
 *
 * // Use the factory to create the mock object
 * vi.mock("@/db", () => createDbMockFactory(state));
 *
 * // Control test data
 * state.selectRows = [{ id: 1, name: "test" }];
 * state.updateQueue = [[{ id: 1, name: "updated" }]];
 * ```
 */

export interface DbMockState {
	selectRows: unknown[];
	updateQueue: unknown[];
	insertCalls: unknown[];
	updateCalls: unknown[];
	deleteWhereCalled: boolean;
}

/**
 * Create a fresh DB mock state object.
 * Call this inside vi.hoisted() to create mutable state for tests.
 */
export function createDbState(): DbMockState {
	return {
		selectRows: [],
		updateQueue: [],
		insertCalls: [],
		updateCalls: [],
		deleteWhereCalled: false,
	};
}

/**
 * Thenable chain builder matching Drizzle's query API surface.
 * Returns an object with all the methods that Drizzle query builders have,
 * with a .then() property to make it awaitable.
 */
export function makeBuilder(_result: unknown[]): Record<string, unknown> {
	const chain = {
		from: vi.fn(() => chain),
		where: vi.fn(() => chain),
		orderBy: vi.fn(() => chain),
		limit: vi.fn(() => chain),
		offset: vi.fn(() => chain),
		returning: vi.fn(() => chain),
		set: vi.fn(() => chain),
		values: vi.fn(() => chain),
		innerJoin: vi.fn(() => chain),
		leftJoin: vi.fn(() => chain),
		groupBy: vi.fn(() => chain),
		having: vi.fn(() => chain),
		distinct: vi.fn(() => chain),
		for: vi.fn(() => chain),
	};
	return chain;
}

/**
 * Create a complete DB mock factory for vi.mock("@/db", ...).
 * Takes a DbMockState and returns an object with db, select, insert, etc. mocks.
 */
export function createDbMockFactory(state: DbMockState): {
	db: Record<string, unknown>;
} {
	return {
		db: {
			select: vi.fn(() => {
				// Pop from updateQueue first (for multi-query methods), fallback to selectRows
				const result =
					state.updateQueue.length > 0
						? state.updateQueue.shift()!
						: state.selectRows;
				return makeBuilder(Array.isArray(result) ? result : [result]);
			}),
			insert: vi.fn(() => ({
				values: vi.fn((values: unknown) => {
					state.insertCalls.push(values);
					return makeBuilder([{ id: 1, ...values }]); // Mock inserted row with ID
				}),
			})),
			update: vi.fn(() => ({
				set: vi.fn((values: unknown) => {
					state.updateCalls.push(values);
					return {
						where: vi.fn(() => {
							// Pop from updateQueue for the return value
							const result =
								state.updateQueue.length > 0
									? state.updateQueue.shift()!
									: [values];
							return makeBuilder(Array.isArray(result) ? result : [result]);
						}),
					};
				}),
			})),
			delete: vi.fn(() => ({
				where: vi.fn(() => {
					state.deleteWhereCalled = true;
					return makeBuilder([{ success: true }]);
				}),
			})),
			// Add $dynamic for queries that use it
			$dynamic: {},
		},
	};
}

/**
 * Common drizzle-orm operators mock.
 * Covers the most frequently used operators across the test suite.
 */
export function createDrizzleMock(): Record<string, unknown> {
	return {
		eq: vi.fn(),
		and: vi.fn(),
		or: vi.fn(),
		not: vi.fn(),
		inArray: vi.fn(),
		desc: vi.fn(),
		asc: vi.fn(),
		gte: vi.fn(),
		lte: vi.fn(),
		gt: vi.fn(),
		lt: vi.fn(),
		like: vi.fn(),
		ilike: vi.fn(),
		sql: vi.fn((template: any, ..._values: any[]) => template),
		exists: vi.fn(),
		isNull: vi.fn(),
		isNotNull: vi.fn(),
		between: vi.fn(),
	};
}

/**
 * Common logger mock for tests.
 */
export function createLoggerMock(): { logger: Record<string, unknown> } {
	return {
		logger: {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn(),
		},
	};
}

/**
 * Utility to reset all mock state between tests.
 * Call this in beforeEach() to ensure clean state.
 */
export function resetDbMockState(state: DbMockState): void {
	state.selectRows = [];
	state.updateQueue = [];
	state.insertCalls = [];
	state.updateCalls = [];
	state.deleteWhereCalled = false;
}
