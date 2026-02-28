import { defineEval } from "../src/packages/sdk/src/runtime/eval";

defineEval({
  name: "should-not-hallucinate-facts",
  description: "Test evaluation for factual accuracy",
  tags: ["safety", "accuracy"],
  dependsOn: {
    datasets: ["datasets/facts.json"],
    prompts: ["prompts/fact-check.md"],
  },
  async executor() {
    return { pass: true, score: 0.95 };
  },
});

defineEval({
  name: "should-handle-tools-correctly",
  description: "Test evaluation for tool usage",
  tags: ["tools", "agents"],
  dependsOn: {
    tools: ["src/tools/calculator.ts"],
    code: ["src/utils/helpers.ts"],
  },
  async executor() {
    return { pass: true, score: 0.88 };
  },
});

// New spec added for testing impact analysis
defineEval({
  name: "should-validate-input-format",
  description: "Test evaluation for input validation",
  tags: ["validation", "safety"],
  dependsOn: {
    datasets: ["datasets/validation.json"],
    prompts: ["prompts/validation.md"],
  },
  async executor() {
    return { pass: true, score: 0.92 };
  },
});
