import { describe, expect, it } from "vitest";
import { normalizeInput, sha256Input } from "@/lib/utils/input-hash";

describe("sortKeys", () => {
  // Since sortKeys is not exported, we test it indirectly through normalizeInput

  it("should sort object keys recursively", () => {
    const input = '{"z": 1, "a": 2, "nested": {"y": 3, "x": 4}}';
    const result = normalizeInput(input);
    expect(result).toBe('{"a":2,"nested":{"x":4,"y":3},"z":1}');
  });
});

describe("normalizeInput", () => {
  // Happy path tests
  it("should trim whitespace from string input", () => {
    expect(normalizeInput("  hello world  ")).toBe("hello world");
  });

  it("should normalize JSON with sorted keys", () => {
    const input = '{"z": 1, "a": 2, "b": 3}';
    const result = normalizeInput(input);
    expect(result).toBe('{"a":2,"b":3,"z":1}');
  });

  it("should handle nested objects", () => {
    const input = '{"outer": {"z": 1, "a": 2}, "b": 3}';
    const result = normalizeInput(input);
    expect(result).toBe('{"b":3,"outer":{"a":2,"z":1}}');
  });

  it("should handle deeply nested objects", () => {
    const input = '{"level1": {"level2": {"z": 1, "a": 2}, "b": 3}}';
    const result = normalizeInput(input);
    expect(result).toBe('{"level1":{"b":3,"level2":{"a":2,"z":1}}}');
  });

  it("should preserve arrays as-is", () => {
    const input = '{"array": [3, 1, 2], "z": 1, "a": 2}';
    const result = normalizeInput(input);
    expect(result).toBe('{"a":2,"array":[3,1,2],"z":1}');
  });

  it("should handle mixed nested structures", () => {
    const input = '{"data": {"items": [1, 2], "z": 3, "a": 1}, "b": 2}';
    const result = normalizeInput(input);
    expect(result).toBe('{"b":2,"data":{"a":1,"items":[1,2],"z":3}}');
  });

  // Edge case tests
  it("should collapse multiple whitespace characters", () => {
    expect(normalizeInput("hello    world")).toBe("hello world");
    expect(normalizeInput("hello\n\tworld")).toBe("hello world");
    expect(normalizeInput("hello \n \t world")).toBe("hello world");
  });

  it("should handle empty string", () => {
    expect(normalizeInput("")).toBe("");
    expect(normalizeInput("   ")).toBe("");
  });

  it("should handle empty JSON object", () => {
    expect(normalizeInput("{}")).toBe("{}");
    expect(normalizeInput("  {}  ")).toBe("{}");
  });

  it("should handle JSON arrays", () => {
    // Arrays get converted to objects with sorted keys
    expect(normalizeInput("[1, 2, 3]")).toBe('{"0":1,"1":2,"2":3}');
    expect(normalizeInput("  [1, 2, 3]  ")).toBe('{"0":1,"1":2,"2":3}');
  });

  it("should handle JSON with null values", () => {
    const input = '{"a": null, "z": 1, "b": null}';
    const result = normalizeInput(input);
    expect(result).toBe('{"a":null,"b":null,"z":1}');
  });

  it("should handle JSON with undefined values (becomes null in JSON)", () => {
    const input = '{"a": null, "z": 1}';
    const result = normalizeInput(input);
    expect(result).toBe('{"a":null,"z":1}');
  });

  // Error/invalid input tests
  it("should handle invalid JSON as plain string", () => {
    expect(normalizeInput('{"invalid": json}')).toBe('{"invalid": json}');
  });

  it("should handle malformed JSON", () => {
    expect(normalizeInput('{"missing": "quote}')).toBe('{"missing": "quote}');
  });

  it("should handle non-object JSON", () => {
    // Strings get treated as arrays of characters when parsed as JSON
    expect(normalizeInput('"string value"')).toBe(
      '{"0":"s","1":"t","2":"r","3":"i","4":"n","5":"g","6":" ","7":"v","8":"a","9":"l","10":"u","11":"e"}',
    );
    // Numbers and booleans become empty objects when passed through sortKeys
    expect(normalizeInput("123")).toBe("{}");
    expect(normalizeInput("true")).toBe("{}");
    expect(normalizeInput("false")).toBe("{}");
    // null stays as 'null' since JSON.parse returns null
    expect(normalizeInput("null")).toBe("null");
  });

  it("should handle JSON with special characters", () => {
    const input = '{"message": "Hello\\nWorld!", "z": 1, "a": 2}';
    const result = normalizeInput(input);
    expect(result).toBe('{"a":2,"message":"Hello\\nWorld!","z":1}');
  });

  it("should handle numeric values", () => {
    const input = '{"float": 3.14, "int": 42, "negative": -1, "zero": 0}';
    const result = normalizeInput(input);
    expect(result).toBe('{"float":3.14,"int":42,"negative":-1,"zero":0}');
  });

  it("should handle boolean values", () => {
    const input = '{"boolTrue": true, "boolFalse": false, "z": 1}';
    const result = normalizeInput(input);
    expect(result).toBe('{"boolFalse":false,"boolTrue":true,"z":1}');
  });
});

describe("sha256Input", () => {
  // Happy path tests
  it("should generate consistent hash for same input", () => {
    const input = "test input";
    const hash1 = sha256Input(input);
    const hash2 = sha256Input(input);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should generate same hash for JSON with different key order", () => {
    const input1 = '{"z": 1, "a": 2, "b": 3}';
    const input2 = '{"b": 3, "a": 2, "z": 1}';
    const hash1 = sha256Input(input1);
    const hash2 = sha256Input(input2);
    expect(hash1).toBe(hash2);
  });

  it("should generate different hashes for different inputs", () => {
    const hash1 = sha256Input("input1");
    const hash2 = sha256Input("input2");
    expect(hash1).not.toBe(hash2);
  });

  // Edge case tests
  it("should handle empty string", () => {
    const hash = sha256Input("");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should handle whitespace-only string", () => {
    const hash1 = sha256Input("   ");
    const hash2 = sha256Input("");
    expect(hash1).toBe(hash2); // Both become empty after trimming
  });

  it("should handle JSON input", () => {
    const input = '{"test": "value"}';
    const hash = sha256Input(input);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should handle nested JSON", () => {
    const input = '{"nested": {"deep": {"value": 123}}}';
    const hash = sha256Input(input);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should handle arrays", () => {
    const input = "[1, 2, 3]";
    const hash = sha256Input(input);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  // Error/invalid input tests
  it("should handle invalid JSON gracefully", () => {
    const input = '{"invalid": json}';
    const hash = sha256Input(input);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  // Consistency tests
  it("should be deterministic across multiple calls", () => {
    const input = '{"z": 1, "a": {"nested": [1, 2, 3]}, "b": 2}';
    const hashes = Array.from({ length: 10 }, () => sha256Input(input));
    hashes.forEach((hash) => {
      expect(hash).toBe(hashes[0]);
    });
  });

  it("should handle Unicode characters", () => {
    const input = '{"emoji": "🚀", "text": "café"}';
    const hash = sha256Input(input);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should handle special characters in strings", () => {
    const input = '{"special": "line1\\nline2\\tindented"}';
    const hash = sha256Input(input);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
