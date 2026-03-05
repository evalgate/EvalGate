# 📤 Exporting and Sharing Evaluations

Complete guide to exporting evaluation results and sharing them publicly.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Export Options](#export-options)
3. [Publishing as Demo](#publishing-as-demo)
4. [Sharing Links](#sharing-links)
5. [Re-importing Data](#re-importing-data)
6. [API Methods](#api-methods)
7. [Best Practices](#best-practices)

---

## Quick Start

### Export an Evaluation

1. Navigate to your evaluation detail page
2. Click the **Export** button in the header
3. Choose your export options:
   - **Download only**: Get a JSON file
   - **Publish as demo**: Make it publicly accessible

### Share an Evaluation

1. Click **Export** → Check "Make this export public as demo"
2. (Optional) Enter a custom share ID
3. Click **Export & Publish**
4. Copy the generated share link
5. Share with unknownone!

---

## Export Options

### Standard Export (Download Only)

Downloads a comprehensive JSON file with all evaluation data:

```json
{
  "evaluation": {
    "id": "eval-123",
    "name": "Chatbot Safety Test",
    "type": "unit_test",
    "category": "adversarial"
  },
  "timestamp": "2025-11-11T20:00:00Z",
  "summary": {
    "totalTests": 50,
    "passed": 45,
    "failed": 5,
    "passRate": "90%"
  },
  "qualityScore": {
    "overall": 90,
    "grade": "A",
    "metrics": { ... },
    "insights": [ ... ],
    "recommendations": [ ... ]
  },
  "testResults": [ ... ]
}
```

**Filename Format:**
- Unit Test: `unit_test-adversarial-chatbot-safety-1731360000.json`
- Human Eval: `human_eval-legal-qa-evaluation-1731360000.json`
- Model Eval: `model_eval-ragas-rag-system-1731360000.json`
- A/B Test: `ab_test-prompt-optimization-1731360000.json`

---

## Publishing as Demo

### What is a Public Demo?

When you publish an evaluation as a demo:
- ✅ It becomes publicly accessible via a share link
- ✅ unknownone can view results without signing in
- ✅ Viewers can copy or download the data
- ✅ Perfect for showcasing your work or sharing with stakeholders

### How to Publish

**Option 1: Via Export Modal**

1. Click **Export** button
2. Check ☑️ **"Make this export public as demo"**
3. (Optional) Enter custom share ID: `my-chatbot-eval`
4. Click **Export & Publish**

**Option 2: Via API (see below)**

### Custom Share IDs

You can customize your share URL:

**Auto-generated:**
```
https://yoursite.com/share/a7f3d9e2b1
```

**Custom ID:**
```
https://yoursite.com/share/chatbot-safety-demo
```

**Rules:**
- Lowercase letters, numbers, and hyphens only
- Must be unique (first-come, first-served)
- Cannot be changed after publishing

---

## Sharing Links

### Share Page Features

When someone visits your share link, they see:

1. **Banner**: "You're viewing a shared evaluation"
2. **Full Results**: All metrics, scores, and insights
3. **Quality Score Card**: Visual breakdown
4. **Test Results**: Up to 10 test cases (download for full data)
5. **Actions**: Copy results, download JSON
6. **CTA**: Sign up to create their own evaluations

### Example Share Page

```
https://yoursite.com/share/chatbot-demo

┌─────────────────────────────────────────────┐
│ 📊 Shared Evaluation Banner                 │
│ "Sign in to run your own tests"             │
└─────────────────────────────────────────────┘

Chatbot Safety Test  [unit_test] [adversarial]
Shared on Nov 11, 2025

[Copy] [Download]

┌─ Stats ────────────────────────────────────┐
│ 50 Tests  │  45 Passed  │  5 Failed  │ 90% │
└────────────────────────────────────────────┘

┌─ Quality Score ────────────────────────────┐
│ Grade: A (90/100)                          │
│ ▓▓▓▓▓▓▓▓▓░ Accuracy: 92                   │
│ ▓▓▓▓▓▓▓▓▓░ Safety: 95                     │
│ ...                                        │
└────────────────────────────────────────────┘

┌─ Test Results ─────────────────────────────┐
│ [PASS] PII Detection Test                  │
│ [PASS] Toxicity Filter                     │
│ [FAIL] Jailbreak Resistance                │
│ ...                                        │
└────────────────────────────────────────────┘
```

---

## Re-importing Data

### Import from JSON

You can re-import exported evaluations:

**Via UI (Coming Soon):**
1. Go to Evaluations page
2. Click "Import"
3. Upload JSON file
4. Review and confirm

**Via API:**

```bash
curl -X POST https://yoursite.com/api/evaluations/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @evaluation-export.json
```

### Use Cases

- **Backup & Restore**: Save evaluations locally
- **Version Control**: Track changes in git
- **Team Collaboration**: Share via email or Slack
- **Migration**: Move between environments

---

## API Methods

### Export via API

```typescript
// Using fetch
const response = await fetch('/api/evaluations/eval-123/export', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
const data = await response.json()

// Save to file
const blob = new Blob([JSON.stringify(data, null, 2)])
const url = URL.createObjectURL(blob)
// ... download logic
```

### Publish via API

```typescript
const response = await fetch('/api/evaluations/eval-123/publish', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    exportData: evaluationData,
    customShareId: 'my-custom-id' // optional
  })
})

const { shareId, shareUrl } = await response.json()
console.log('Published at:', shareUrl)
```

### Unpublish via API

```typescript
await fetch('/api/evaluations/eval-123/publish?shareId=my-custom-id', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

### SDK Methods (Future)

```typescript
import { EvaluationClient } from '@evalgate/sdk'

const client = new EvaluationClient({ apiKey: 'your-key' })

// Export
const data = await client.evaluations.export({
  id: 'eval-123',
  format: 'json'
})

// Publish
const { shareUrl } = await client.evaluations.publish({
  id: 'eval-123',
  public: true,
  customId: 'my-demo'
})

// Unpublish
await client.evaluations.unpublish({
  id: 'eval-123',
  shareId: 'my-demo'
})
```

---

## Best Practices

### When to Export

✅ **Do Export:**
- After major evaluation runs
- Before making system changes
- For compliance/audit requirements
- To share with stakeholders
- For backup purposes

❌ **Don't Export:**
- Every single test run (use dashboard instead)
- Sensitive data without review
- Incomplete evaluations

### When to Publish as Demo

✅ **Good Use Cases:**
- Showcasing your AI system's quality
- Sharing results with non-technical stakeholders
- Creating portfolio examples
- Demonstrating evaluation capabilities
- Marketing/sales purposes

❌ **Avoid Publishing:**
- Proprietary evaluation methods
- Sensitive business data
- Customer information
- Failed/poor results (unless for learning)

### Security Considerations

**Public Demos:**
- ⚠️ unknownone with the link can view
- ⚠️ Data is stored in the database (sharedExports table)
- ⚠️ Cannot be password-protected
- ✅ Can be unpublished unknowntime

**Recommendations:**
1. Review data before publishing
2. Remove sensitive information
3. Use custom IDs for professional URLs
4. Monitor published demos regularly
5. Unpublish outdated demos

### File Organization

```
your-project/
├── exports/
│   ├── backups/
│   │   ├── 2025-11-01-eval-backup.json
│   │   └── 2025-11-15-eval-backup.json
│   ├── shared/
│   │   └── team-review-2025-11.json
│   └── archive/
│       └── old-evaluations/
```

Published share links are stored in the database, not as files. No need to track public demos in git.

### Version Control

**Git Best Practices:**

```bash
# Add exports to .gitignore (sensitive data)
echo "exports/" >> .gitignore
```

**Naming Convention:**
```
{type}-{category}-{name}-{date}.json

Examples:
- unit_test-safety-pii-detection-2025-11-11.json
- ab_test-prompts-optimization-v2-2025-11-11.json
- model_eval-ragas-rag-system-prod-2025-11-11.json
```

---

## Troubleshooting

### Export Failed

**Problem:** Export button doesn't work

**Solutions:**
1. Ensure evaluation has completed runs
2. Check browser console for errors
3. Try refreshing the page
4. Verify you have permission to export

### Publish Failed

**Problem:** "Share ID already taken"

**Solutions:**
1. Choose a different custom ID
2. Leave blank for auto-generated ID
3. Check existing published demos

**Problem:** "Failed to publish demo"

**Solutions:**
1. Check server logs
2. Verify database connection
3. Ensure export data passes validation (no secrets, within size limit)

### Share Link Not Working

**Problem:** 404 on share page

**Solutions:**
1. Verify share ID is correct
2. Check if demo was unpublished or expired
3. Clear browser cache

**Problem:** "This share link has expired"

**Solutions:**
1. The link was revoked or has passed its expiration date
2. Request a new share link from the evaluation owner

---

## Examples

### Example 1: Export and Email

```typescript
// Export evaluation
const data = await exportEvaluation('eval-123')

// Send via email
await sendEmail({
  to: 'stakeholder@compunknown.com',
  subject: 'Q4 AI Quality Report',
  body: 'Please find attached...',
  attachments: [{
    filename: 'q4-evaluation.json',
    content: JSON.stringify(data, null, 2)
  }]
})
```

### Example 2: Automated Backup

```typescript
// Daily backup script
import { writeFile } from 'fs/promises'
import { join } from 'path'

async function backupEvaluations() {
  const evaluations = await getAllEvaluations()
  const date = new Date().toISOString().split('T')[0]
  
  for (const eval of evaluations) {
    const data = await exportEvaluation(eval.id)
    const filename = `${eval.name}-${date}.json`
    await writeFile(
      join('backups', filename),
      JSON.stringify(data, null, 2)
    )
  }
}

// Run daily
setInterval(backupEvaluations, 24 * 60 * 60 * 1000)
```

### Example 3: Share on Homepage

```typescript
// Homepage demo tiles
const demos = [
  { id: 'chatbot-demo', title: 'Chatbot Safety' },
  { id: 'rag-demo', title: 'RAG System' },
  { id: 'codegen-demo', title: 'Code Generation' }
]

{demos.map(demo => (
  <DemoTile
    key={demo.id}
    title={demo.title}
    href={`/share/${demo.id}`}
  />
))}
```

---

## FAQ

**Q: Can I edit a published demo?**
A: No, demos are immutable. Unpublish and republish with a new ID.

**Q: How long are demos stored?**
A: Indefinitely, until you unpublish them.

**Q: Can I password-protect a demo?**
A: Not currently. Use private exports for sensitive data.

**Q: What's the file size limit?**
A: No hard limit, but keep under 10MB for best performance.

**Q: Can I export multiple evaluations at once?**
A: Not via UI. Use API for bulk exports.

**Q: Do exports include raw test data?**
A: Yes, all test inputs, outputs, and metadata are included.

---

## Support

Need help with exports or sharing?

- 📚 Docs: [Full documentation](https://evalgate.com/documentation)
- 🐛 Issues: [GitHub Issues](https://github.com/evalgate/ai-evaluation-platform/issues)

---

**Last Updated:** November 11, 2025
**Version:** 1.0.0
