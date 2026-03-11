import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
	AUTO_HOLDOUT_SCHEMA_VERSION,
	type AutoHoldoutArtifact,
	assertValidAutoHoldoutArtifact,
	createAutoHoldoutArtifact,
	loadOrCreateAutoHoldout,
	parseAutoHoldoutConfig,
	readAutoHoldoutArtifact,
	selectAutoHoldoutSpecs,
	writeAutoHoldoutArtifact,
} from "../../cli/auto-holdout";
import type { EvaluationManifest, Spec } from "../../cli/manifest";

function makeTempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "evalgate-auto-holdout-"));
}

function buildSpec(
	id: string,
	suite: string,
	filePath = `tests/${suite}.test.ts`,
): Spec {
	return {
		id,
		name: id,
		suitePath: [suite],
		filePath,
		position: { line: 1, column: 1 },
		tags: [suite],
		dependsOn: {
			prompts: [],
			datasets: [],
			tools: [],
			code: [],
		},
	};
}

function buildManifest(specs: Spec[]): EvaluationManifest {
	return {
		schemaVersion: 1,
		generatedAt: 1735787045,
		project: {
			name: "sdk",
			root: ".",
			namespace: "abcd1234",
		},
		runtime: {
			mode: "spec",
			sdkVersion: "test",
		},
		specFiles: [],
		specs,
	};
}

describe("parseAutoHoldoutConfig", () => {
	it("applies defaults when optional fields are omitted", () => {
		const config = parseAutoHoldoutConfig({});

		expect(config).toEqual({
			selection: "deterministic",
			lockedAfter: null,
			count: null,
			ratio: null,
			seed: "evalgate-auto-holdout-v1",
			excludedSpecIds: [],
		});
	});

	it("parses explicit holdout settings", () => {
		const config = parseAutoHoldoutConfig({
			selection: "stratified",
			locked_after: 2,
			count: 3,
			ratio: 0.25,
			seed: "custom-seed",
			excluded_spec_ids: ["spec-b", "spec-a", "spec-a"],
		});

		expect(config.selection).toBe("stratified");
		expect(config.lockedAfter).toBe(2);
		expect(config.count).toBe(3);
		expect(config.ratio).toBe(0.25);
		expect(config.seed).toBe("custom-seed");
		expect(config.excludedSpecIds).toEqual(["spec-a", "spec-b"]);
	});

	it("rejects invalid ratios", () => {
		expect(() => parseAutoHoldoutConfig({ ratio: 1 })).toThrow(
			"holdout.ratio must be a number between 0 and 1 when provided",
		);
	});
});

describe("selectAutoHoldoutSpecs", () => {
	it("selects a deterministic holdout and respects exclusions", () => {
		const manifest = buildManifest([
			buildSpec("spec-a", "safety"),
			buildSpec("spec-b", "safety"),
			buildSpec("spec-c", "accuracy"),
			buildSpec("spec-d", "agents"),
		]);
		const config = parseAutoHoldoutConfig({
			count: 2,
			seed: "deterministic-seed",
			excluded_spec_ids: ["spec-b"],
		});

		const first = selectAutoHoldoutSpecs(manifest, config);
		const second = selectAutoHoldoutSpecs(manifest, config);

		expect(first.specIds).toHaveLength(2);
		expect(first.specIds).not.toContain("spec-b");
		expect(first.specIds).toEqual(second.specIds);
		expect(first.selectionUsed).toBe("deterministic");
	});

	it("stratifies selection across suites when multiple strata exist", () => {
		const manifest = buildManifest([
			buildSpec("safe-1", "safety"),
			buildSpec("safe-2", "safety"),
			buildSpec("acc-1", "accuracy"),
			buildSpec("acc-2", "accuracy"),
			buildSpec("agent-1", "agents"),
			buildSpec("agent-2", "agents"),
		]);
		const config = parseAutoHoldoutConfig({
			selection: "stratified",
			count: 3,
			seed: "stratified-seed",
		});

		const selection = selectAutoHoldoutSpecs(manifest, config);

		expect(selection.selectionUsed).toBe("stratified");
		expect(selection.specIds).toHaveLength(3);
		expect(Object.keys(selection.strata).sort()).toEqual([
			"accuracy",
			"agents",
			"safety",
		]);
		expect(
			Object.values(selection.strata).reduce((sum, value) => sum + value, 0),
		).toBe(3);
	});

	it("falls back to deterministic selection when stratification is not possible", () => {
		const manifest = buildManifest([
			buildSpec("spec-a", "general"),
			buildSpec("spec-b", "general"),
			buildSpec("spec-c", "general"),
		]);
		const config = parseAutoHoldoutConfig({
			selection: "stratified",
			count: 1,
			seed: "fallback-seed",
		});

		const selection = selectAutoHoldoutSpecs(manifest, config);

		expect(selection.selectionUsed).toBe("deterministic");
		expect(selection.strata).toEqual({});
		expect(selection.specIds).toHaveLength(1);
	});
});

