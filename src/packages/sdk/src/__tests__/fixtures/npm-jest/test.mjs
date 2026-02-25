import { describe, it } from "node:test";
import assert from "node:assert";

describe("sample", () => {
  it("passes", () => {
    assert.strictEqual(1 + 1, 2);
  });
  it("also passes", () => {
    assert.ok(true);
  });
});
