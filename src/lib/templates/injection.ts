// src/lib/templates/injection.ts
import { type TemplateContext, templateEngine } from "./engine";

/**
 * Template variable injection utilities.
 * Provides methods for injecting variables into templates and managing variable contexts.
 */

export interface VariableDefinition {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  defaultValue?: any;
  description?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
}

export interface InjectionResult {
  success: boolean;
  rendered: string;
  errors: string[];
  warnings: string[];
  usedVariables: string[];
  unusedVariables: string[];
}

export interface VariableContext {
  variables: Record<string, any>;
  functions: Record<string, (...args: any[]) => any>;
  metadata: Record<string, any>;
}

/**
 * Template Variable Injection class
 * Handles variable injection, validation, and context management.
 */
export class TemplateInjection {
  /**
   * Inject variables into a template string.
   */
  static inject(
    template: string,
    context: VariableContext,
    options: {
      strict?: boolean;
      validateRequired?: boolean;
      trackUsage?: boolean;
    } = {},
  ): InjectionResult {
    const { strict = false, validateRequired = true, trackUsage = true } = options;
    const errors: string[] = [];
    const warnings: string[] = [];
    const usedVariables: string[] = [];
    const unusedVariables: string[] = [];

    try {
      // Validate required variables if requested
      if (validateRequired) {
        const requiredVars = TemplateInjection.extractRequiredVariables(template);
        for (const varName of requiredVars) {
          if (!(varName in context.variables)) {
            errors.push(`Required variable '${varName}' is missing from context`);
          }
        }
      }

      if (errors.length > 0 && strict) {
        return {
          success: false,
          rendered: "",
          errors,
          warnings,
          usedVariables: [],
          unusedVariables: Object.keys(context.variables),
        };
      }

      // Create enhanced context with functions
      const enhancedContext: TemplateContext = {
        ...context.variables,
        ...context.functions,
        ...context.metadata,
      };

      // Render template
      const rendered = templateEngine.render(template, enhancedContext, {
        strict,
        fallback: strict ? undefined : "",
      });

      // Track variable usage
      if (trackUsage) {
        const allVars = TemplateInjection.extractAllVariables(template);
        usedVariables.push(...allVars);
        unusedVariables.push(...Object.keys(context.variables).filter((v) => !allVars.includes(v)));
      }

      return {
        success: true,
        rendered,
        errors,
        warnings,
        usedVariables,
        unusedVariables,
      };
    } catch (error: any) {
      return {
        success: false,
        rendered: "",
        errors: [`Template rendering failed: ${error.message}`],
        warnings,
        usedVariables: [],
        unusedVariables: Object.keys(context.variables),
      };
    }
  }

  /**
   * Extract all variables from a template.
   */
  static extractAllVariables(template: string): string[] {
    const variables = new Set<string>();
    const regex = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      const variable = match[1].trim();
      // Handle nested properties (e.g., user.name)
      const parts = variable.split(".");
      variables.add(parts[0]);
    }

