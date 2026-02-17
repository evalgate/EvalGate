#!/usr/bin/env node
/**
 * evalai — EvalAI CLI
 *
 * Commands:
 *   evalai check  — CI/CD evaluation gate (see evalai check --help)
 */

import { parseArgs, runCheck } from './check';

const argv = process.argv.slice(2);
const subcommand = argv[0];

if (subcommand === 'check') {
  const args = parseArgs(argv.slice(1));
  runCheck(args)
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`EvalAI ERROR: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(4);
    });
} else {
  console.log(`EvalAI CLI

Usage:
  evalai check [options]   CI/CD evaluation gate

Options for check:
  --evaluationId <id>  Required. Evaluation to gate on.
  --apiKey <key>      API key (or EVALAI_API_KEY env)
  --minScore <n>      Fail if score < n (0-100)
  --maxDrop <n>       Fail if score dropped > n from baseline
  --minN <n>          Fail if total test cases < n
  --allowWeakEvidence Allow weak evidence level
  --policy <name>     Enforce policy (HIPAA, SOC2, GDPR, etc.)
  --baseline <mode>   "published" or "previous"
  --baseUrl <url>     API base URL

Examples:
  evalai check --minScore 92 --evaluationId 42 --apiKey $EVALAI_API_KEY
  evalai check --policy HIPAA --evaluationId 42 --apiKey $EVALAI_API_KEY
`);
  process.exit(subcommand === '--help' || subcommand === '-h' ? 0 : 1);
}
