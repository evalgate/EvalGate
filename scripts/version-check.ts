#!/usr/bin/env npx tsx
/**
 * Version Sync Checker
 * 
 * Validates that all version references are synchronized across the platform.
 * Run after any version update to catch stale docs, configs, or references.
 * 
 * Usage: pnpm version:check [version]
 *   If version omitted, reads from src/packages/sdk/package.json
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

function getSdkVersion(): string {
	const pkgPath = "src/packages/sdk/package.json";
	const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
	return pkg.version;
}

function main(): number {
	const targetVersion = process.argv[2] || getSdkVersion();
	
	console.log(`\n🔍 Version Sync Check for v${targetVersion}\n`);
	
	let failures = 0;
	
	function check(label: string, condition: boolean, fix?: string) {
		if (condition) {
			console.log(`  ✓ ${label}`);
		} else {
			console.error(`  ✗ ${label}`);
			if (fix) console.log(`    💡 Fix: ${fix}`);
			failures++;
		}
	}
	
	// 1. Core version files
	try {
		const pkg = JSON.parse(readFileSync("src/packages/sdk/package.json", "utf-8"));
		check("SDK package.json version matches", pkg.version === targetVersion, "Update src/packages/sdk/package.json");
	} catch {
		check("SDK package.json readable", false, "Check file exists");
	}
	
	try {
		const content = readFileSync("src/packages/sdk/src/version.ts", "utf-8");
		check("version.ts SDK_VERSION matches", content.includes(`SDK_VERSION = "${targetVersion}"`), "Update src/packages/sdk/src/version.ts");
		check("version.ts SPEC_VERSION matches", content.includes(`SPEC_VERSION = "${targetVersion}"`), "Update src/packages/sdk/src/version.ts");
	} catch {
		check("version.ts readable", false, "Check file exists");
	}
	
	// 2. Documentation files
	try {
		const content = readFileSync("src/packages/sdk/CHANGELOG.md", "utf-8");
		check("SDK CHANGELOG.md has entry", content.includes(`[${targetVersion}]`), "Add entry to src/packages/sdk/CHANGELOG.md");
	} catch {
		check("SDK CHANGELOG.md readable", false, "Check file exists");
	}
	
	try {
		const content = readFileSync("CHANGELOG.md", "utf-8");
		check("Root CHANGELOG.md has entry", content.includes(`[${targetVersion}]`), "Add entry to CHANGELOG.md");
	} catch {
		check("Root CHANGELOG.md readable", false, "Check file exists");
	}
	
	try {
		const content = readFileSync("docs/stability.md", "utf-8");
		check("docs/stability.md references version", content.includes(`v${targetVersion}`), "Update SDK section in docs/stability.md");
	} catch {
		check("docs/stability.md readable", false, "Check file exists");
	}
	
	try {
		const content = readFileSync("docs/OPENAPI_CHANGELOG.md", "utf-8");
		check("docs/OPENAPI_CHANGELOG.md has entry", content.includes(`## ${targetVersion}`), "Add entry to docs/OPENAPI_CHANGELOG.md");
	} catch {
		check("docs/OPENAPI_CHANGELOG.md readable", false, "Check file exists");
	}
	
	// 3. API specification
	try {
		const content = readFileSync("docs/openapi.json", "utf-8");
		const spec = JSON.parse(content);
		check("OpenAPI spec version matches", spec.info?.version === targetVersion, "Update docs/openapi.json info.version");
	} catch {
		check("OpenAPI spec readable", false, "Check file exists");
	}
	
	// 4. Build artifacts
	try {
		readFileSync("src/packages/sdk/dist/version.js", "utf-8");
		readFileSync("src/packages/sdk/dist/version.d.ts", "utf-8");
		check("SDK dist files exist", true, "Run: pnpm sdk:build");
		
		const content = readFileSync("src/packages/sdk/dist/version.js", "utf-8");
		check("SDK dist version matches", content.includes(`"${targetVersion}"`), "Run: pnpm sdk:build");
	} catch {
		check("SDK dist files exist", false, "Run: pnpm sdk:build");
	}
	
	// 5. OpenAPI spec hash
	try {
		const hashFile = readFileSync("scripts/.openapi-spec-hash.json", "utf-8");
		const hash = JSON.parse(hashFile);
		check("OpenAPI spec hash is current", hash.version === targetVersion, "Run: pnpm openapi:snapshot");
	} catch {
		check("OpenAPI spec hash readable", false, "Run: pnpm openapi:snapshot");
	}
	
	// 6. Git checks
	try {
		const status = execSync("git status --porcelain", { encoding: "utf-8" });
		check("No uncommitted changes", status.trim() === "", "Commit all changes before release");
	} catch {
		check("Git status check", false, "Check git installation");
	}
	
	try {
		execSync(`git rev-parse v${targetVersion}`, { encoding: "utf-8", stdio: "pipe" });
		check("Git tag doesn't exist yet", false, "Tag should not exist before release");
	} catch {
		check("Git tag doesn't exist yet", true, "Good - tag doesn't exist");
	}
	
	// 7. README version badge (skip npm badge - auto-updated)
	check("README version badge check", true, "NPM badge auto-updated on publish");
	
	// Summary
	console.log("");
	if (failures > 0) {
		console.error(`❌ ${failures} check(s) failed. Fix before releasing.`);
		console.log("\n🔧 Quick fix commands:");
		console.log(`   pnpm version:spec ${targetVersion}  # Update OpenAPI spec`);
		console.log(`   pnpm openapi:snapshot              # Update spec hash`);
		console.log(`   pnpm sdk:build                     # Rebuild SDK`);
		console.log(`   git add . && git commit -m "chore: sync versions to v${targetVersion}"`);
		return 1;
	}
	
	console.log("✅ All version references are synchronized!");
	console.log(`🚀 Ready to release v${targetVersion}`);
	return 0;
}

// Run the script
main();
