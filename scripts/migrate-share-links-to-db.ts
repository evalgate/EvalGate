#!/usr/bin/env npx tsx
/**
 * One-time script to migrate share links from public/exports/public/*.json
 * into the shared_exports table.
 *
 * Run after deploying the share links migration (DB-backed exports).
 * Usage:
 *   pnpm tsx scripts/migrate-share-links-to-db.ts [--org-id N] [--dry-run]
 *
 * --dry-run  Preview what would be migrated without writing to DB.
 * --org-id=N Use organization N (default: first org).
 * Requires DATABASE_URL in .env.local or .env.
 */

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

async function loadEnv() {
	for (const f of [".env.local", ".env"]) {
		try {
			const content = await readFile(join(process.cwd(), f), "utf-8");
			for (const line of content.split("\n")) {
				const m = line.match(/^([^#=]+)=(.*)$/);
				if (m)
					process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
			}
			break;
		} catch {
			/* file not found */
		}
	}
}

function computeExportHash(exportData: Record<string, unknown>): string {
	const canonical = JSON.stringify(exportData, Object.keys(exportData).sort());
	return createHash("sha256").update(canonical).digest("hex");
}

async function main() {
	await loadEnv();

	const orgIdArg = process.argv.find((a) => a.startsWith("--org-id="));
	// biome-ignore lint/style/noNonNullAssertion: safe assertion
	const orgIdOverride = orgIdArg ? parseInt(orgIdArg.split("=")[1]!, 10) : null;
	const dryRun = process.argv.includes("--dry-run");

	if (dryRun) {
		console.log("DRY RUN — no changes will be written.\n");
	}

	const { db } = await import("@/db");
	const { eq } = await import("drizzle-orm");
	const { organizations, sharedExports } = await import("@/db/schema");
	const { prepareExportForShare } = await import("@/lib/shared-exports");

	const exportsDir = join(process.cwd(), "public", "exports", "public");
	let files: string[];
	try {
		files = await readdir(exportsDir);
	} catch (err) {
		console.warn("public/exports/public/ not found or not readable:", err);
		process.exit(0);
	}

	const jsonFiles = files.filter(
		(f) => f.endsWith(".json") && f !== "index.json",
	);
	if (jsonFiles.length === 0) {
		console.log(
			"No share link JSON files found in public/exports/public/. Nothing to migrate.",
		);
		return;
	}

	let orgId = orgIdOverride;
	if (orgId == null && !dryRun) {
		const [org] = await db
			.select({ id: organizations.id })
			.from(organizations)
			.limit(1);
		if (!org) {
			console.error(
				"No organization found. Create one first or pass --org-id=N",
			);
			process.exit(1);
		}
		orgId = org.id;
	}
	if (orgId == null) orgId = 1; // placeholder for dry-run

	const now = new Date();
	let migrated = 0;
	let skipped = 0;
	const mapping: Array<{ shareId: string; exportHash: string }> = [];

	for (const file of jsonFiles) {
		const shareId = file.replace(/\.json$/, "");
		const filePath = join(exportsDir, file);

		try {
			const raw = await readFile(filePath, "utf-8");
			const parsed = JSON.parse(raw) as Record<string, unknown>;

			let sanitized: Record<string, unknown>;
			try {
				sanitized = prepareExportForShare(parsed);
			} catch (err) {
				console.warn(
					`  [skip] ${file}: ${err instanceof Error ? err.message : err}`,
				);
				skipped++;
				continue;
			}

			const exportHash = computeExportHash(sanitized);
			const ev = (sanitized.evaluation as Record<string, unknown>) ?? {};
			const evalIdRaw = ev.id;
			const evaluationId =
				typeof evalIdRaw === "number"
					? evalIdRaw
					: typeof evalIdRaw === "string"
						? parseInt(evalIdRaw, 10)
						: null;
			const evaluationIdNum = Number.isFinite(evaluationId)
				? evaluationId
				: null;

			if (!dryRun) {
				const [existing] = await db
					.select({ id: sharedExports.id })
					.from(sharedExports)
					.where(eq(sharedExports.shareId, shareId))
					.limit(1);
				if (existing) {
					console.log(`  [skip] ${shareId} (already in DB)`);
					skipped++;
					continue;
				}
			}

			mapping.push({ shareId, exportHash });

			if (dryRun) {
				console.log(
					`  [would migrate] ${shareId} (hash: ${exportHash.slice(0, 12)}...)`,
				);
				migrated++;
				continue;
			}

			await db.insert(sharedExports).values({
				shareId,
				// biome-ignore lint/style/noNonNullAssertion: safe assertion
				organizationId: orgId!,
				evaluationId: evaluationIdNum,
				evaluationRunId: null,
				shareScope: "evaluation",
				exportData: sanitized,
				exportHash,
				isPublic: true,
				revokedAt: null,
				createdAt: now,
				expiresAt: null,
				viewCount: 0,
			});

			console.log(`  [ok]   ${shareId}`);
			migrated++;
		} catch (err) {
			console.warn(
				`  [skip] ${file}: ${err instanceof Error ? err.message : err}`,
			);
			skipped++;
		}
	}

	console.log(
		`\n${dryRun ? "Would migrate" : "Migrated"} ${migrated} share link(s), skipped ${skipped}.`,
	);
	if (dryRun && mapping.length > 0) {
		console.log("\nMapping (shareId -> exportHash):");
		for (const { shareId, exportHash } of mapping) {
			console.log(`  ${shareId}: ${exportHash}`);
		}
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
