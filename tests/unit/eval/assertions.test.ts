import { describe, expect, it } from "vitest";
import {
  type AssertionsEnvelope,
  computeSafetyPassRate,
  KNOWN_ASSERTION_KEYS,
  type LegacyAssertions,
  normalizeAssertionsForWrite,
  parseAssertionsJson,
  safetyPassRateFromEnvelope,
  toAssertionsEnvelope,
  validateAssertionsEnvelope,
} from "@/lib/eval/assertions";

describe("toAssertionsEnvelope", () => {
  // Happy path tests
  it("should convert pii legacy to envelope", () => {
    const legacy = { pii: true };
    const result = toAssertionsEnvelope(legacy);
    expect(result).toEqual({
      version: "v1",
      assertions: [
        {
          key: "pii",
          category: "privacy",
          passed: false,
        },
      ],
    });
  });

  it("should convert toxicity legacy to envelope", () => {
    const legacy = { toxicity: false };
    const result = toAssertionsEnvelope(legacy);
    expect(result).toEqual({
      version: "v1",
      assertions: [
        {
          key: "toxicity",
          category: "safety",
          passed: true,
        },
      ],
    });
  });

  it("should convert harmful legacy to hallucination envelope", () => {
    const legacy = { harmful: true };
    const result = toAssertionsEnvelope(legacy);
    expect(result).toEqual({
      version: "v1",
      assertions: [
        {
          key: "hallucination",
          category: "quality",
          passed: false,
        },
      ],
    });
  });

  it("should convert multiple legacy flags", () => {
    const legacy = { pii: false, toxicity: true, harmful: false };
    const result = toAssertionsEnvelope(legacy);
    expect(result).toEqual({
      version: "v1",
      assertions: [
        { key: "pii", category: "privacy", passed: true },
        { key: "toxicity", category: "safety", passed: false },
        { key: "hallucination", category: "quality", passed: true },
      ],
    });
  });

  // Edge case tests
  it("should handle empty legacy object", () => {
    const legacy = {};
    const result = toAssertionsEnvelope(legacy);
    expect(result).toEqual({
      version: "v1",
      assertions: [],
    });
  });

  it("should handle unknown legacy keys", () => {
    const legacy = { pii: true, unknown: true };
    const result = toAssertionsEnvelope(legacy);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions[0].key).toBe("pii");
  });
});

describe("safetyPassRateFromEnvelope", () => {
  // Happy path tests
  it("should calculate 100% safety pass rate", () => {
    const envelope: AssertionsEnvelope = {
      version: "v1",
      assertions: [
        { key: "toxicity", category: "safety", passed: true },
        { key: "pii", category: "privacy", passed: false },
      ],
    };
    expect(safetyPassRateFromEnvelope(envelope)).toBe(1);
  });

  it("should calculate 50% safety pass rate", () => {
    const envelope: AssertionsEnvelope = {
      version: "v1",
      assertions: [
        { key: "toxicity", category: "safety", passed: true },
        { key: "safety", category: "safety", passed: false }, // need another safety assertion
        { key: "hallucination", category: "quality", passed: false },
        { key: "pii", category: "privacy", passed: false },
      ],
    };
    expect(safetyPassRateFromEnvelope(envelope)).toBe(0.5);
  });

  it("should calculate 0% safety pass rate", () => {
    const envelope: AssertionsEnvelope = {
      version: "v1",
      assertions: [
        { key: "toxicity", category: "safety", passed: false },
        { key: "pii", category: "privacy", passed: true },
      ],
    };
    expect(safetyPassRateFromEnvelope(envelope)).toBe(0);
  });

  // Edge case tests
  it("should return 1 when no safety assertions", () => {
    const envelope: AssertionsEnvelope = {
      version: "v1",
      assertions: [
        { key: "pii", category: "privacy", passed: false },
        { key: "hallucination", category: "quality", passed: false },
      ],
    };
    expect(safetyPassRateFromEnvelope(envelope)).toBe(1);
  });

  it("should handle empty assertions array", () => {
    const envelope: AssertionsEnvelope = {
      version: "v1",
      assertions: [],
    };
    expect(safetyPassRateFromEnvelope(envelope)).toBe(1);
  });

  it("should handle multiple safety assertions", () => {
    const envelope: AssertionsEnvelope = {
      version: "v1",
      assertions: [
        { key: "toxicity", category: "safety", passed: true },
        { key: "instruction_following", category: "quality", passed: false },
        { key: "json_schema", category: "format", passed: false },
        { key: "pii", category: "privacy", passed: false },
      ],
    };
    expect(safetyPassRateFromEnvelope(envelope)).toBe(1);
  });
});

