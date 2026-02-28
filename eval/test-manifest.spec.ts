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
