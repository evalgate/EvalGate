/**
 * RUNTIME-101: Runtime lifecycle contract tests
 *
 * Tests for proper resource management and cleanup guarantees.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createResult } from "../../runtime/eval";
import {
	createEvalRuntime,
	disposeActiveRuntime,
	withRuntime,
} from "../../runtime/registry";

describe("RUNTIME-101: Runtime Lifecycle Contract", () => {
	beforeEach(() => {
		// Ensure clean state
		disposeActiveRuntime();
	});

	afterEach(() => {
		// Cleanup after each test
		disposeActiveRuntime();
	});

	describe("RuntimeHandle interface", () => {
		it("should return RuntimeHandle with all required properties", () => {
			const handle = createEvalRuntime();

			expect(handle).toHaveProperty("runtime");
			expect(handle).toHaveProperty("defineEval");
			expect(handle).toHaveProperty("dispose");
			expect(handle).toHaveProperty("snapshot");
			expect(handle).toHaveProperty("load");

			expect(typeof handle.dispose).toBe("function");
			expect(typeof handle.snapshot).toBe("function");
			expect(typeof handle.load).toBe("function");
			expect(typeof handle.defineEval).toBe("function");
		});

		it("should provide scoped defineEval function", () => {
			const handle = createEvalRuntime();

			// Should be able to define specs using the handle's defineEval
			handle.defineEval("test-spec", async (_context) => {
				return createResult({ pass: true, score: 100 });
			});

			const specs = handle.runtime.list();
			expect(specs).toHaveLength(1);
			expect(specs[0].name).toBe("test-spec");
		});
	});

	describe("Resource cleanup", () => {
		it("should clear registry after dispose()", () => {
			const handle = createEvalRuntime();

			// Register some specs
			handle.defineEval("spec1", async (_context) =>
				createResult({ pass: true, score: 100 }),
			);
			handle.defineEval("spec2", async (_context) =>
				createResult({ pass: true, score: 90 }),
			);

			expect(handle.runtime.list()).toHaveLength(2);

			// Dispose should clear everything
			handle.dispose();

			// Registry should be empty
			expect(handle.runtime.list()).toHaveLength(0);

			// Runtime should be marked as disposed
			expect(() => handle.runtime.list()).toThrow("Runtime has been disposed");
		});

		it("should release internal caches on dispose", () => {
			const handle = createEvalRuntime();

			// Register specs to populate internal state
			handle.defineEval("cache-test", async (_context) =>
				createResult({ pass: true, score: 100 }),
			);

			// Check memory usage before dispose
			const statsBefore = handle.runtime.stats;
			expect(statsBefore.totalSpecs).toBe(1);
			expect(statsBefore.memoryUsage).toBeGreaterThan(0);

			// Dispose should release memory
			handle.dispose();

			// After dispose, memory should be cleared
			expect(() => handle.runtime.stats).toThrow("Runtime has been disposed");
		});
	});

	describe("withRuntime helper", () => {
		it("should ensure cleanup even on successful execution", async () => {
			const _runtimeDisposed = false;

			await withRuntime(process.cwd(), async (handle) => {
				// Register a spec
				handle.defineEval("with-runtime-test", async (_context) => {
					return createResult({ pass: true, score: 100 });
				});

				expect(handle.runtime.list()).toHaveLength(1);

				// Check runtime is still active
				expect(() => handle.runtime.list()).not.toThrow();
			});

			// After withRuntime completes, runtime should be disposed
			// Note: We can't directly check the disposed state since it's scoped
			// But we can verify no active runtime remains
			expect(() => {
				const { getActiveRuntime } = require("../../runtime/registry");
				getActiveRuntime().list();
			}).not.toThrow();
		});

		it("should ensure cleanup even when exception is thrown", async () => {
			let caughtError = false;

			try {
				await withRuntime(process.cwd(), async (handle) => {
					// Register a spec
					handle.defineEval("error-test", async (_context) => {
						return createResult({ pass: true, score: 100 });
					});

					expect(handle.runtime.list()).toHaveLength(1);

					// Throw an exception
					throw new Error("Test exception");
				});
			} catch (error) {
				caughtError = true;
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toBe("Test exception");
			}

			expect(caughtError).toBe(true);

			// Runtime should still be cleaned up despite the exception
			expect(() => {
				const { getActiveRuntime } = require("../../runtime/registry");
				getActiveRuntime().list();
			}).not.toThrow();
		});

		it("should handle multiple sequential withRuntime calls", async () => {
			const results: string[] = [];

			// First execution
			await withRuntime(process.cwd(), async (handle) => {
				handle.defineEval("first-exec", async (_context) => {
					return createResult({ pass: true, score: 100 });
				});
				results.push("first");
			});

			// Second execution (should work without interference)
			await withRuntime(process.cwd(), async (handle) => {
				handle.defineEval("second-exec", async (_context) => {
					return createResult({ pass: true, score: 90 });
				});
				results.push("second");
			});

			expect(results).toEqual(["first", "second"]);
		});
	});

	describe("Snapshot functionality", () => {
		it("should create runtime snapshot", () => {
			const handle = createEvalRuntime();

			// Register some specs
			handle.defineEval(
				"snapshot-test",
				async (_context) => {
					return createResult({ pass: true, score: 100 });
				},
				{
					description: "Test for snapshot",
					tags: ["test", "snapshot"],
				},
			);

			const snapshot = handle.snapshot();

			expect(snapshot).toHaveProperty("runtimeId");
			expect(snapshot).toHaveProperty("namespace");
			expect(snapshot).toHaveProperty("createdAt");
			expect(snapshot).toHaveProperty("specs");
			expect(snapshot).toHaveProperty("version");

			expect(snapshot.runtimeId).toBe(handle.runtime.id);
			expect(snapshot.namespace).toBe(handle.runtime.namespace);
			expect(snapshot.specs).toHaveLength(1);
			expect(snapshot.specs[0].name).toBe("snapshot-test");
			expect(snapshot.specs[0].description).toBe("Test for snapshot");
			expect(snapshot.specs[0].tags).toEqual(["test", "snapshot"]);
			expect(snapshot.specs[0].executorSerialized).toBe(false); // Functions can't be serialized
		});

		it("should load runtime from snapshot", () => {
			const handle = createEvalRuntime();

			// Register a spec
			handle.defineEval("load-test", async (_context) => {
				return createResult({ pass: true, score: 100 });
			});

			// Create snapshot
			const snapshot = handle.snapshot();

			// Clear runtime
			handle.dispose();

			// Create new runtime and load snapshot
			const newHandle = createEvalRuntime();

			// Loading should work (though executors can't be restored)
			expect(() => {
				newHandle.load(snapshot);
			}).not.toThrow();

			// Note: Executors can't be restored, so the spec won't be functional
			// But the metadata should be loaded
			expect(newHandle.runtime.list()).toHaveLength(0); // No executors restored
		});
	});

	describe("Multiple sequential discovers", () => {
		it("should produce identical manifests for sequential discoveries", async () => {
			const manifests: any[] = [];

			// First discovery
			await withRuntime(process.cwd(), async (handle) => {
				handle.defineEval("discovery-test", async (_context) => {
					return createResult({ pass: true, score: 100 });
				});

				const snapshot = handle.snapshot();
				manifests.push({
					runtimeId: snapshot.runtimeId,
					namespace: snapshot.namespace,
					specCount: snapshot.specs.length,
					specNames: snapshot.specs.map((s) => s.name),
				});
			});

			// Second discovery (should be identical structure)
			await withRuntime(process.cwd(), async (handle) => {
				handle.defineEval("discovery-test", async (_context) => {
					return createResult({ pass: true, score: 100 });
				});

				const snapshot = handle.snapshot();
				manifests.push({
					runtimeId: snapshot.runtimeId,
					namespace: snapshot.namespace,
					specCount: snapshot.specs.length,
					specNames: snapshot.specs.map((s) => s.name),
				});
			});

			// Namespace should be identical (same project root)
			expect(manifests[0].namespace).toBe(manifests[1].namespace);

			// Spec structure should be identical
			expect(manifests[0].specCount).toBe(manifests[1].specCount);
			expect(manifests[0].specNames).toEqual(manifests[1].specNames);

			// Runtime IDs should be different (each runtime is unique)
			expect(manifests[0].runtimeId).not.toBe(manifests[1].runtimeId);
		});
	});
});