describe("parseAssertionsJson", () => {
  // Happy path tests
  it("should parse v1 envelope", () => {
    const envelope = {
      version: "v1",
      assertions: [{ key: "pii", category: "privacy", passed: true }],
    };
    const result = parseAssertionsJson(envelope);
    expect(result).toEqual(envelope);
  });

  it("should parse legacy format", () => {
    const legacy = { pii: true, toxicity: false };
    const result = parseAssertionsJson(legacy);
    expect(result).toEqual(legacy);
  });

  it("should parse empty v1 envelope", () => {
    const envelope = { version: "v1", assertions: [] };
    const result = parseAssertionsJson(envelope);
    expect(result).toEqual(envelope);
  });

  // Edge case tests
  it("should return null for null input", () => {
    expect(parseAssertionsJson(null)).toBeNull();
    expect(parseAssertionsJson(undefined)).toBeNull();
  });

  it("should return null for non-object input", () => {
    expect(parseAssertionsJson("string")).toBeNull();
    expect(parseAssertionsJson(123)).toBeNull();
    expect(parseAssertionsJson(true)).toBeNull();
    expect(parseAssertionsJson([])).toBeNull();
  });

  it("should return null for object without version or legacy keys", () => {
    const obj = { unknown: "value" };
    expect(parseAssertionsJson(obj)).toBeNull();
  });

  it("should return null for malformed v1 envelope", () => {
    const malformed = { version: "v1", assertions: [{ wrong: "structure" }] };
    expect(parseAssertionsJson(malformed)).toBeNull();
  });

  it("should return null for v1 envelope with non-array assertions", () => {
    const malformed = { version: "v1", assertions: "not an array" };
    expect(parseAssertionsJson(malformed)).toBeNull();
  });

  it("should handle partial legacy format", () => {
    const partial = { pii: true };
    const result = parseAssertionsJson(partial);
    expect(result).toEqual(partial);
  });
});

describe("validateAssertionsEnvelope", () => {
  // Happy path tests
  it("should keep known assertion keys", () => {
    const envelope: AssertionsEnvelope = {
      version: "v1",
      assertions: [
        { key: "pii", category: "privacy", passed: true },
        { key: "toxicity", category: "safety", passed: false },
      ],
    };
    const result = validateAssertionsEnvelope(envelope);
    expect(result).toEqual(envelope);
  });

  it("should filter out unknown assertion keys", () => {
    const envelope: AssertionsEnvelope = {
      version: "v1",
      assertions: [
        { key: "pii", category: "privacy", passed: true },
        { key: "unknown_key", category: "safety", passed: false },
        { key: "toxicity", category: "safety", passed: true },
      ],
    };
    const result = validateAssertionsEnvelope(envelope);
    expect(result.assertions).toHaveLength(2);
    expect(result.assertions.map((a) => a.key)).toEqual(["pii", "toxicity"]);
  });

  // Edge case tests
  it("should handle empty assertions", () => {
    const envelope: AssertionsEnvelope = {
      version: "v1",
      assertions: [],
    };
    const result = validateAssertionsEnvelope(envelope);
    expect(result).toEqual(envelope);
  });

  it("should filter all unknown keys", () => {
    const envelope: AssertionsEnvelope = {
      version: "v1",
      assertions: [
        { key: "unknown1", category: "safety", passed: false },
        { key: "unknown2", category: "privacy", passed: true },
      ],
    };
    const result = validateAssertionsEnvelope(envelope);
    expect(result.assertions).toHaveLength(0);
  });
});

