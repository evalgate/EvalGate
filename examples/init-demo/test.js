/**
 * 3 trivial tests — used by evalgate gate to compare against baseline.
 * Break one to see regression: change assert.strictEqual(1 + 1, 2) to assert.strictEqual(1, 2).
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
