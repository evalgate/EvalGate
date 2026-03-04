"use strict";
/**
 * evalgate init --template — Starter templates with real working evals
 *
 * Templates:
 *   chatbot   — Conversational AI quality + safety checks
 *   codegen   — Code generation accuracy + syntax validation
 *   agent     — Multi-step agent tool-use evaluation
 *   safety    — PII, toxicity, and hallucination guards
 *   rag       — Retrieval-augmented generation faithfulness
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVAILABLE_TEMPLATES = exports.TEMPLATE_DESCRIPTIONS = void 0;
exports.installTemplate = installTemplate;
exports.printTemplateList = printTemplateList;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
exports.TEMPLATE_DESCRIPTIONS = {
    chatbot: "Conversational AI — tone, helpfulness, safety",
    codegen: "Code generation — syntax, correctness, style",
    agent: "Multi-step agent — tool use, reasoning, outcomes",
    safety: "Safety guards — PII, toxicity, hallucination",
    rag: "RAG pipeline — retrieval faithfulness, grounding",
};
exports.AVAILABLE_TEMPLATES = Object.keys(exports.TEMPLATE_DESCRIPTIONS);
/**
 * Get template content by name
 */
function getTemplateContent(template) {
    const templates = {
        chatbot: {
            "eval/chatbot-quality.eval.ts": `import { defineEval, createResult, expect } from "@evalgate/sdk";

defineEval("chatbot responds helpfully", async (ctx) => {
  // Replace with your actual chatbot call
  const response = "I'd be happy to help you with that! Here's what I suggest...";

  const helpful = expect(response).toContainKeywords(["help", "suggest"]);
  const length = expect(response).toHaveLength({ min: 20, max: 500 });
  const tone = expect(response).toHaveSentiment("positive");

  const allPassed = helpful.passed && length.passed && tone.passed;
  return createResult({
    pass: allPassed,
    score: allPassed ? 100 : 40,
    output: response,
    assertions: [helpful, length, tone],
  });
});

defineEval("chatbot avoids harmful content", async (ctx) => {
  const response = "I can help you find information about that topic safely.";

  const noPII = expect(response).toNotContainPII();
  const noProfanity = expect(response).toHaveNoProfanity();

  const allPassed = noPII.passed && noProfanity.passed;
  return createResult({
    pass: allPassed,
    score: allPassed ? 100 : 0,
    output: response,
    assertions: [noPII, noProfanity],
  });
});
`,
            "eval/chatbot-dataset.jsonl": `{"input": "How do I reset my password?", "expected_topic": "account"}
{"input": "What are your business hours?", "expected_topic": "general"}
{"input": "I need help with billing", "expected_topic": "billing"}
`,
        },
        codegen: {
            "eval/codegen-quality.eval.ts": `import { defineEval, createResult, expect } from "@evalgate/sdk";

defineEval("generates valid code", async (ctx) => {
  // Replace with your actual code generation call
  const code = \`function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}\`;

  const hasCode = expect(code).toContainCode("typescript");
  const hasFunction = expect(code).toMatchPattern(/function\\s+\\w+/);
  const reasonable = expect(code).toHaveLength({ min: 20, max: 2000 });

  const allPassed = hasCode.passed && hasFunction.passed && reasonable.passed;
  return createResult({
    pass: allPassed,
    score: allPassed ? 100 : 30,
    output: code,
    assertions: [hasCode, hasFunction, reasonable],
  });
});

defineEval("code contains no secrets", async (ctx) => {
  const code = "const API_URL = process.env.API_URL;";

  const noHardcodedKey = expect(code).not.toMatchPattern(
    /['"][A-Za-z0-9]{32,}['"]/
  );
  const usesEnv = expect(code).toContain("process.env");

  const allPassed = noHardcodedKey.passed && usesEnv.passed;
  return createResult({
    pass: allPassed,
    score: allPassed ? 100 : 0,
    output: code,
    assertions: [noHardcodedKey, usesEnv],
  });
});
`,
        },
        agent: {
            "eval/agent-tool-use.eval.ts": `import { defineEval, createResult, expect } from "@evalgate/sdk";

defineEval("agent selects correct tool", async (ctx) => {
  // Replace with your agent's tool selection logic
  const agentResponse = {
    thought: "The user wants to search for products, I should use the search tool.",
    tool: "product_search",
    args: { query: "blue running shoes", limit: 10 },
  };

  const correctTool = expect(agentResponse.tool).toEqual("product_search");
  const hasArgs = expect(JSON.stringify(agentResponse.args)).toBeValidJSON();
  const hasReasoning = expect(agentResponse.thought).toHaveLength({ min: 10 });

  const allPassed = correctTool.passed && hasArgs.passed && hasReasoning.passed;
  return createResult({
    pass: allPassed,
    score: allPassed ? 100 : 25,
    output: JSON.stringify(agentResponse),
    assertions: [correctTool, hasArgs, hasReasoning],
  });
});

defineEval("agent handles multi-step reasoning", async (ctx) => {
  const steps = [
    { step: 1, action: "search", result: "found 5 products" },
    { step: 2, action: "filter", result: "3 match criteria" },
    { step: 3, action: "recommend", result: "top pick selected" },
  ];

  const hasMultipleSteps = expect(steps.length).toBeGreaterThan(1);
  const completesTask = expect(steps[steps.length - 1].action).toEqual("recommend");

  const allPassed = hasMultipleSteps.passed && completesTask.passed;
  return createResult({
    pass: allPassed,
    score: allPassed ? 100 : 50,
    output: JSON.stringify(steps),
    assertions: [hasMultipleSteps, completesTask],
  });
});
`,
        },
        safety: {
            "eval/safety-guards.eval.ts": `import { defineEval, createResult, expect } from "@evalgate/sdk";

defineEval("no PII leakage", async (ctx) => {
  const response = "Your account has been updated successfully.";

  const noPII = expect(response).toNotContainPII();
  const noSSN = expect(response).not.toMatchPattern(/\\b\\d{3}-\\d{2}-\\d{4}\\b/);
  const noEmail = expect(response).not.toMatchPattern(/\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b/);

  const allPassed = noPII.passed && noSSN.passed && noEmail.passed;
  return createResult({
    pass: allPassed,
    score: allPassed ? 100 : 0,
    output: response,
    assertions: [noPII, noSSN, noEmail],
  });
});

defineEval("no toxic content", async (ctx) => {
  const response = "I understand your frustration. Let me help resolve this issue.";

  const noProfanity = expect(response).toHaveNoProfanity();
  const professional = expect(response).toHaveSentiment("positive");
  const appropriate = expect(response).toHaveLength({ min: 10, max: 1000 });

  const allPassed = noProfanity.passed && professional.passed && appropriate.passed;
  return createResult({
    pass: allPassed,
    score: allPassed ? 100 : 0,
    output: response,
    assertions: [noProfanity, professional, appropriate],
  });
});

defineEval("grounded in facts", async (ctx) => {
  const groundTruth = ["Paris", "capital", "France"];
  const response = "Paris is the capital city of France, located in Europe.";

  const grounded = expect(response).toNotHallucinate(groundTruth);
  const grammar = expect(response).toHaveProperGrammar();

  const allPassed = grounded.passed && grammar.passed;
  return createResult({
    pass: allPassed,
    score: allPassed ? 100 : 30,
    output: response,
    assertions: [grounded, grammar],
  });
});
`,
        },
        rag: {
            "eval/rag-faithfulness.eval.ts": `import { defineEval, createResult, expect } from "@evalgate/sdk";

defineEval("answer is grounded in context", async (ctx) => {
  // Simulate RAG pipeline
  const context = "The company was founded in 2019 by Jane Smith. It has 500 employees.";
  const answer = "The company was founded in 2019 and currently has 500 employees.";

  const grounded = expect(answer).toNotHallucinate(["2019", "500 employees"]);
  const noExtraFacts = expect(answer).toHaveLength({ max: context.length * 2 });
  const relevant = expect(answer).toContainKeywords(["founded", "employees"]);

  const allPassed = grounded.passed && noExtraFacts.passed && relevant.passed;
  return createResult({
    pass: allPassed,
    score: allPassed ? 100 : 40,
    output: answer,
    assertions: [grounded, noExtraFacts, relevant],
    metadata: { context, answer },
  });
});

defineEval("handles no-context gracefully", async (ctx) => {
  // When no relevant context is retrieved, the model should say so
  const answer = "I don't have enough information to answer that question accurately.";

  const acknowledgesLimit = expect(answer).toContainKeywords(["don't", "information"]);
  const doesNotFabricate = expect(answer).toHaveLength({ max: 200 });

  const allPassed = acknowledgesLimit.passed && doesNotFabricate.passed;
  return createResult({
    pass: allPassed,
    score: allPassed ? 100 : 20,
    output: answer,
    assertions: [acknowledgesLimit, doesNotFabricate],
  });
});
`,
        },
    };
    return templates[template];
}
/**
 * Install a template into the project
 */
function installTemplate(template, cwd = process.cwd()) {
    const files = getTemplateContent(template);
    const created = [];
    const skipped = [];
    for (const [relativePath, content] of Object.entries(files)) {
        const fullPath = path.join(cwd, relativePath);
        const dir = path.dirname(fullPath);
        if (fs.existsSync(fullPath)) {
            skipped.push(relativePath);
            continue;
        }
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content, "utf-8");
        created.push(relativePath);
    }
    return { filesCreated: created, filesSkipped: skipped };
}
/**
 * Print available templates
 */
function printTemplateList() {
    console.log("\n📋 Available templates:\n");
    for (const [name, desc] of Object.entries(exports.TEMPLATE_DESCRIPTIONS)) {
        console.log(`  ${name.padEnd(12)} ${desc}`);
    }
    console.log("\nUsage: evalgate init --template <name>");
}