describe("holdout artifacts", () => {
	it("creates artifacts with the current schema version", () => {
		const manifest = buildManifest([
			buildSpec("spec-a", "safety"),
			buildSpec("spec-b", "accuracy"),
		]);
		const artifact = createAutoHoldoutArtifact(
			manifest,
			parseAutoHoldoutConfig({ count: 1, seed: "artifact-seed" }),
		);

		expect(artifact.schemaVersion).toBe(AUTO_HOLDOUT_SCHEMA_VERSION);
		assertValidAutoHoldoutArtifact(artifact);
	});

	it("writes and reads locked holdout artifacts", () => {
		const projectRoot = makeTempDir();
		try {
			const holdoutPath = path.join(
				projectRoot,
				".evalgate",
				"auto",
				"holdout.json",
			);
			const artifact: AutoHoldoutArtifact = {
				schemaVersion: AUTO_HOLDOUT_SCHEMA_VERSION,
				createdAt: "2025-01-02T03:04:05.000Z",
				selectionRequested: "deterministic",
				selectionUsed: "deterministic",
				lockedAfter: 2,
				seed: "artifact-seed",
				manifestGeneratedAt: 1735787045,
				manifestSpecCount: 4,
				excludedSpecIds: ["spec-z"],
				specIds: ["spec-a", "spec-c"],
				strata: { safety: 1, accuracy: 1 },
			};

			writeAutoHoldoutArtifact(artifact, holdoutPath);
			const readBack = readAutoHoldoutArtifact(holdoutPath);

			expect(readBack).toEqual(artifact);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("reuses an existing locked holdout artifact instead of regenerating it", () => {
		const projectRoot = makeTempDir();
		try {
			const holdoutPath = path.join(
				projectRoot,
				".evalgate",
				"auto",
				"holdout.json",
			);
			const firstManifest = buildManifest([
				buildSpec("spec-a", "safety"),
				buildSpec("spec-b", "accuracy"),
				buildSpec("spec-c", "agents"),
			]);
			const first = loadOrCreateAutoHoldout(
				firstManifest,
				parseAutoHoldoutConfig({ count: 1, seed: "lock-seed" }),
				holdoutPath,
			);

			const secondManifest = buildManifest([
				buildSpec("spec-x", "safety"),
				buildSpec("spec-y", "accuracy"),
				buildSpec("spec-z", "agents"),
			]);
			const second = loadOrCreateAutoHoldout(
				secondManifest,
				parseAutoHoldoutConfig({ count: 2, seed: "different-seed" }),
				holdoutPath,
			);

			expect(second).toEqual(first);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("rejects malformed artifacts on read", () => {
		const projectRoot = makeTempDir();
		try {
			const holdoutPath = path.join(
				projectRoot,
				".evalgate",
				"auto",
				"holdout.json",
			);
			fs.mkdirSync(path.dirname(holdoutPath), { recursive: true });
			fs.writeFileSync(
				holdoutPath,
				JSON.stringify({
					schemaVersion: 999,
					createdAt: "2025-01-02T03:04:05.000Z",
				}),
				"utf8",
			);

			expect(() => readAutoHoldoutArtifact(holdoutPath)).toThrow(
				`holdout.schemaVersion must equal ${AUTO_HOLDOUT_SCHEMA_VERSION}`,
			);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});
});
