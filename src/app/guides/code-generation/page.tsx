import Link from "next/link"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { PublicPageHeader } from "@/components/public-page-header"
import { ArrowLeft } from "lucide-react"

export default function CodeGenerationGuide() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicPageHeader />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 flex-1">
        <Link href="/guides" className="mb-6 sm:mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Back to Guides
        </Link>

        <div className="mb-6 sm:mb-8">
          <h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl font-bold">Code Generation Validation</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Verify syntax, logic, and security when using LLMs to generate code.
          </p>
          <div className="flex items-center gap-3 sm:gap-4 mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground">
            <span>16 min read</span>
            <span>•</span>
            <span>Use Cases</span>
          </div>
        </div>

        <div className="prose prose-sm sm:prose-base max-w-none">
          <h2>The Stakes of Code Generation</h2>
          <p>
            LLMs can write code quickly, but that code can contain bugs, security vulnerabilities, or logic errors 
            that break production systems. Unlike text generation, code must be functionally correct, not just 
            plausible-sounding.
          </p>

          <h2>What to Evaluate</h2>

          <h3>1. Syntax Correctness</h3>
          <p>Does the code parse without errors?</p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Automated check
try {
  eval(generatedCode); // or language-specific parser
  console.log("✓ Syntax valid");
} catch (error) {
  console.error("✗ Syntax error:", error.message);
  assert(false);
}`}
          </div>

          <h3>2. Functional Correctness</h3>
          <p>Does the code produce the expected output?</p>
          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <p className="text-sm mb-2"><strong>Task:</strong> "Write a function to reverse a string"</p>
            <p className="text-sm font-mono mb-1">generatedCode("hello") → "olleh" ✓</p>
            <p className="text-sm font-mono mb-1">generatedCode("") → "" ✓</p>
            <p className="text-sm font-mono mb-0">generatedCode("a") → "a" ✓</p>
          </div>

          <h3>3. Edge Case Handling</h3>
          <p>Does it handle null, empty inputs, large values, etc.?</p>
          <ul>
            <li>Null/undefined inputs</li>
            <li>Empty arrays or strings</li>
            <li>Very large numbers</li>
            <li>Negative numbers where unexpected</li>
            <li>Special characters and unicode</li>
          </ul>

          <h3>4. Security</h3>
          <p>Is the code vulnerable to common attacks?</p>
          <ul>
            <li><strong>SQL injection:</strong> Use parameterized queries</li>
            <li><strong>XSS:</strong> Sanitize user inputs</li>
            <li><strong>Path traversal:</strong> Validate file paths</li>
            <li><strong>eval() usage:</strong> Avoid dynamic code execution</li>
            <li><strong>Secrets in code:</strong> No hardcoded API keys</li>
          </ul>

          <h3>5. Code Quality</h3>
          <ul>
            <li><strong>Readability:</strong> Clear variable names, comments</li>
            <li><strong>Efficiency:</strong> Appropriate time/space complexity</li>
            <li><strong>Best practices:</strong> Follows language conventions</li>
            <li><strong>Maintainability:</strong> Modular, not overly complex</li>
          </ul>

          <h2>Evaluation Framework</h2>

          <h3>Step 1: Syntax Validation</h3>
          <p>Run language-specific parsers/compilers:</p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Python
import ast
try:
    ast.parse(generated_code)
    print("✓ Valid Python syntax")
except SyntaxError as e:
    print(f"✗ Syntax error: {e}")

// JavaScript
const { parse } = require('@babel/parser');
try {
    parse(generatedCode);
    console.log("✓ Valid JS syntax");
} catch (error) {
    console.error("✗ Syntax error:", error.message);
}`}
          </div>

          <h3>Step 2: Unit Test Execution</h3>
          <p>Create comprehensive test suites for generated code:</p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Test case structure
{
  "task": "Implement binary search",
  "tests": [
    { "input": "([1,2,3,4,5], 3)", "expected": 2 },
    { "input": "([1,3,5,7], 4)", "expected": -1 },
    { "input": "([], 1)", "expected": -1 },
    { "input": "([1], 1)", "expected": 0 }
  ]
}

