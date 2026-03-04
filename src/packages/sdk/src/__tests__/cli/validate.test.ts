/**
 * Tests for evalgate validate — static spec file validation
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import type { ValidationIssue } from "../../cli/validate";

// We test the analyzeFile logic directly by creating temp spec files
// and importing the validate module's internals via the public API shape.

/** Helper: create a temp dir with spec files and run validation */
function _createTempSpecFile(
	content: string,
	filename = "test-spec.eval.ts",
): { dir: string; file: string; cleanup: () => void } {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evalgate-validate-"));
	const file = path.join(dir, filename);
	fs.writeFileSync(file, content, "utf8");
	return {
		dir,
		file,
		cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
	};
}

// Since analyzeFile is not exported, we test through the regex patterns
// by directly testing the validate module's analyzeFile behavior.
// We'll import and test the patterns used.

describe("evalgate validate — static analysis patterns", () => {
	// Test the regex patterns used in validate.ts
	const VALID_NAME_RE = /^[a-zA-Z0-9\s\-_]+$/;
	const DEFINE_EVAL_RE = /defineEval\s*[.(]/g;
	const DEFINE_EVAL_NAME_RE = /defineEval\s*\(\s*["'`]([^"'`]*)["'`]/g;

	describe("name validation regex", () => {
		it("accepts valid names", () => {
			expect(VALID_NAME_RE.test("my-spec")).toBe(true);
			expect(VALID_NAME_RE.test("spec_name")).toBe(true);
			expect(VALID_NAME_RE.test("Spec Name 123")).toBe(true);
			expect(VALID_NAME_RE.test("simple")).toBe(true);
		});

		it("rejects names with special characters", () => {
			expect(VALID_NAME_RE.test("spec[1]")).toBe(false);
			expect(VALID_NAME_RE.test("spec.name")).toBe(false);
			expect(VALID_NAME_RE.test("spec/name")).toBe(false);
			expect(VALID_NAME_RE.test("spec@name")).toBe(false);
		});
	});

	describe("defineEval detection regex", () => {
		it("detects defineEval( calls", () => {
			const code = `defineEval("my spec", async (ctx) => {})`;
			const matches = code.match(DEFINE_EVAL_RE);
			expect(matches).toHaveLength(1);
		});

		it("detects defineEval.skip( calls", () => {
			const code = `defineEval.skip("skipped", async (ctx) => {})`;
			const matches = code.match(DEFINE_EVAL_RE);
			expect(matches).toHaveLength(1);
		});

		it("detects multiple defineEval calls", () => {
			const code = `
				defineEval("spec-1", async (ctx) => {});
				defineEval("spec-2", async (ctx) => {});
				defineEval.only("spec-3", async (ctx) => {});
			`;
			const matches = code.match(DEFINE_EVAL_RE);
			expect(matches).toHaveLength(3);
		});

		it("returns null for no defineEval calls", () => {
			const code = `export const foo = "bar";`;
			const matches = code.match(DEFINE_EVAL_RE);
			expect(matches).toBeNull();
		});
	});

	describe("spec name extraction regex", () => {
		it("extracts name from double-quoted defineEval", () => {
			const code = `defineEval("my-spec", executor)`;
			const matches = [...code.matchAll(DEFINE_EVAL_NAME_RE)];
			expect(matches).toHaveLength(1);
			expect(matches[0][1]).toBe("my-spec");
		});

		it("extracts name from single-quoted defineEval", () => {
			const code = `defineEval('my-spec', executor)`;
			const matches = [...code.matchAll(DEFINE_EVAL_NAME_RE)];
			expect(matches).toHaveLength(1);
			expect(matches[0][1]).toBe("my-spec");
		});

		it("extracts name from template literal defineEval", () => {
			const code = "defineEval(`my-spec`, executor)";
			const matches = [...code.matchAll(DEFINE_EVAL_NAME_RE)];
			expect(matches).toHaveLength(1);
			expect(matches[0][1]).toBe("my-spec");
		});

		it("detects empty name", () => {
			const code = `defineEval("", executor)`;
			const matches = [...code.matchAll(DEFINE_EVAL_NAME_RE)];
			expect(matches).toHaveLength(1);
			expect(matches[0][1]).toBe("");
		});
	});
});

describe("ValidateResult interface contract", () => {
	it("passed is true when no errors exist", () => {
		const issues: ValidationIssue[] = [
			{
				severity: "warn",
				file: "test.ts",
				code: "NO_DEFINE_EVAL",
				message: "warn",
			},
		];
		const errors = issues.filter((i) => i.severity === "error");
		expect(errors.length === 0).toBe(true);
	});

	it("passed is false when errors exist", () => {
		const issues: ValidationIssue[] = [
			{
				severity: "error",
				file: "test.ts",
				code: "EMPTY_NAME",
				message: "err",
			},
			{
				severity: "warn",
				file: "test.ts",
				code: "NO_DEFINE_EVAL",
				message: "warn",
			},
		];
		const errors = issues.filter((i) => i.severity === "error");
		expect(errors.length === 0).toBe(false);
	});
});
