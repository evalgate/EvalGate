# GitHub Actions Workflow Template

Copy this to `.github/workflows/evalai.yml`:

```yaml
name: EvalAI CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  evalgate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write  # For GitHub Step Summary
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Needed for impact analysis
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run EvalAI CI
        run: npx evalgate ci --format github --write-results --base ${{ github.base_ref || 'main' }}
        env:
          EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      
      - name: Upload EvalAI artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: evalgate-results-${{ github.sha }}
          path: |
            .evalgate/last-run.json
            .evalgate/runs/
          retention-days: 30
      
      - name: Upload baseline artifact
        if: github.ref == 'refs/heads/main' && success()
        uses: actions/upload-artifact@v4
        with:
          name: evalai-baseline-${{ github.sha }}
          path: .evalgate/last-run.json
          retention-days: 90
```

## 🎯 What This Does

### **CI Pipeline**
- **Triggers**: Push to main/develop, PRs to main/develop
- **Permissions**: Read code + write PR summaries
- **Checkout**: Full history for impact analysis
- **Node**: Setup with caching for speed

### **EvalAI Command**
- **`--format github`**: Rich PR summaries
- **`--write-results`**: Save artifacts
- **`--base ${{ github.base_ref }}`**: Smart base detection
- **Environment**: API keys from secrets

### **Artifacts**
- **Run results**: Latest run + full history
- **Baseline**: Main branch results for future diffs
- **Retention**: 30 days for runs, 90 days for baseline

## 🔧 Customization Options

### **Different Base Branch**
```yaml
- run: npx evalgate ci --format github --write-results --base develop
```

### **No Diff (Run Only)**
```yaml
- run: npx evalgate ci --format github --write-results
```

### **Impact Analysis Only**
```yaml
- run: npx evalgate ci --format github --write-results --base main --impacted-only
```

### **Custom Retention**
```yaml
with:
  retention-days: 7  # Shorter retention
```

### **Additional Environment Variables**
```yaml
env:
  EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  AZURE_OPENAI_ENDPOINT: ${{ secrets.AZURE_OPENAI_ENDPOINT }}
  AZURE_OPENAI_KEY: ${{ secrets.AZURE_OPENAI_KEY }}
```

## 🚀 Quick Setup

1. **Create the workflow file**: `.github/workflows/evalai.yml`
2. **Add secrets** (if needed): `EVALAI_API_KEY`, `OPENAI_API_KEY`, etc.
3. **Push to GitHub**: CI will start automatically

## 📊 What You'll See

### **In PRs**
- ✅ Pass/fail status
- 📊 Pass rate delta and score changes
- 🚨 Regressions detected (if any)
- 📈 Improvements and new specs
- 📁 Links to run artifacts

### **In Artifacts**
- `evalgate-results-*.zip`: All run data
- `evalai-baseline-*.zip`: Main branch baseline

### **Exit Codes**
- **0**: Clean run, no regressions
- **1**: Regressions detected
- **2**: Configuration/infrastructure issues

## 🔍 Debugging

### **Download Artifacts**
1. Go to Actions → Run → Artifacts
2. Download `evalgate-results-*.zip`
3. Extract and run:
   ```bash
   evalai explain --report .evalgate/last-run.json
   ```

### **Local Debugging**
```bash
# Same as CI
npx evalgate ci --format github --write-results --base main

# Impact analysis only
evalai impact-analysis --base main

# Explain failures
evalai explain --report .evalgate/last-run.json
```

---

**Need help?** See [CI Quickstart](CI_QUICKSTART.md) or run `evalai doctor` for setup diagnostics.