// Automated test runner
const results = tests.map(test => {
  const actual = eval(\`generatedFunction\${test.input}\`);
  return actual === test.expected;
});
const passRate = results.filter(Boolean).length / tests.length;`}
          </div>

          <h3>Step 3: Security Scanning</h3>
          <p>Use static analysis tools to detect vulnerabilities:</p>
          <ul>
            <li><strong>Bandit</strong> (Python security linter)</li>
            <li><strong>ESLint</strong> with security plugins (JavaScript)</li>
            <li><strong>Semgrep</strong> (multi-language security scanner)</li>
            <li><strong>CodeQL</strong> (GitHub's semantic code analysis)</li>
          </ul>

          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Example: Check for common anti-patterns
const securityChecks = {
  hasEval: /eval\\(/.test(code),
  hasExec: /exec\\(/.test(code),
  hardcodedSecrets: /api[_-]?key\\s*=\\s*["']/.test(code),
  sqlInjection: /execute\\(.*\\+.*\\)/.test(code)
};

Object.entries(securityChecks).forEach(([check, failed]) => {
  if (failed) console.error(\`✗ Security issue: \${check}\`);
});`}
          </div>

          <h3>Step 4: Code Quality Analysis</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Check code complexity
const complexity = calculateCyclomaticComplexity(code);
assert(complexity < 10); // Reasonable threshold

// Check naming conventions
const variableNames = extractVariableNames(code);
const hasDescriptiveNames = variableNames.every(name => 
  name.length > 2 && !/^[a-z]$/.test(name)
);
assert(hasDescriptiveNames);

// Check for comments
const commentRatio = countComments(code) / countLines(code);
assert(commentRatio >= 0.1); // 10% comments`}
          </div>

          <h3>Step 5: LLM-as-Judge for Logic</h3>
          <p>Use another LLM to review code logic and design:</p>
          <div className="bg-muted p-4 rounded-lg text-sm my-4">
            <p className="font-semibold mb-2">Judge Prompt:</p>
            <p className="mb-0">
              "Review this code for logical correctness, efficiency, and edge case handling. Score 1-5 on: 
              (1) Correctness: Does the logic match the requirements? (2) Efficiency: Is the time complexity 
              reasonable? (3) Robustness: Does it handle edge cases? Provide specific issues if score &lt; 4."
            </p>
          </div>

          <h2>Common Failure Modes</h2>

          <h3>1. Off-by-One Errors</h3>
          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <p className="text-sm mb-2"><strong>Task:</strong> "Get last element of array"</p>
            <p className="text-sm font-mono mb-1">❌ arr[arr.length] // undefined</p>
            <p className="text-sm font-mono mb-0">✓ arr[arr.length - 1]</p>
          </div>

          <h3>2. Type Coercion Bugs</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4">
{`// JavaScript
"2" + 2 === "22"  // String concatenation, not addition
2 + "2" === "22"  // Same issue

// Need explicit type conversion
parseInt("2") + 2 === 4`}
          </div>

          <h3>3. Missing Null Checks</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4">
{`// Unsafe
function getUsername(user) {
  return user.name.toUpperCase(); // Crashes if user is null
}

// Safe
function getUsername(user) {
  return user?.name?.toUpperCase() ?? "Unknown";
}`}
          </div>

          <h3>4. Inefficient Algorithms</h3>
          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <p className="text-sm mb-2"><strong>Task:</strong> "Check if array contains duplicate"</p>
            <p className="text-sm mb-1">❌ O(n²) nested loops</p>
            <p className="text-sm mb-0">✓ O(n) using Set</p>
          </div>

          <h2>Test Suite Design</h2>

          <h3>Coverage Matrix</h3>
          <p>Ensure your test suite covers all scenarios:</p>
          <table className="w-full my-6 text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2">Category</th>
                <th className="text-left py-2">Example Tests</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="py-2">Happy path</td>
                <td className="py-2">Normal inputs, expected output</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2">Edge cases</td>
                <td className="py-2">Empty, null, single element</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2">Boundaries</td>
                <td className="py-2">Max int, min int, array limits</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2">Error cases</td>
                <td className="py-2">Invalid types, out of bounds</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2">Performance</td>
                <td className="py-2">Large inputs, time limits</td>
              </tr>
            </tbody>
          </table>

          <h3>Example: Comprehensive Test Suite</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`{
  "task": "Implement fibonacci(n)",
  "tests": [
    // Happy path
    { "input": 0, "expected": 0 },
    { "input": 1, "expected": 1 },
    { "input": 5, "expected": 5 },
    { "input": 10, "expected": 55 },
    
    // Edge cases
    { "input": 2, "expected": 1 },
    
    // Boundaries
    { "input": 50, "expected": 12586269025, "timeout": 1000 },
    
    // Error cases
    { "input": -1, "shouldThrow": true },
    { "input": 1.5, "shouldThrow": true },
    { "input": null, "shouldThrow": true }
  ]
}`}
          </div>

          <h2>Best Practices</h2>

          <h3>1. Sandbox Execution</h3>
          <p>Always run generated code in an isolated environment:</p>
          <ul>
            <li>Use Docker containers for isolation</li>
            <li>Set CPU and memory limits</li>
            <li>Implement execution timeouts</li>
            <li>Restrict file system and network access</li>
          </ul>

          <h3>2. Provide Clear Specifications</h3>
          <p>Give the LLM detailed requirements:</p>
          <div className="bg-muted p-4 rounded-lg text-sm my-4">
            <p className="mb-2"><strong>Vague:</strong> "Write a sort function"</p>
            <p className="mb-0"><strong>Clear:</strong> "Write a function sort(arr) that sorts an array of integers 
            in ascending order. Should handle empty arrays and duplicates. Use O(n log n) algorithm."</p>
          </div>

          <h3>3. Iterative Refinement</h3>
          <p>If tests fail, provide feedback and regenerate:</p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Initial generation fails test
const failedTests = runTests(generatedCode);

if (failedTests.length > 0) {
  const feedback = \`These tests failed: \${failedTests}. 
  Please fix the logic errors and regenerate.\`;
  
  // Regenerate with feedback
  const revisedCode = await llm.generate({
    prompt: originalTask,
    feedback: feedback
  });
}`}
          </div>

          <h3>4. Version Control Generated Code</h3>
          <ul>
            <li>Track what prompts generated what code</li>
            <li>Monitor quality trends over time</li>
            <li>Identify which types of tasks fail most</li>
          </ul>

          <h2>Production Deployment</h2>

          <h3>Gradual Rollout</h3>
          <ol>
            <li><strong>Shadow mode:</strong> Generate code but don't execute (compare to human-written)</li>
            <li><strong>Limited pilot:</strong> Use for low-risk tasks only</li>
            <li><strong>Human review:</strong> Require approval before deployment</li>
            <li><strong>Monitoring:</strong> Track errors and rollback if needed</li>
          </ol>

          <h3>Continuous Validation</h3>
          <p>Re-run tests periodically on production code:</p>
          <ul>
            <li>Regression tests after model updates</li>
            <li>Monitor runtime errors and crashes</li>
            <li>A/B test generated vs. hand-written code</li>
          </ul>

          <h2>Real-World Example</h2>
          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <h3 className="mt-0">SQL Query Generation for Analytics</h3>
            <p><strong>Use Case:</strong> Convert natural language to SQL</p>
            <p><strong>Evaluation:</strong></p>
            <ul>
              <li>Syntax validation with SQL parser</li>
              <li>Execute against test database</li>
              <li>Compare results to expected output</li>
              <li>Security scan for injection vulnerabilities</li>
              <li>LLM judge reviews query logic</li>
            </ul>
            <p><strong>Results:</strong></p>
            <ul className="mb-0">
              <li>95% syntax correctness</li>
              <li>87% functional correctness</li>
              <li>100% passed security scans</li>
              <li>Reduced query writing time by 60%</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8 sm:mt-12">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/dashboard">Start Evaluating</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/guides">View All Guides</Link>
          </Button>
        </div>

        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-border">
          <h3 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg">Related Guides</h3>
          <div className="grid gap-3 sm:gap-4">
            <Link href="/guides/llm-judge" className="block p-4 sm:p-5 border border-border rounded-lg hover:border-blue-500 transition-colors">
              <div className="font-semibold mb-1 text-sm sm:text-base">Building Custom LLM Judge Rubrics</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Create code review rubrics</div>
            </Link>
            <Link href="/guides/evaluation-types" className="block p-4 sm:p-5 border border-border rounded-lg hover:border-blue-500 transition-colors">
              <div className="font-semibold mb-1 text-sm sm:text-base">Understanding Evaluation Types</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Choose the right testing approach</div>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}