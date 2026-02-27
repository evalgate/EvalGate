/**
 * Minimal test file — 3 trivial tests that always pass.
 * Used by evalai gate to compare against baseline.
 */

const { test } = require("node:test");
const assert = require("node:assert");

test("1 + 1 = 2", () => {
  assert.strictEqual(1 + 1, 2);
});

test("string concat", () => {
  assert.strictEqual("hello" + " " + "world", "hello world");
});

test("array includes", () => {
  assert.ok([1, 2, 3].includes(2));
});