    return Array.from(variables);
  }

  /**
   * Extract required variables from a template.
   */
  static extractRequiredVariables(template: string): string[] {
    const variables = new Set<string>();
    const regex = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      const variable = match[1].trim();
      // Mark as required if it has no default value
      if (!variable.includes("|") && !variable.includes("?")) {
        const parts = variable.split(".");
        variables.add(parts[0]);
      }
    }

    return Array.from(variables);
  }

  /**
   * Validate variable values against their definitions.
   */
  static validateVariables(
    variables: Record<string, any>,
    definitions: VariableDefinition[],
  ): {
    valid: boolean;
    errors: string[];
    validated: Record<string, any>;
  } {
    const errors: string[] = [];
    const validated: Record<string, any> = {};

    for (const def of definitions) {
      const value = variables[def.name];

      // Check required variables
      if (def.required && (value === undefined || value === null)) {
        errors.push(`Required variable '${def.name}' is missing`);
        continue;
      }

      // Use default value if available
      const finalValue = value !== undefined ? value : def.defaultValue;

      // Type validation
      if (finalValue !== undefined && !TemplateInjection.validateType(finalValue, def)) {
        errors.push(`Variable '${def.name}' must be of type ${def.type}`);
        continue;
      }

      // Custom validation
      if (finalValue !== undefined && def.validation) {
        const validationError = TemplateInjection.validateCustom(finalValue, def);
        if (validationError) {
          errors.push(`Variable '${def.name}': ${validationError}`);
          continue;
        }
      }

      validated[def.name] = finalValue;
    }

    return {
      valid: errors.length === 0,
      errors,
      validated,
    };
  }

  /**
   * Validate variable type.
   */
  private static validateType(value: any, definition: VariableDefinition): boolean {
    switch (definition.type) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number" && !Number.isNaN(value);
      case "boolean":
        return typeof value === "boolean";
      case "object":
        return typeof value === "object" && !Array.isArray(value) && value !== null;
      case "array":
        return Array.isArray(value);
      default:
        return true; // Unknown type, assume valid
    }
  }

  /**
   * Validate custom constraints.
   */
  private static validateCustom(value: any, definition: VariableDefinition): string | null {
    const { validation } = definition;

    if (!validation) return null;

    // Min/Max validation for numbers
    if (typeof value === "number") {
      if (validation.min !== undefined && value < validation.min) {
        return `Value must be at least ${validation.min}`;
      }
      if (validation.max !== undefined && value > validation.max) {
        return `Value must be at most ${validation.max}`;
      }
    }

    // Pattern validation for strings
    if (typeof value === "string" && validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        return `Value must match pattern: ${validation.pattern}`;
      }
    }

    // Enum validation
    if (validation.enum && !validation.enum.includes(value)) {
      return `Value must be one of: ${validation.enum.join(", ")}`;
    }

    return null;
  }

  /**
   * Create a variable context from definitions and values.
   */
  static createContext(
    definitions: VariableDefinition[],
    values: Record<string, any>,
    functions?: Record<string, (...args: any[]) => any>,
    metadata?: Record<string, any>,
  ): VariableContext {
    const validation = TemplateInjection.validateVariables(values, definitions);

    if (!validation.valid) {
      throw new Error(`Variable validation failed: ${validation.errors.join(", ")}`);
    }

    return {
      variables: validation.validated,
      functions: functions || {},
      metadata: metadata || {},
    };
  }

  /**
   * Merge multiple contexts.
   */
  static mergeContexts(...contexts: VariableContext[]): VariableContext {
    const merged: VariableContext = {
      variables: {},
      functions: {},
      metadata: {},
    };

    for (const context of contexts) {
      merged.variables = { ...merged.variables, ...context.variables };
      merged.functions = { ...merged.functions, ...context.functions };
      merged.metadata = { ...merged.metadata, ...context.metadata };
    }

    return merged;
  }

  /**
   * Create a context with common helper functions.
   */
  static createHelperContext(): VariableContext {
    return {
      variables: {},
      functions: {
        // String functions
        upper: (str: string) => str.toUpperCase(),
        lower: (str: string) => str.toLowerCase(),
        capitalize: (str: string) => str.charAt(0).toUpperCase() + str.slice(1),
        trim: (str: string) => str.trim(),

        // Number functions
        round: (num: number, decimals: number = 0) =>
          Math.round(num * 10 ** decimals) / 10 ** decimals,
        floor: (num: number) => Math.floor(num),
        ceil: (num: number) => Math.ceil(num),
        abs: (num: number) => Math.abs(num),

        // Date functions
        formatDate: (date: Date | string, _format: string = "YYYY-MM-DD") => {
          const d = typeof date === "string" ? new Date(date) : date;
          return d.toISOString().split("T")[0]; // Simple format
        },

        // Array functions
        join: (array: any[], separator: string = ", ") => array.join(separator),
        length: (array: any[]) => array.length,
        first: (array: any[]) => array[0],
        last: (array: any[]) => array[array.length - 1],

        // Object functions
        keys: (obj: object) => Object.keys(obj),
        values: (obj: object) => Object.values(obj),
        entries: (obj: object) => Object.entries(obj),

        // Utility functions
        default: (value: any, defaultValue: any) => (value !== undefined ? value : defaultValue),
        json: (obj: any) => JSON.stringify(obj, null, 2),
        parse: (str: string) => {
          try {
            return JSON.parse(str);
          } catch {
            return null;
          }
        },
      },
      metadata: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
      },
    };
  }

  /**
   * Extract template metadata from comments.
   */
  static extractMetadata(template: string): Record<string, any> {
    const metadata: Record<string, any> = {};
    const metadataRegex = /<!--\s*meta:\s*(.+?)\s*-->/g;
    let match;

    while ((match = metadataRegex.exec(template)) !== null) {
      try {
        const metaContent = match[1].trim();
        if (metaContent.includes(":")) {
          const [key, ...valueParts] = metaContent.split(":");
          const value = valueParts.join(":").trim();
          metadata[key.trim()] = value;
        } else {
          metadata[metaContent] = true;
        }
      } catch (_error) {
        // Skip invalid metadata
      }
    }

    return metadata;
  }

  /**
   * Generate a template with variable definitions.
   */
  static generateTemplate(
    content: string,
    variables: VariableDefinition[],
  ): {
    template: string;
    definitions: VariableDefinition[];
  } {
    let template = content;
    const definitions: VariableDefinition[] = [];

    for (const variable of variables) {
      const defaultValue =
        variable.defaultValue !== undefined ? `| ${JSON.stringify(variable.defaultValue)}` : "";

      const required = variable.required ? "" : "?";

      template = template.replace(
        new RegExp(`{{\\s*${variable.name}\\s*}}`, "g"),
        `{{${variable.name}${required}${defaultValue}}}`,
      );

      definitions.push(variable);
    }

    return { template, definitions };
  }

  /**
   * Preview template with sample data.
   */
  static preview(
    template: string,
    definitions: VariableDefinition[],
  ): {
    preview: string;
    sampleData: Record<string, any>;
  } {
    const sampleData: Record<string, any> = {};

    for (const def of definitions) {
      switch (def.type) {
        case "string":
          sampleData[def.name] = def.defaultValue || `sample_${def.name}`;
          break;
        case "number":
          sampleData[def.name] = def.defaultValue || 42;
          break;
        case "boolean":
          sampleData[def.name] = def.defaultValue !== undefined ? def.defaultValue : true;
          break;
        case "object":
          sampleData[def.name] = def.defaultValue || { sample: "data" };
          break;
        case "array":
          sampleData[def.name] = def.defaultValue || ["item1", "item2"];
          break;
      }
    }

    const context = TemplateInjection.createContext(definitions, sampleData);
    const result = TemplateInjection.inject(template, context);

    return {
      preview: result.rendered,
      sampleData,
    };
  }
}

// Convenience functions
export const injectTemplate = (
  template: string,
  context: VariableContext,
  options?: {
    strict?: boolean;
    validateRequired?: boolean;
    trackUsage?: boolean;
  },
): InjectionResult => {
  return TemplateInjection.inject(template, context, options);
};

export const validateTemplateVariables = (
  variables: Record<string, any>,
  definitions: VariableDefinition[],
) => {
  return TemplateInjection.validateVariables(variables, definitions);
};

export const createTemplateContext = (
  definitions: VariableDefinition[],
  values: Record<string, any>,
  functions?: Record<string, (...args: any[]) => any>,
  metadata?: Record<string, any>,
): VariableContext => {
  return TemplateInjection.createContext(definitions, values, functions, metadata);
};
