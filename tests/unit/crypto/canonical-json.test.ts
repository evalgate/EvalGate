import { describe, expect, it } from "vitest";
import { canonicalizeJson } from "@/lib/crypto/canonical-json";

describe("canonicalizeJson", () => {
  // Happy path tests
  it("should handle primitive types", () => {
    expect(canonicalizeJson(null)).toBe("null");
    expect(canonicalizeJson(true)).toBe("true");
    expect(canonicalizeJson(false)).toBe("false");
    expect(canonicalizeJson(42)).toBe("42");
    expect(canonicalizeJson(3.14)).toBe("3.14");
    expect(canonicalizeJson("hello")).toBe('"hello"');
    expect(canonicalizeJson("")).toBe('""');
  });

  it("should canonicalize objects with sorted keys", () => {
    const obj1 = { b: 2, a: 1 };
    const obj2 = { a: 1, b: 2 };
    expect(canonicalizeJson(obj1)).toBe(canonicalizeJson(obj2));
    expect(canonicalizeJson(obj1)).toBe('{"a":1,"b":2}');
  });

  it("should handle nested objects", () => {
    const obj = { c: { y: 2, x: 1 }, a: 1, b: { d: 3 } };
    expect(canonicalizeJson(obj)).toBe('{"a":1,"b":{"d":3},"c":{"x":1,"y":2}}');
  });

  it("should handle arrays", () => {
    const arr = [3, 1, 2];
    expect(canonicalizeJson(arr)).toBe("[3,1,2]");
  });

  it("should handle arrays with mixed types", () => {
    const arr = [1, "two", { three: 3 }, [4]];
    expect(canonicalizeJson(arr)).toBe('[1,"two",{"three":3},[4]]');
  });

  // Edge case tests
  it("should handle empty objects and arrays", () => {
    expect(canonicalizeJson({})).toBe("{}");
    expect(canonicalizeJson([])).toBe("[]");
  });

  it("should handle deeply nested structures", () => {
    const deep = { a: { b: { c: { d: { e: "deep" } } } } };
    expect(canonicalizeJson(deep)).toBe('{"a":{"b":{"c":{"d":{"e":"deep"}}}}}');
  });

  it("should handle special number values", () => {
    expect(canonicalizeJson(0)).toBe("0");
    expect(canonicalizeJson(-1)).toBe("-1");
    expect(canonicalizeJson(Infinity)).toBe("null");
    expect(canonicalizeJson(NaN)).toBe("null");
  });

  it("should handle undefined values", () => {
    const obj = { a: 1, b: undefined };
    // undefined becomes undefined when stringified, which our function treats as null
    expect(canonicalizeJson(obj)).toBe('{"a":1,"b":null}');
  });

  // Error path tests
  it("should handle functions by converting to null", () => {
    const obj = { a: 1, b: () => {} };
    expect(canonicalizeJson(obj)).toBe('{"a":1,"b":null}');
  });

  it("should handle symbols by converting to null", () => {
    const obj = { a: 1, b: Symbol("test") };
    expect(canonicalizeJson(obj)).toBe('{"a":1,"b":null}');
  });

  it("should handle circular references by throwing", () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    // The function doesn't handle circular references, which is expected behavior
    expect(() => canonicalizeJson(obj)).toThrow("Maximum call stack size exceeded");
  });
});
