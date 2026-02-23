import { describe, expect, it } from "vitest";
import { runJsonSchemaAssertion } from "@/lib/eval/assertion-runners/json-schema";

describe("runJsonSchemaAssertion", () => {
  describe("basic JSON validation", () => {
    it("passes for valid JSON object", () => {
      const result = runJsonSchemaAssertion('{"key": "value"}');

      expect(result.passed).toBe(true);
      expect(result.key).toBe("json_schema");
      expect(result.category).toBe("format");
      expect(result.details).toBeUndefined();
    });

    it("passes for empty JSON object", () => {
      const result = runJsonSchemaAssertion("{}");

      expect(result.passed).toBe(true);
    });

    it("passes for nested JSON object", () => {
      const result = runJsonSchemaAssertion('{"outer": {"inner": "value"}}');

      expect(result.passed).toBe(true);
    });

    it("fails for invalid JSON", () => {
      const result = runJsonSchemaAssertion("not valid json");

      expect(result.passed).toBe(false);
      expect(result.details).toBe("Output is not valid JSON");
    });

    it("fails for malformed JSON", () => {
      const result = runJsonSchemaAssertion('{"key": "value"');

      expect(result.passed).toBe(false);
      expect(result.details).toBe("Output is not valid JSON");
    });

    it("passes for JSON array (arrays are objects in JS)", () => {
      const result = runJsonSchemaAssertion("[1, 2, 3]");

      expect(result.passed).toBe(true);
    });

    it("fails for JSON primitive string", () => {
      const result = runJsonSchemaAssertion('"just a string"');

      expect(result.passed).toBe(false);
      expect(result.details).toBe("Output must be a JSON object");
    });

    it("fails for JSON primitive number", () => {
      const result = runJsonSchemaAssertion("42");

      expect(result.passed).toBe(false);
      expect(result.details).toBe("Output must be a JSON object");
    });

    it("fails for JSON null", () => {
      const result = runJsonSchemaAssertion("null");

      expect(result.passed).toBe(false);
      expect(result.details).toBe("Output must be a JSON object");
    });

    it("fails for JSON boolean", () => {
      const result = runJsonSchemaAssertion("true");

      expect(result.passed).toBe(false);
      expect(result.details).toBe("Output must be a JSON object");
    });
  });

  describe("required keys validation", () => {
    it("passes when all required keys present", () => {
      const result = runJsonSchemaAssertion('{"name": "Alice", "age": 30}', {
        requiredKeys: ["name", "age"],
      });

      expect(result.passed).toBe(true);
      expect(result.details).toBeUndefined();
    });

    it("passes when extra keys present beyond required", () => {
      const result = runJsonSchemaAssertion('{"name": "Alice", "age": 30, "city": "NYC"}', {
        requiredKeys: ["name"],
      });

      expect(result.passed).toBe(true);
    });

    it("fails when required key is missing", () => {
      const result = runJsonSchemaAssertion('{"name": "Alice"}', { requiredKeys: ["name", "age"] });

      expect(result.passed).toBe(false);
      expect(result.details).toBe("Missing keys: age");
    });

    it("fails when multiple required keys are missing", () => {
      const result = runJsonSchemaAssertion('{"other": "value"}', {
        requiredKeys: ["name", "age", "email"],
      });

      expect(result.passed).toBe(false);
      expect(result.details).toBe("Missing keys: name, age, email");
    });

    it("passes with empty requiredKeys array", () => {
      const result = runJsonSchemaAssertion('{"anything": "here"}', { requiredKeys: [] });

      expect(result.passed).toBe(true);
    });

    it("handles nested key names (checks top-level only)", () => {
      const result = runJsonSchemaAssertion('{"outer": {"inner": "value"}}', {
        requiredKeys: ["outer"],
      });

      expect(result.passed).toBe(true);
    });

    it("fails for invalid JSON even with requiredKeys", () => {
      const result = runJsonSchemaAssertion("not json", { requiredKeys: ["name"] });

      expect(result.passed).toBe(false);
      expect(result.details).toBe("Output is not valid JSON");
    });
  });

  describe("edge cases", () => {
    it("handles empty string input", () => {
      const result = runJsonSchemaAssertion("");

      expect(result.passed).toBe(false);
      expect(result.details).toBe("Output is not valid JSON");
    });

    it("handles whitespace-only input", () => {
      const result = runJsonSchemaAssertion("   ");

      expect(result.passed).toBe(false);
      expect(result.details).toBe("Output is not valid JSON");
    });

    it("handles JSON with whitespace", () => {
      const result = runJsonSchemaAssertion('  { "key" : "value" }  ');

      expect(result.passed).toBe(true);
    });

    it("handles JSON with special characters in values", () => {
      const result = runJsonSchemaAssertion('{"message": "Hello\\nWorld"}');

      expect(result.passed).toBe(true);
    });

    it("handles JSON with unicode", () => {
      const result = runJsonSchemaAssertion('{"emoji": "🎉", "chinese": "你好"}');

      expect(result.passed).toBe(true);
    });
  });
});
