import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SDK_VERSION as MANIFEST_SDK_VERSION } from "@/packages/sdk/src/cli/manifest";
import { SDK_VERSION } from "@/packages/sdk/src/version";

describe("SDK version sync", () => {
	it("SDK_VERSION in manifest.ts matches version.ts", () => {
		expect(MANIFEST_SDK_VERSION).toBe(SDK_VERSION);
	});

	it("manifest.ts re-exports from version.ts and does not define its own version constant", () => {
		const manifestPath = path.resolve(
			__dirname,
			"../../packages/sdk/src/cli/manifest.ts",
		);
		const source = readFileSync(manifestPath, "utf-8");

		const definesOwnVersion =
			/(?:const|let|var)\s+SDK_VERSION\s*=\s*["'`]/.test(source);
		expect(definesOwnVersion).toBe(false);

		expect(source).toContain("import");
		expect(source).toContain("SDK_VERSION");
		expect(source).toMatch(
			/import\s.*SDK_VERSION.*from\s+["']\.\.\/version["']/,
		);
	});
});
