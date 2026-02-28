import { spawnSync } from "node:child_process";

const CHUNK_SIZE = 50;

const files = process.argv.slice(2).filter((file) => {
	const f = file.split("\\").join("/");
	return (
		!f.includes("/dist/") &&
		!f.includes("/.evalai/") &&
		!f.includes("/node_modules/") &&
		!file.endsWith(".lock")
	);
});

if (files.length === 0) process.exit(0);

const chunks = [];
for (let i = 0; i < files.length; i += CHUNK_SIZE) {
	chunks.push(files.slice(i, i + CHUNK_SIZE));
}

let status = 0;

for (const chunk of chunks) {
	console.error(
		`Processing chunk ${chunks.indexOf(chunk) + 1}/${chunks.length} (${chunk.length} files)`,
	);

	const check = spawnSync(
		"pnpm",
		["exec", "biome", "check", "--write", "--diagnostic-level=error", ...chunk],
		{
			stdio: "inherit",
			shell: false,
		},
	);
	if (check.status !== 0) status = check.status;

	const format = spawnSync(
		"pnpm",
		["exec", "biome", "format", "--write", ...chunk],
		{
			stdio: "inherit",
			shell: false,
		},
	);
	if (format.status !== 0) status = format.status;
}

process.exit(status);