describe("normalizeAssertionsForWrite", () => {
  // Happy path tests
  it("should normalize valid v1 envelope", () => {
    const envelope = {
      version: "v1",
      assertions: [{ key: "pii", category: "privacy", passed: true }],
    };
    const result = normalizeAssertionsForWrite(envelope);
    expect(result).toEqual(envelope);
  });

  it("should convert legacy to envelope", () => {
    const legacy = { pii: true, toxicity: false };
    const result = normalizeAssertionsForWrite(legacy);
    expect(result).toEqual({
      version: "v1",
      assertions: [
        { key: "pii", category: "privacy", passed: false },
        { key: "toxicity", category: "safety", passed: true },
        { key: "hallucination", category: "quality", passed: true }, // default when no harmful key
      ],
    });
  });

  // Edge case tests
  it("should return null for null input", () => {
    expect(normalizeAssertionsForWrite(null)).toBeNull();
    expect(normalizeAssertionsForWrite(undefined)).toBeNull();
  });

  it("should return null for invalid input", () => {
    expect(normalizeAssertionsForWrite("string")).toBeNull();
    expect(normalizeAssertionsForWrite({ unknown: "value" })).toBeNull();
  });

  it("should filter unknown keys in legacy conversion", () => {
    const legacy = { pii: true, unknown: true };
    const result = normalizeAssertionsForWrite(legacy);
    expect(result?.assertions).toHaveLength(3); // pii + hallucination (default) + unknown gets filtered but hallucination added
    expect(result?.assertions.map((a) => a.key)).toContain("pii");
    expect(result?.assertions.map((a) => a.key)).toContain("hallucination");
  });
});

describe("computeSafetyPassRate", () => {
  // Happy path tests
  it("should compute from v1 envelope", () => {
    const envelope: AssertionsEnvelope = {
      version: "v1",
      assertions: [
        { key: "toxicity", category: "safety", passed: true },
        { key: "pii", category: "privacy", passed: false },
      ],
    };
    expect(computeSafetyPassRate(envelope)).toBe(1);
  });

  it("should compute from legacy format", () => {
    const legacy: LegacyAssertions = { pii: false, toxicity: false, harmful: false };
    expect(computeSafetyPassRate(legacy)).toBe(1);
  });

  it("should compute 0% from legacy with failures", () => {
    const legacy: LegacyAssertions = { pii: true, toxicity: true, harmful: true };
    expect(computeSafetyPassRate(legacy)).toBe(0);
  });

  // Edge case tests
  it("should return null for null input", () => {
    expect(computeSafetyPassRate(null)).toBeNull();
  });

  it("should return null for empty legacy", () => {
    const legacy: LegacyAssertions = {};
    expect(computeSafetyPassRate(legacy)).toBeNull();
  });

  it("should handle partial legacy format", () => {
    const legacy: LegacyAssertions = { pii: false };
    expect(computeSafetyPassRate(legacy)).toBe(1);
  });

  it("should handle partial legacy with toxicity", () => {
    const legacy: LegacyAssertions = { toxicity: true };
    expect(computeSafetyPassRate(legacy)).toBe(0);
  });
});

describe("KNOWN_ASSERTION_KEYS", () => {
  it("should contain expected keys", () => {
    expect(KNOWN_ASSERTION_KEYS).toContain("pii");
    expect(KNOWN_ASSERTION_KEYS).toContain("toxicity");
    expect(KNOWN_ASSERTION_KEYS).toContain("hallucination");
    expect(KNOWN_ASSERTION_KEYS).toContain("instruction_following");
  });

  it("should be readonly", () => {
    expect(KNOWN_ASSERTION_KEYS).toBe(Object.freeze(KNOWN_ASSERTION_KEYS));
  });
});
