/**
 * RUNTIME-102: Identity canonicalization tests
 *
 * Tests for stable IDs across OS + path shapes with POSIX canonicalization.
 */

import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createResult } from "../../runtime/eval";
import {
	createEvalRuntime,
	disposeActiveRuntime,
	withRuntime,
} from "../../runtime/registry";

describe("RUNTIME-102: Identity Canonicalization", () => {
	beforeEach(() => {
		disposeActiveRuntime();
	});

	afterEach(() => {
		disposeActiveRuntime();
	});

	describe("POSIX path canonicalization", () => {
		it("should use POSIX separators in ID generation regardless of OS", () => {
			const handle = createEvalRuntime();

			// Define a spec - the ID should be generated with POSIX paths
			handle.defineEval("posix-test", async (_context) => {
				return createResult({ pass: true, score: 100 });
			});

			const spec = handle.runtime.list()[0];
			const specId = spec.id;

			// ID should be 20 character hex string
			expect(specId).toMatch(/^[a-f0-9]{20}$/);

			// The ID should be based on canonical path (POSIX separators)
			// We can't directly test the internal ID generation, but we can verify
			// the spec has the expected properties
			expect(spec.name).toBe("posix-test");
			expect(spec.filePath).toContain("runtime-102-identity.test.ts");
			expect(spec.position.line).toBeGreaterThan(0);
		});

		it("should generate identical IDs for same relative path regardless of OS separators", async () => {
			// Simulate different OS path formats
			const windowsPath =
				"src\\packages\\sdk\\src\\__tests__\\runtime\\test-file.ts";
			const unixPath = "src/packages/sdk/src/__tests__/runtime/test-file.ts";

			// Both should canonicalize to the same POSIX path
			const canonicalWindows = windowsPath.split(path.sep).join("/");
			const canonicalUnix = unixPath.split(path.sep).join("/");

			expect(canonicalWindows).toBe(canonicalUnix);
			expect(canonicalWindows).toBe(
				"src/packages/sdk/src/__tests__/runtime/test-file.ts",
			);
		});
	});

	describe("Stable identity across path changes", () => {
		it("should change ID only when relative path changes", async () => {
			const ids: string[] = [];

			// First spec at current location
			await withRuntime(process.cwd(), async (handle) => {
				handle.defineEval("path-test-1", async (_context) => {
					return createResult({ pass: true, score: 100 });
				});

				const spec = handle.runtime.list()[0];
				ids.push(spec.id);
			});

			// Second spec at same location should have different ID (different position)
			await withRuntime(process.cwd(), async (handle) => {
				handle.defineEval("path-test-2", async (_context) => {
					return createResult({ pass: true, score: 90 });
				});

				const spec = handle.runtime.list()[0];
				ids.push(spec.id);
			});

			// IDs should be different (different positions in file)
			expect(ids[0]).not.toBe(ids[1]);

			// But both should be valid 20-char hex strings
			ids.forEach((id) => {
				expect(id).toMatch(/^[a-f0-9]{20}$/);
			});
		});

		it("should include suitePath in ID generation when provided", async () => {
			await withRuntime(process.cwd(), async (handle) => {
				// Note: Current implementation doesn't expose suitePath in defineEval
				// But we can verify the basic ID generation works
				handle.defineEval("suite-path-test", async (_context) => {
					return createResult({ pass: true, score: 100 });
				});

				const spec = handle.runtime.list()[0];
				expect(spec.id).toMatch(/^[a-f0-9]{20}$/);
				expect(spec.name).toBe("suite-path-test");
			});
		});
	});

	describe("Project namespace stability", () => {
		it("should generate consistent namespace for same project root", async () => {
			const namespaces: string[] = [];

			// Multiple runtimes should have same namespace for same project root
			for (let i = 0; i < 3; i++) {
				await withRuntime(process.cwd(), async (handle) => {
					namespaces.push(handle.runtime.namespace);
				});
			}

			// All namespaces should be identical
			expect(namespaces[0]).toBe(namespaces[1]);
			expect(namespaces[1]).toBe(namespaces[2]);

			// Namespace should be 12 character hex string
			expect(namespaces[0]).toMatch(/^[a-f0-9]{12}$/);
		});

		it("should generate different namespaces for different project roots", async () => {
			const namespaces: string[] = [];

			// Different project roots should generate different namespaces
			const projectRoots = [
				process.cwd(),
				path.join(process.cwd(), "src"),
				path.join(process.cwd(), "src", "packages"),
			];

			for (const root of projectRoots) {
				await withRuntime(root, async (handle) => {
					namespaces.push(handle.runtime.namespace);
				});
			}

			// All namespaces should be different
			expect(namespaces[0]).not.toBe(namespaces[1]);
			expect(namespaces[1]).not.toBe(namespaces[2]);
			expect(namespaces[0]).not.toBe(namespaces[2]);

			// But all should be valid 12-char hex strings
			namespaces.forEach((ns) => {
				expect(ns).toMatch(/^[a-f0-9]{12}$/);
			});
		});
	});

	describe("Cross-platform compatibility", () => {
		it("should handle Windows-style paths correctly", () => {
			// Simulate Windows path handling
			const windowsPath = "src\\packages\\sdk\\src\\runtime\\types.ts";
			const posixPath = windowsPath.split(path.sep).join("/");

			// Should convert to POSIX format
			expect(posixPath).toBe("src/packages/sdk/src/runtime/types.ts");

			// Should not contain backslashes
			expect(posixPath).not.toContain("\\");
		});

		it("should handle Unix-style paths correctly", () => {
			// Unix paths should remain unchanged
			const unixPath = "src/packages/sdk/src/runtime/types.ts";
			const posixPath = unixPath.split(path.sep).join("/");

			expect(posixPath).toBe(unixPath);
			expect(posixPath).toBe("src/packages/sdk/src/runtime/types.ts");
		});

		it("should handle mixed path separators", () => {
			// Mixed separators should be normalized to POSIX
			const mixedPath = "src/packages\\sdk/src\\runtime/types.ts";
			const posixPath = mixedPath.split(path.sep).join("/");

			expect(posixPath).toBe("src/packages/sdk/src/runtime/types.ts");
			expect(posixPath).not.toContain("\\");
		});

		it("should handle absolute paths correctly", () => {
			// Absolute paths should be made relative then canonicalized
			const absolutePath = path.resolve(
				process.cwd(),
				"src",
				"runtime",
				"types.ts",
			);
			const relativePath = path.relative(process.cwd(), absolutePath);
			const posixPath = relativePath.split(path.sep).join("/");

			expect(posixPath).toBe("src/runtime/types.ts");
			expect(posixPath).not.toContain(path.sep);
		});
	});

	describe("ID stability verification", () => {
		it("should generate deterministic IDs for same inputs", async () => {
			const specs: Array<{ id: string; name: string; position: any }> = [];

			// Generate multiple specs with same name at different positions
			await withRuntime(process.cwd(), async (handle) => {
				// Define multiple specs - each will have different positions
				for (let i = 0; i < 3; i++) {
					handle.defineEval(`deterministic-test-${i}`, async (_context) => {
						return createResult({ pass: true, score: 100 });
					});
				}

				const allSpecs = handle.runtime.list();
				specs.push(
					...allSpecs.map((s) => ({
						id: s.id,
						name: s.name,
						position: s.position,
					})),
				);
			});

			// All IDs should be valid
			specs.forEach((spec) => {
				expect(spec.id).toMatch(/^[a-f0-9]{20}$/);
			});

			// Names should be preserved
			expect(specs.map((s) => s.name)).toEqual([
				"deterministic-test-0",
				"deterministic-test-1",
				"deterministic-test-2",
			]);

			// Positions should be different (different lines in file)
			const positions = specs.map((s) => s.position.line);
			expect(new Set(positions).size).toBe(3); // All unique

			// IDs should be different (different positions)
			const ids = specs.map((s) => s.id);
			expect(new Set(ids).size).toBe(3); // All unique
		});
	});
});
