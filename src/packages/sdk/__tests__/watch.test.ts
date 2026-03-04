/**
 * Tests for watch mode (unit-testable parts)
 */

import { describe, expect, it } from "vitest";
import type { WatchOptions } from "../src/cli/watch";

describe("Watch Options", () => {
	it("should accept default options", () => {
		const options: WatchOptions = {};
		expect(options.debounceMs).toBeUndefined();
		expect(options.clearScreen).toBeUndefined();
	});

	it("should accept custom debounce", () => {
		const options: WatchOptions = { debounceMs: 500 };
		expect(options.debounceMs).toBe(500);
	});

	it("should accept clearScreen flag", () => {
		const options: WatchOptions = { clearScreen: false };
		expect(options.clearScreen).toBe(false);
	});

	it("should accept extra watch dirs", () => {
		const options: WatchOptions = {
			extraWatchDirs: ["lib", "datasets"],
		};
		expect(options.extraWatchDirs).toHaveLength(2);
	});

	it("should extend RunOptions", () => {
		const options: WatchOptions = {
			specIds: ["spec1"],
			format: "json",
			writeResults: true,
			debounceMs: 300,
		};
		expect(options.specIds).toEqual(["spec1"]);
		expect(options.format).toBe("json");
	});
});
