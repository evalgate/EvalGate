import { spawnSync } from "node:child_process";
import path from "node:path";

const args = process.argv.slice(2);

const shouldSkip = (file) => {
  const normalized = file.split(path.sep).join("/");
  return (
    normalized.includes("src/app/guides/") ||
    normalized.includes("src/app/docs/") ||
    normalized.includes("/docs/") ||
    normalized.includes("/examples/")
  );
};

const files = args.filter((file) => {
  if (file.endsWith(".lock")) {
    return false;
  }
  return !shouldSkip(file);
});

if (files.length === 0) {
  process.exit(0);
}

const run = (command, commandArgs) => {
  const result = spawnSync(command, [...commandArgs, ...files], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status);
  }
};

run("pnpm", ["exec", "biome", "check", "--write", "--diagnostic-level=error"]);
run("pnpm", ["exec", "biome", "format", "--write"]);
