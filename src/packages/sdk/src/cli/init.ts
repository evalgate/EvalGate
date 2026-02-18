#!/usr/bin/env node

/**
 * evalai init — Create evalai.config.json
 *
 * Creates the smallest possible config file. Defaults belong in code.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CONFIG_CONTENT = `{
  "evaluationId": ""
}
`;

export function runInit(cwd: string = process.cwd()): boolean {
  const configPath = path.join(cwd, "evalai.config.json");

  if (fs.existsSync(configPath)) {
    console.log(`evalai.config.json already exists at ${path.resolve(configPath)}`);
    return false;
  }

  fs.writeFileSync(configPath, CONFIG_CONTENT, "utf-8");
  const resolvedPath = path.resolve(configPath);
  console.log(`Wrote evalai.config.json at ${resolvedPath}`);
  console.log("");
  console.log(
    "Next: paste evaluationId into evalai.config.json, then run npx -y @pauly4010/evalai-sdk@^1 check --format github --onFail import",
  );
  console.log("");
  console.log("GitHub Actions snippet (add to your workflow):");
  console.log("  - name: EvalAI gate");
  console.log("    env:");
  console.log("      EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}");
  console.log("    run: npx -y @pauly4010/evalai-sdk@^1 check --format github --onFail import");
  console.log("");
  console.log("To uninstall: delete evalai.config.json.");
  return true;
}
