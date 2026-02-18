// src/lib/prompts/template-engine.ts

/**
 * Parametric Prompt Template Engine (Section 2.2a).
 * Supports {{variable}} interpolation, conditionals, and loops.
 */

export interface TemplateContext {
  [key: string]: string | number | boolean | string[] | Record<string, any> | undefined;
}

/**
 * Render a prompt template with the given context variables.
 *
 * Supported syntax:
 *   {{variable}}          — simple interpolation
 *   {{#if variable}}…{{/if}}  — conditional block
 *   {{#each items}}…{{/each}} — loop (use {{this}} for current item)
 *   {{variable | default:"fallback"}} — default value
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  let output = template;

  // 1. Process {{#each items}}…{{/each}}
  output = output.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, body) => {
    const items = context[key];
    if (!Array.isArray(items)) return "";
    return items.map((item) => body.replace(/\{\{this\}\}/g, String(item))).join("");
  });

  // 2. Process {{#if variable}}…{{/if}}
  output = output.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, body) => {
    const value = context[key];
    return value ? body : "";
  });

  // 3. Process {{variable | default:"fallback"}}
  output = output.replace(/\{\{(\w+)\s*\|\s*default\s*:\s*"([^"]*)"\}\}/g, (_, key, fallback) => {
    const value = context[key];
    return value !== undefined && value !== "" ? String(value) : fallback;
  });

  // 4. Process simple {{variable}} interpolation
  output = output.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = context[key];
    if (value === undefined) return `{{${key}}}`;
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });

  return output;
}

/**
 * Extract all variable names from a template.
 */
export function extractVariables(template: string): string[] {
  const vars = new Set<string>();

  // Simple variables
  const simpleMatches = template.matchAll(/\{\{(\w+)(?:\s*\|[^}]*)?\}\}/g);
  for (const m of simpleMatches) vars.add(m[1]);

  // #if / #each block variables
  const blockMatches = template.matchAll(/\{\{#(?:if|each)\s+(\w+)\}\}/g);
  for (const m of blockMatches) vars.add(m[1]);

  return Array.from(vars);
}

/**
 * Validate that all required variables are present in the context.
 * Returns missing variable names, or an empty array if all present.
 */
export function validateContext(template: string, context: TemplateContext): string[] {
  const required = extractVariables(template);
  return required.filter((v) => context[v] === undefined);
}
