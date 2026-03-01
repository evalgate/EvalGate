#!/usr/bin/env npx tsx
/**
 * Pre-release validation — run before tagging a release.
 * Usage: npx tsx scripts/release-preflight.ts 2.0.0
 */
import { readFileSync } from "node:fs";

function main(): number {
	const version = process.argv[2];
	if (!version) {
		console.error("Usage: npx tsx scripts/release-preflight.ts X.Y.Z");
		return 1;
	}

	let failures = 0;

	function check(label: string, fn: () => boolean) {
		if (fn()) {
			console.log(`  ✓ ${label}`);
		} else {
			console.error(`  ✗ ${label}`);
			failures++;
		}
	}

	console.log(`\nRelease preflight for v${version}\n`);

	// 1. package.json
	const pkg = JSON.parse(
		readFileSync("src/packages/sdk/package.json", "utf-8"),
	);
	check("SDK package.json version matches", () => pkg.version === version);

	// 2. version.ts
	const versionTs = readFileSync("src/packages/sdk/src/version.ts", "utf-8");
	check("version.ts SDK_VERSION matches", () =>
		versionTs.includes(`"${version}"`),
	);

	// 3. manifest.ts re-exports (no hardcoded version)
	const manifest = readFileSync(
		"src/packages/sdk/src/cli/manifest.ts",
		"utf-8",
	);
	check("manifest.ts imports from version.ts", () =>
		/from\s+["']\.\.\/version["']/.test(manifest),
	);
	check(
		"manifest.ts has no hardcoded SDK_VERSION",
		() => !/SDK_VERSION\s*=\s*"/.test(manifest),
	);

	// 4. SDK CHANGELOG
	const sdkChangelog = readFileSync("src/packages/sdk/CHANGELOG.md", "utf-8");
	check("SDK CHANGELOG.md has entry", () =>
		sdkChangelog.includes(`[${version}]`),
	);

	// 5. Root CHANGELOG
	const rootChangelog = readFileSync("CHANGELOG.md", "utf-8");
	check("Root CHANGELOG.md has entry", () =>
		rootChangelog.includes(`[${version}]`),
	);

	// 6. docs/stability.md
	const stability = readFileSync("docs/stability.md", "utf-8");
	check("docs/stability.md references version", () =>
		stability.includes(`v${version}`),
	);

	// 7. publishConfig exists
	check(
		"SDK publishConfig.access is public",
		() => pkg.publishConfig?.access === "public",
	);

	console.log("");
	if (failures > 0) {
		console.error(`${failures} check(s) failed. Fix before tagging.`);
		return 1;
	}
	console.log("All preflight checks passed. Safe to tag and release.");
	return 0;
}

process.exit(main());
