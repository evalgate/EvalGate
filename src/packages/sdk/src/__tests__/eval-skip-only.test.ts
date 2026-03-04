/**
 * Tests for defineEval.skip / defineEval.only / getFilteredSpecs
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
	disposeActiveRuntime,
	getActiveRuntime,
} from "../runtime/registry";
import { defineEval, getFilteredSpecs } from "../runtime/eval";
import type { EvalSpec } from "../runtime/types";

const dummyExecutor = async () => ({
	pass: true,
	score: 100,
});

describe("defineEval.skip / defineEval.only", () => {
	beforeEach(() => {
		disposeActiveRuntime();
	});

	afterEach(() => {
		disposeActiveRuntime();
	});

	it("defineEval registers spec with mode 'normal' by default", () => {
		defineEval("normal spec", dummyExecutor);
		const specs = getActiveRuntime().list();
		expect(specs).toHaveLength(1);
		expect(specs[0].mode).toBe("normal");
	});

	it("defineEval.skip registers spec with mode 'skip'", () => {
		defineEval.skip("skipped spec", dummyExecutor);
		const specs = getActiveRuntime().list();
		expect(specs).toHaveLength(1);
		expect(specs[0].mode).toBe("skip");
		expect(specs[0].name).toBe("skipped spec");
	});

	it("defineEval.only registers spec with mode 'only'", () => {
		defineEval.only("focused spec", dummyExecutor);
		const specs = getActiveRuntime().list();
		expect(specs).toHaveLength(1);
		expect(specs[0].mode).toBe("only");
		expect(specs[0].name).toBe("focused spec");
	});
});

describe("getFilteredSpecs", () => {
	function makeSpec(name: string, mode: EvalSpec["mode"]): EvalSpec {
		return {
			id: name,
			name,
			filePath: "test.ts",
			position: { line: 1, column: 1 },
			executor: dummyExecutor,
			mode,
		};
	}

	it("returns all normal specs when no skip/only", () => {
		const specs = [makeSpec("a", "normal"), makeSpec("b", "normal")];
		expect(getFilteredSpecs(specs)).toHaveLength(2);
	});

	it("excludes skipped specs", () => {
		const specs = [
			makeSpec("a", "normal"),
			makeSpec("b", "skip"),
			makeSpec("c", "normal"),
		];
		const filtered = getFilteredSpecs(specs);
		expect(filtered).toHaveLength(2);
		expect(filtered.map((s) => s.name)).toEqual(["a", "c"]);
	});

	it("returns only 'only' specs when any exist", () => {
		const specs = [
			makeSpec("a", "normal"),
			makeSpec("b", "only"),
			makeSpec("c", "normal"),
			makeSpec("d", "only"),
		];
		const filtered = getFilteredSpecs(specs);
		expect(filtered).toHaveLength(2);
		expect(filtered.map((s) => s.name)).toEqual(["b", "d"]);
	});

	it("'only' takes precedence over 'skip'", () => {
		const specs = [
			makeSpec("a", "skip"),
			makeSpec("b", "only"),
			makeSpec("c", "normal"),
		];
		const filtered = getFilteredSpecs(specs);
		expect(filtered).toHaveLength(1);
		expect(filtered[0].name).toBe("b");
	});

	it("returns empty array when all specs are skipped", () => {
		const specs = [makeSpec("a", "skip"), makeSpec("b", "skip")];
		expect(getFilteredSpecs(specs)).toHaveLength(0);
	});

	it("handles empty input", () => {
		expect(getFilteredSpecs([])).toHaveLength(0);
	});

	it("treats undefined mode as normal (not skipped)", () => {
		const specs = [makeSpec("a", undefined)];
		expect(getFilteredSpecs(specs)).toHaveLength(1);
	});
});
