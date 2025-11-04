# Python Examples

This directory contains practical examples for using the AI Evaluation Platform SDK in Python applications.

## Setup

1. **Create a virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your API key
   ```

4. **Get your API key:**
   - Go to [Developer Dashboard](https://your-platform-url.com/developer)
   - Scroll to API Keys section
   - Click "Create API Key"
   - Copy the key to your `.env` file

## Examples

### Demo Evaluation (`demo_eval.py`)

Runs a complete evaluation against a demo dataset and saves results.

```bash
python demo_eval.py
```

**What it does:**
- Creates an evaluation with factuality and toxicity metrics
- Runs against the public demo chatbot dataset
- Saves results to `demo-run.json`
- Displays summary statistics

## Usage in CI/CD

### GitHub Actions

```yaml
name: AI Quality Check (Python)

on: [push, pull_request]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      
      - name: Install dependencies
        run: |
          cd examples/python
          pip install -r requirements.txt
      
      - name: Run evaluation
        env:
          EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}
        run: |
          cd examples/python
          python demo_eval.py
```

## Learn More

- [SDK Documentation](https://your-platform-url.com/sdk)
- [API Reference](https://your-platform-url.com/api-reference)
- [Python SDK on PyPI](https://pypi.org/project/evalai-sdk/)

## Support

Need help? Contact us at support@your-platform.com or join our [Discord community](https://discord.gg/your-invite).
