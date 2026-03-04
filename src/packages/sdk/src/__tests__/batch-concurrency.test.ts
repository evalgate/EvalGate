import { describe, expect, it } from "vitest";
import { batchProcess } from "../batch";

/**
 * Regression tests for batchProcess() concurrency limit.
 *
 * Before the fix, batchProcess() removed the most-recently-added promise
 * from the executing array after Promise.race(), instead of the one that
 * actually settled. This caused the concurrency limit to be ignored for
 * limits > 1.
 */
describe("batchProcess concurrency", () => {
	/**
	 * Helper: creates a processor that tracks concurrent execution.
	 * Each task takes `taskDurationMs` to complete.
	 * Returns { processor, getMaxConcurrent } so the test can assert.
	 */
	function createConcurrencyTracker(taskDurationMs: number = 50) {
		let running = 0;
		let maxConcurrent = 0;

		const processor = async (item: number): Promise<number> => {
			running++;
			if (running > maxConcurrent) {
				maxConcurrent = running;
			}
			await new Promise((resolve) => setTimeout(resolve, taskDurationMs));
			running--;
			return item * 2;
		};

		return {
			processor,
			getMaxConcurrent: () => maxConcurrent,
		};
	}

	it("should never exceed concurrency=1", async () => {
		const { processor, getMaxConcurrent } = createConcurrencyTracker(20);
		const items = [1, 2, 3, 4, 5];

		const results = await batchProcess(items, processor, 1);

		expect(getMaxConcurrent()).toBe(1);
		expect(results).toHaveLength(5);
	});

	it("should never exceed concurrency=2", async () => {
		const { processor, getMaxConcurrent } = createConcurrencyTracker(30);
		const items = [1, 2, 3, 4, 5, 6];

		const results = await batchProcess(items, processor, 2);

		expect(getMaxConcurrent()).toBeLessThanOrEqual(2);
		expect(results).toHaveLength(6);
	});

	it("should never exceed concurrency=3", async () => {
		const { processor, getMaxConcurrent } = createConcurrencyTracker(30);
		const items = [1, 2, 3, 4, 5, 6, 7, 8];

		const results = await batchProcess(items, processor, 3);

		expect(getMaxConcurrent()).toBeLessThanOrEqual(3);
		expect(results).toHaveLength(8);
	});

	it("should process all items and return all results", async () => {
		const items = [1, 2, 3, 4, 5];
		const processor = async (n: number) => {
			await new Promise((r) => setTimeout(r, 10));
			return n * 10;
		};

		const results = await batchProcess(items, processor, 2);

		expect(results.sort((a, b) => a - b)).toEqual([10, 20, 30, 40, 50]);
	});

	it("should handle concurrency >= items.length gracefully", async () => {
		const { processor, getMaxConcurrent } = createConcurrencyTracker(10);
		const items = [1, 2, 3];

		const results = await batchProcess(items, processor, 10);

		expect(getMaxConcurrent()).toBeLessThanOrEqual(3);
		expect(results).toHaveLength(3);
	});

	it("should handle errors without breaking concurrency tracking", async () => {
		let running = 0;
		let maxConcurrent = 0;

		const processor = async (n: number) => {
			running++;
			if (running > maxConcurrent) maxConcurrent = running;
			await new Promise((r) => setTimeout(r, 20));
			running--;
			if (n === 3) throw new Error("boom");
			return n;
		};

		await expect(batchProcess([1, 2, 3, 4, 5], processor, 2)).rejects.toThrow(
			"boom",
		);
		expect(maxConcurrent).toBeLessThanOrEqual(2);
	});
});
