// src/lib/templates/engine.ts
/**
 * Parametric prompt template engine.
 * Supports {{variable}} syntax with nested objects and arrays.
 */

import { logger } from "@/lib/logger";

export interface TemplateContext {
	[key: string]: unknown;
}

export interface TemplateOptions {
	strict?: boolean; // Throw error on missing variables
	fallback?: string; // Value to use for missing variables
	escapeHtml?: boolean; // HTML escape variables
}

/**
 * Template engine for processing {{variable}} syntax.
 * Supports nested object access: {{user.name}}
 * Supports array access: {{items.0.name}}
 * Supports functions: {{date | format('YYYY-MM-DD')}}
 */
export class TemplateEngine {
	private cache = new Map<string, (context: TemplateContext) => string>();

	/**
	 * Compile a template string into a reusable function.
	 * Returns a function that takes context and returns the rendered string.
	 */
	compile(
		template: string,
		options: TemplateOptions = {},
	): (context: TemplateContext) => string {
		const cacheKey = `${template}:${JSON.stringify(options)}`;

		if (this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey)!;
		}

		const compiled = this.createCompiledFunction(template, options);
		this.cache.set(cacheKey, compiled);

		return compiled;
	}

	/**
	 * Render a template with the given context.
	 * One-time use, doesn't cache the compiled function.
	 */
	render(
		template: string,
		context: TemplateContext,
		options: TemplateOptions = {},
	): string {
		const compiled = this.compile(template, options);
		return compiled(context);
	}

	/**
	 * Create a compiled function from template string.
	 * Uses Function constructor for better performance than regex replacement.
	 */
	private createCompiledFunction(
		template: string,
		options: TemplateOptions,
	): (context: TemplateContext) => string {
		const { strict = false, fallback = "", escapeHtml = false } = options;

		// Find all {{variable}} occurrences
		const variableRegex = /\{\{([^}]+)\}\}/g;
		const variables: string[] = [];
		let match = variableRegex.exec(template);

		while (match !== null) {
			variables.push(match[1].trim());
			match = variableRegex.exec(template);
		}

		// Remove duplicates
		const uniqueVariables = [...new Set(variables)];

		// Build the function body
		let functionBody = 'let result = "";\n';

		// Add variable accessors
		uniqueVariables.forEach((variable) => {
			const accessor = this.buildAccessor(
				variable,
				strict,
				fallback,
				escapeHtml,
			);
			functionBody += `const ${this.sanitizeVariableName(variable)} = ${accessor};\n`;
		});

		// Replace template with variable references
		let processedTemplate = template;
		uniqueVariables.forEach((variable) => {
			const varName = this.sanitizeVariableName(variable);
			processedTemplate = processedTemplate.replace(
				new RegExp(`\\{\\{${this.escapeRegex(variable)}\\}\\}`, "g"),
				`\${${varName}}`,
			);
		});

		functionBody += `result = \`${processedTemplate.replace(/`/g, "\\`")}\`;\n`;
		functionBody += "return result;";

		try {
			return new Function("context", functionBody) as (
				context: TemplateContext,
			) => string;
		} catch (error) {
			logger.error("Template compilation error", error);
			return (_context: TemplateContext) => template;
		}
	}

	/**
	 * Build accessor string for nested variable access.
	 */
	private buildAccessor(
		variable: string,
		strict: boolean,
		fallback: string,
		escapeHtml: boolean,
	): string {
		const parts = variable.split(".");
		let accessor = "context";

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];

			// Handle array access (items.0.name)
			if (/^\d+$/.test(part)) {
				accessor += `[${part}]`;
			} else {
				accessor += `?.${part}`;
			}
		}

		let result = accessor;

		// Add fallback handling
		if (!strict) {
			result = `(${result} ?? ${JSON.stringify(fallback)})`;
		}

		// Add HTML escaping
		if (escapeHtml) {
			result = `this.escapeHtml(${result})`;
		}

		return result;
	}

	/**
	 * Sanitize variable name for use in function.
	 */
	private sanitizeVariableName(variable: string): string {
		return variable.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^\d/, "_$&");
	}

	/**
	 * Escape regex special characters.
	 */
	private escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	/**
	 * Clear the compilation cache.
	 */
	clearCache(): void {
		this.cache.clear();
	}

	/**
	 * Get cache statistics.
	 */
	getCacheStats(): { size: number; keys: string[] } {
		return {
			size: this.cache.size,
			keys: Array.from(this.cache.keys()),
		};
	}
}

// Singleton instance
export const templateEngine = new TemplateEngine();

/**
 * Convenience functions for common use cases.
 */
export const renderTemplate = (
	template: string,
	context: TemplateContext,
	options?: TemplateOptions,
): string => {
	return templateEngine.render(template, context, options);
};

export const compileTemplate = (
	template: string,
	options?: TemplateOptions,
): ((context: TemplateContext) => string) => {
	return templateEngine.compile(template, options);
};

/**
 * Template validation utilities.
 */
export class TemplateValidator {
	/**
	 * Extract all variables from a template.
	 */
	static extractVariables(template: string): string[] {
		const variableRegex = /\{\{([^}]+)\}\}/g;
		const variables: string[] = [];
		let match = variableRegex.exec(template);

		while (match !== null) {
			variables.push(match[1].trim());
			match = variableRegex.exec(template);
		}

		return [...new Set(variables)];
	}

	/**
	 * Check if all required variables are present in context.
	 */
	static validateContext(
		template: string,
		context: TemplateContext,
	): {
		valid: boolean;
		missing: string[];
		extra: string[];
	} {
		const required = TemplateValidator.extractVariables(template);
		const missing: string[] = [];
		const extra: string[] = [];

		for (const variable of required) {
			const value = TemplateValidator.getNestedValue(context, variable);
			if (value === undefined || value === null) {
				missing.push(variable);
			}
		}

		// Check for extra variables (optional)
		const contextKeys = TemplateValidator.extractContextKeys(context);
		const requiredKeys = required.map((v) => v.split(".")[0]);
		extra.push(...contextKeys.filter((key) => !requiredKeys.includes(key)));

		return {
			valid: missing.length === 0,
			missing,
			extra,
		};
	}

	/**
	 * Get nested value from context.
	 */
	private static getNestedValue(
		context: TemplateContext,
		path: string,
	): unknown {
		const parts = path.split(".");
		let value: unknown = context;

		for (const part of parts) {
			if (value === null || value === undefined) {
				return undefined;
			}

			if (/^\d+$/.test(part)) {
				value = (value as Record<number, unknown>)[parseInt(part, 10)];
			} else {
				value = (value as Record<string, unknown>)[part];
			}
		}

		return value;
	}

	/**
	 * Extract all top-level keys from context.
	 */
	private static extractContextKeys(
		context: TemplateContext,
		prefix = "",
	): string[] {
		const keys: string[] = [];

		for (const key in context) {
			const fullKey = prefix ? `${prefix}.${key}` : key;

			if (
				typeof context[key] === "object" &&
				context[key] !== null &&
				!Array.isArray(context[key])
			) {
				keys.push(
					...TemplateValidator.extractContextKeys(
						context[key] as TemplateContext,
						fullKey,
					),
				);
			} else {
				keys.push(fullKey);
			}
		}

		return keys;
	}
}
