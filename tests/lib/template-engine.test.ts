import { describe, expect, it } from "vitest";
import {
  extractVariables,
  renderTemplate,
  type TemplateContext,
  validateContext,
} from "@/lib/prompts/template-engine";

describe("renderTemplate", () => {
  describe("simple interpolation", () => {
    it("replaces {{variable}} with context value", () => {
      const result = renderTemplate("Hello {{name}}!", { name: "World" });
      expect(result).toBe("Hello World!");
    });

    it("handles multiple variables", () => {
      const result = renderTemplate("{{greeting}} {{name}}!", { greeting: "Hi", name: "Alice" });
      expect(result).toBe("Hi Alice!");
    });

    it("keeps undefined variables as-is", () => {
      const result = renderTemplate("Hello {{name}}!", {});
      expect(result).toBe("Hello {{name}}!");
    });

    it("converts numbers to strings", () => {
      const result = renderTemplate("Count: {{count}}", { count: 42 });
      expect(result).toBe("Count: 42");
    });

    it("converts booleans to strings", () => {
      const result = renderTemplate("Active: {{active}}", { active: true });
      expect(result).toBe("Active: true");
    });

    it("stringifies objects as JSON", () => {
      const result = renderTemplate("Data: {{data}}", { data: { key: "value" } });
      expect(result).toBe('Data: {"key":"value"}');
    });
  });

  describe("conditional blocks", () => {
    it("renders content when condition is truthy", () => {
      const result = renderTemplate("{{#if show}}Visible{{/if}}", { show: true });
      expect(result).toBe("Visible");
    });

    it("hides content when condition is falsy", () => {
      const result = renderTemplate("{{#if show}}Visible{{/if}}", { show: false });
      expect(result).toBe("");
    });

    it("hides content when condition is undefined", () => {
      const result = renderTemplate("{{#if show}}Visible{{/if}}", {});
      expect(result).toBe("");
    });

    it("treats non-empty string as truthy", () => {
      const result = renderTemplate("{{#if name}}Hello {{name}}{{/if}}", { name: "Alice" });
      expect(result).toBe("Hello Alice");
    });

    it("treats empty string as falsy", () => {
      const result = renderTemplate("{{#if name}}Hello{{/if}}", { name: "" });
      expect(result).toBe("");
    });

    it("handles nested content", () => {
      const result = renderTemplate("Start{{#if show}} middle {{/if}}end", { show: true });
      expect(result).toBe("Start middle end");
    });
  });

  describe("each loops", () => {
    it("iterates over array items", () => {
      const result = renderTemplate("{{#each items}}[{{this}}]{{/each}}", {
        items: ["a", "b", "c"],
      });
      expect(result).toBe("[a][b][c]");
    });

    it("returns empty string for non-array", () => {
      const result = renderTemplate("{{#each items}}[{{this}}]{{/each}}", {
        items: "not an array" as any,
      });
      expect(result).toBe("");
    });

    it("returns empty string for undefined", () => {
      const result = renderTemplate("{{#each items}}[{{this}}]{{/each}}", {});
      expect(result).toBe("");
    });

    it("handles empty array", () => {
      const result = renderTemplate("{{#each items}}[{{this}}]{{/each}}", { items: [] });
      expect(result).toBe("");
    });

    it("handles multiline body", () => {
      const result = renderTemplate("{{#each items}}\n- {{this}}\n{{/each}}", {
        items: ["one", "two"],
      });
      expect(result).toBe("\n- one\n\n- two\n");
    });
  });

  describe("default values", () => {
    it("uses context value when present", () => {
      const result = renderTemplate('{{name | default:"Guest"}}', { name: "Alice" });
      expect(result).toBe("Alice");
    });

    it("uses default when value is undefined", () => {
      const result = renderTemplate('{{name | default:"Guest"}}', {});
      expect(result).toBe("Guest");
    });

    it("uses default when value is empty string", () => {
      const result = renderTemplate('{{name | default:"Guest"}}', { name: "" });
      expect(result).toBe("Guest");
    });

    it("uses context value of 0", () => {
      const result = renderTemplate('{{count | default:"none"}}', { count: 0 });
      expect(result).toBe("0");
    });

    it("uses context value of false", () => {
      const result = renderTemplate('{{active | default:"yes"}}', { active: false });
      expect(result).toBe("false");
    });
  });

  describe("complex templates", () => {
    it("handles combination of features", () => {
      const template = `
Hello {{name | default:"User"}}!
{{#if premium}}You are a premium member.{{/if}}
Your items:
{{#each items}}- {{this}}
{{/each}}`;

      const result = renderTemplate(template, {
        name: "Alice",
        premium: true,
        items: ["Item 1", "Item 2"],
      });

      expect(result).toContain("Hello Alice!");
      expect(result).toContain("You are a premium member.");
      expect(result).toContain("- Item 1");
      expect(result).toContain("- Item 2");
    });
  });
});

describe("extractVariables", () => {
  it("extracts simple variables", () => {
    const vars = extractVariables("Hello {{name}}, your score is {{score}}");
    expect(vars).toContain("name");
    expect(vars).toContain("score");
  });

  it("extracts variables with default values", () => {
    const vars = extractVariables('Hello {{name | default:"Guest"}}');
    expect(vars).toContain("name");
  });

  it("extracts variables from if blocks", () => {
    const vars = extractVariables("{{#if premium}}Premium{{/if}}");
    expect(vars).toContain("premium");
  });

  it("extracts variables from each blocks", () => {
    const vars = extractVariables("{{#each items}}{{this}}{{/each}}");
    expect(vars).toContain("items");
  });

  it("returns unique variables", () => {
    const vars = extractVariables("{{name}} and {{name}} again");
    expect(vars.filter((v: string) => v === "name")).toHaveLength(1);
  });

  it("returns empty array for no variables", () => {
    const vars = extractVariables("Plain text without variables");
    expect(vars).toHaveLength(0);
  });
});

describe("validateContext", () => {
  it("returns empty array when all variables present", () => {
    const missing = validateContext("Hello {{name}}", { name: "Alice" });
    expect(missing).toHaveLength(0);
  });

  it("returns missing variable names", () => {
    const missing = validateContext("Hello {{name}}, score: {{score}}", { name: "Alice" });
    expect(missing).toEqual(["score"]);
  });

  it("returns all missing variables", () => {
    const missing = validateContext("{{a}} {{b}} {{c}}", {});
    expect(missing).toHaveLength(3);
    expect(missing).toContain("a");
    expect(missing).toContain("b");
    expect(missing).toContain("c");
  });

  it("validates if block variables", () => {
    const missing = validateContext("{{#if premium}}VIP{{/if}}", {});
    expect(missing).toContain("premium");
  });

  it("validates each block variables", () => {
    const missing = validateContext("{{#each items}}{{this}}{{/each}}", {});
    expect(missing).toContain("items");
  });
});
