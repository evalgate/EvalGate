# Node.js Examples

This directory contains practical examples for using the AI Evaluation Platform SDK in Node.js applications.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your API key
   ```

3. **Get your API key:**
   - Go to [Developer Dashboard](https://your-platform-url.com/developer)
   - Scroll to API Keys section
   - Click "Create API Key"
   - Copy the key to your `.env` file

## Examples

### 1. Demo Evaluation Run (`demo-run.js`)

Runs a complete evaluation against a demo dataset and saves results.

```bash
npm run demo
```

**What it does:**
- Creates an evaluation with factuality and toxicity metrics
- Runs against the public demo chatbot dataset
- Saves results to `demo-run.json`
- Displays summary statistics

### 2. CI/CD Assertion (`assert-eval.js`)

Validates evaluation results against quality thresholds for CI/CD pipelines.

```bash
npm run assert
```

**What it does:**
- Reads results from `demo-run.json`
- Checks against predefined thresholds
- Exits with code 0 (pass) or 1 (fail)
- Perfect for GitHub Actions, GitLab CI, etc.

**Thresholds:**
- Overall score: ≥ 0.85
- Factuality: ≥ 0.90
- Toxicity: ≤ 0.05
- Latency: ≤ 2000ms

### 3. Tracing Example (`trace-example.js`)

Demonstrates how to create traces and spans for monitoring LLM operations.

```bash
npm run trace
```

**What it does:**
- Creates a trace for a chat completion
- Adds spans for LLM call and validation
- Retrieves and displays trace summary
- Shows total latency and cost

## Usage in CI/CD

### GitHub Actions

```yaml
name: AI Quality Check

on: [push, pull_request]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd examples/node
          npm install
      
      - name: Run evaluation
        env:
          EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}
        run: |
          cd examples/node
          npm run demo
      
      - name: Assert quality
        run: |
          cd examples/node
          npm run assert
```

### GitLab CI

```yaml
ai-quality-check:
  image: node:18
  script:
    - cd examples/node
    - npm install
    - npm run demo
    - npm run assert
  variables:
    EVALAI_API_KEY: $EVALAI_API_KEY
```

## Customization

### Modify Thresholds

Edit `assert-eval.js` to adjust quality thresholds:

```javascript
const THRESHOLDS = {
  overall: 0.85,      // Your minimum overall score
  factuality: 0.90,   // Your minimum factuality
  toxicity: 0.05,     // Your maximum toxicity
  latency: 2000,      // Your maximum latency (ms)
};
```

### Add Custom Metrics

Modify `demo-run.js` to include additional metrics:

```javascript
const result = await client.evaluations.create({
  datasetId: 'your-dataset-id',
  metrics: ['factuality', 'toxicity', 'relevance', 'coherence'],
  // ... other options
});
```

## Learn More

- [SDK Documentation](https://your-platform-url.com/sdk)
- [API Reference](https://your-platform-url.com/api-reference)
- [Guides](https://your-platform-url.com/guides)

## Support

Need help? Contact us at support@your-platform.com or join our [Discord community](https://discord.gg/your-invite).
