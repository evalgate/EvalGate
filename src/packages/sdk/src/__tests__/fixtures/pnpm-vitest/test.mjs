import { describe, it } from "node:test";
import assert from "node:assert";

describe("vitest-style", () => {
  it("adds numbers", () => {
    assert.strictEqual(2 + 3, 5);
  });
  it("string concat", () => {
    assert.strictEqual("a" + "b", "ab");
  });
  it("truthiness", () => {
    assert.ok(true);
  });
});
