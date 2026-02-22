# @pauly4010/evalai-sdk

[![npm version](https://img.shields.io/npm/v/@pauly4010/evalai-sdk.svg)](https://www.npmjs.com/package/@pauly4010/evalai-sdk)  
[![npm downloads](https://img.shields.io/npm/dm/@pauly4010/evalai-sdk.svg)](https://www.npmjs.com/package/@pauly4010/evalai-sdk)

**Stop LLM regressions in CI in minutes.**

Evaluate locally in 60 seconds. Add an optional CI gate in 2 minutes.  
No lock-in — remove by deleting `evalai.config.json`.

---

# 🚀 1) 60 seconds: Run locally (no account)

Install, run, get a score.  
No EvalAI account. No API key. No dashboard required.

```bash
npm install @pauly4010/evalai-sdk openai
import { openAIChatEval } from "@pauly4010/evalai-sdk";

await openAIChatEval({
  name: "chat-regression",
  cases: [
    { input: "Hello", expectedOutput: "greeting" },
    { input: "2 + 2 = ?", expectedOutput: "4" },
  ],
});
Set:

OPENAI_API_KEY=...
✅ Vitest integration (recommended)
import {
  openAIChatEval,
  extendExpectWithToPassGate,
} from "@pauly4010/evalai-sdk";
import { expect } from "vitest";

extendExpectWithToPassGate(expect);

it("passes gate", async () => {
  const result = await openAIChatEval({
    name: "chat-regression",
    cases: [
      { input: "Hello", expectedOutput: "greeting" },
      { input: "2 + 2 = ?", expectedOutput: "4" },
    ],
  });

  expect(result).toPassGate();
});
Example output
PASS 2/2 (score: 100)

Tip: Want dashboards and history?
Set EVALAI_API_KEY and connect this to the platform.
Failures show:

FAIL 9/10 (score: 90)
with failed cases and CI guidance.

⚡ 2) Optional: Add a CI gate (2 minutes)
When you're ready to gate PRs on quality and regressions:

npx -y @pauly4010/evalai-sdk@^1 init
Create an evaluation in the dashboard and paste its ID into:

{
  "evaluationId": "42"
}
Add to your CI:

- name: EvalAI gate
  env:
    EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}
  run: npx -y @pauly4010/evalai-sdk@^1 check --format github --onFail import --warnDrop 1
You’ll get:

GitHub annotations

Step summary

Optional dashboard link

PASS / WARN / FAIL (v1.5.7)
EvalAI introduces a WARN band so teams can see meaningful regressions without always blocking merges.

Behavior

PASS → within thresholds

WARN → regression > warnDrop but < maxDrop

FAIL → regression > maxDrop

Key flags

--warnDrop → soft regression warning

--maxDrop → hard regression fail

--fail-on-flake → fail if unknown test is unstable

This lets teams tune signal vs noise in CI.

🔒 3) No lock-in
To stop using EvalAI:

rm evalai.config.json
Your local openAIChatEval runs continue to work exactly the same.

No account cancellation. No data export required.

📦 Installation
npm install @pauly4010/evalai-sdk openai
# or
yarn add @pauly4010/evalai-sdk openai
# or
pnpm add @pauly4010/evalai-sdk openai
🖥️ Environment Support
This SDK works in both Node.js and browsers, with some Node-only features.

✅ Works Everywhere (Node.js + Browser)
Traces API

Evaluations API

LLM Judge API

Annotations API

Developer API (API Keys, Webhooks, Usage)

Organizations API

Assertions Library

Test Suites

Error Handling

CJS/ESM Compatibility

🟡 Node.js Only
These require Node.js:

Snapshot Testing

Local Storage Mode

CLI Tool

Export to File

🔄 Context Propagation
Node.js: full async context via AsyncLocalStorage

Browser: basic support (not safe across all async boundaries)

🧠 AIEvalClient (Platform API)
import { AIEvalClient } from "@pauly4010/evalai-sdk";

// From env
const client = AIEvalClient.init();

// Explicit
const client2 = new AIEvalClient({
  apiKey: "your-api-key",
  organizationId: 123,
  debug: true,
});
🧪 evalai CLI (v1.5.7)
The CLI gates deployments on quality, regression, and policy.

Quick start
npx -y @pauly4010/evalai-sdk@^1 check \
  --evaluationId 42 \
  --apiKey $EVALAI_API_KEY
evalai check
Option	Description
--evaluationId <id>	Required. Evaluation to gate on
--apiKey <key>	API key (or EVALAI_API_KEY)
--format <fmt>	human, json, or github
--onFail import	Import failing run to dashboard
--explain	Show score breakdown
--minScore <n>	Fail if score < n
--warnDrop <n>	Warn if regression exceeds n
--maxDrop <n>	Fail if regression exceeds n
--minN <n>	Fail if test count < n
--allowWeakEvidence	Permit weak evidence
--policy <name>	HIPAA, SOC2, GDPR, PCI_DSS, FINRA_4511
--baseline <mode>	published, previous, production
--fail-on-flake	Fail if unknown case is flaky
--baseUrl <url>	Override API base URL

Exit codes
Code	Meaning
0	PASS
8	WARN
1	Score below threshold
2	Regression failure
3	Policy violation
4	API error
5	Bad arguments
6	Low test count
7	Weak evidence
evalai doctor
Verify CI setup before running the gate:

npx -y @pauly4010/evalai-sdk@^1 doctor \
  --evaluationId 42 \
  --apiKey $EVALAI_API_KEY
If doctor passes, check will work.

🧯 Error Handling
import { EvalAIError, RateLimitError } from "@pauly4010/evalai-sdk";

try {
  await client.traces.create({ name: "User Query" });
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log("Retry after:", err.retryAfter);
  } else if (err instanceof EvalAIError) {
    console.log(err.code, err.message, err.requestId);
  }
}


🔍 Traces
const trace = await client.traces.create({
  name: "User Query",
  traceId: "trace-123",
  metadata: { userId: "456" },
});


📝 Evaluations
import { EvaluationTemplates } from "@pauly4010/evalai-sdk";

const evaluation = await client.evaluations.create({
  name: "Chatbot Responses",
  type: EvaluationTemplates.OUTPUT_QUALITY,
  createdBy: userId,
});


🔌 Framework Integrations
import { traceOpenAI } from "@pauly4010/evalai-sdk/integrations/openai";
import OpenAI from "openai";

const openai = traceOpenAI(new OpenAI(), client);

await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello" }],
});


🧭 Changelog
v1.5.8 (Latest)
Fixed secureRoute TypeScript overload compatibility

Fixed test infrastructure (expect.any, NextRequest constructor)

Fixed 304 response handling in exports API

Improved error catalog test coverage

v1.5.7
Documentation updates for CJS compatibility

Version alignment across README and changelog

Environment support section updated

v1.5.6
PASS/WARN/FAIL gate semantics

--warnDrop soft regression band

Flake intelligence + per-case pass rates

--fail-on-flake enforcement

Golden regression suite

Nightly determinism + performance audits

Audit trail, observability, retention, and migration safety docs

CJS compatibility for all subpath exports

v1.5.0
GitHub annotations formatter

JSON formatter

--onFail import

--explain

evalai doctor

CI pinned invocation guidance


Environment Variable Safety

The SDK never assumes `process.env` exists. All environment reads are guarded, so the client can initialize safely in browser, edge, and server runtimes.

If environment variables are unavailable, the SDK falls back to explicit config.


📄 License
MIT

🤝 Support
Documentation:
https://v0-ai-evaluation-platform-nu.vercel.app/documentation

Issues:
https://github.com/pauly7610/ai-evaluation-platform/issues
```
