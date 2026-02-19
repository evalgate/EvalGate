#!/usr/bin/env npx tsx
/**
 * Generate minimal OpenAPI path stubs for all doc-worthy routes.
 * Merges with existing docs/openapi.json and writes back.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { globSync } from "glob";

const API_DIR = path.resolve(process.cwd(), "src/app/api");
const OPENAPI_JSON = path.resolve(process.cwd(), "docs/openapi.json");
const EXCLUDE = [
  "auth",
  "debug",
  "demo",
  "docs",
  "health",
  "sentry-example-api",
  "autumn",
  "billing-portal",
  "costs/pricing",
  "onboarding",
  "org/switch",
  "subscribers",
  "r/[shareToken]",
];

function routeFileToApiPath(routeFile: string): string {
  const normalized = routeFile.replace(/\\/g, "/").replace(/\/route\.ts$/, "");
  const segments = normalized.split("/").map((s) => {
    if (s.startsWith("[") && s.endsWith("]")) return `{${s.slice(1, -1)}}`;
    return s;
  });
  return `/api/${segments.join("/")}`;
}

function isExcluded(routeFile: string): boolean {
  const normalized = routeFile.replace(/\\/g, "/");
  return EXCLUDE.some((prefix) => normalized.includes(prefix) || normalized.startsWith(prefix));
}

function pathParams(
  pathStr: string,
): { name: string; in: "path"; required: boolean; schema: { type: string } }[] {
  const matches = pathStr.match(/\{(\w+)\}/g) || [];
  return matches.map((m) => {
    const name = m.slice(1, -1);
    const isId = /^(id|runId|evaluationId|taskId|shareId)$/.test(name);
    return {
      name,
      in: "path" as const,
      required: true,
      schema: { type: isId ? "integer" : "string" },
    };
  });
}

const routeFiles = globSync("**/route.ts", { cwd: API_DIR });
const docWorthyPaths = [
  ...new Set(routeFiles.filter((f) => !isExcluded(f)).map(routeFileToApiPath)),
];

const openApi = JSON.parse(readFileSync(OPENAPI_JSON, "utf-8"));
const existingPaths = new Set(Object.keys(openApi.paths || {}));

const minimalOperation = {
  summary: "API endpoint",
  responses: {
    "200": { description: "Success" },
    "401": { $ref: "#/components/responses/Unauthorized" },
  },
  security: [{ bearerAuth: [] }],
};

for (const p of docWorthyPaths) {
  if (existingPaths.has(p)) continue;
  const params = pathParams(p);
  openApi.paths[p] = {
    get: {
      ...minimalOperation,
      summary: p.split("/").pop()?.replace(/{.*}/, "by id") || "Get",
      ...(params.length > 0 && { parameters: params }),
    },
  };
}

// Ensure components.responses.Unauthorized exists
openApi.components = openApi.components || {};
openApi.components.responses = openApi.components.responses || {};
openApi.components.responses.Unauthorized = openApi.components.responses.Unauthorized || {
  description: "Unauthorized",
  content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
};

writeFileSync(OPENAPI_JSON, JSON.stringify(openApi, null, 2));
console.log(
  `Added ${docWorthyPaths.length - existingPaths.size} paths. Total: ${Object.keys(openApi.paths).length}`,
);
