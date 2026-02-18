import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/__tests__/**/*.test.ts"],
  },
  css: {
    // Disable CSS processing — SDK has no CSS
    modules: { localsConvention: "camelCase" },
  },
});
