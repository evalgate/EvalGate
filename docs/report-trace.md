# Production Trace Collection with reportTrace()

`reportTrace()` sends production traces to EvalGate for analysis and candidate generation. It uses an **asymmetric sampling model**: errors and negative feedback are always analyzed, while success traces are sampled at a configurable rate (default 10%). This asymmetry is the point — you get full coverage on failures without drowning in successful trace noise.

## Basic Usage

```typescript
import { reportTrace } from "@evalgate/sdk";

await reportTrace({
  input: userMessage,
  output: modelResponse,
  metadata: { userId, sessionId }
});
// Success traces sampled at 10% by default
// Errors always captured
```

## Sampling Configuration Examples

### Default: 10% success sampling, 100% error capture

```typescript
await reportTrace({ 
  input: "How do I reset my password?",
  output: "To reset your password, go to Settings > Security > Reset Password",
  metadata: { userId: "user123", sessionId: "sess456" }
});
```

### Higher sampling for low-traffic production

```typescript
await reportTrace({ 
  input: "Generate a SQL query",
  output: "SELECT * FROM users WHERE active = true",
  metadata: { model: "gpt-4", temperature: 0.7 }
}, {
  successSampleRate: 0.5  // 50% of successes
});
```

### Always capture (staging/debug)

```typescript
await reportTrace({ 
  input: "Test prompt",
  output: "Test response",
  metadata: { environment: "staging" }
}, {
  successSampleRate: 1.0  // 100% of successes
});
```

### Explicit negative feedback — always analyzed regardless of sample rate

```typescript
await reportTrace({ 
  input: "What's the weather like?",
  output: "I cannot provide weather information.",
  metadata: { userId: "user123" }
}, {
  feedback: { thumbsDown: true, comment: "wrong answer" }
});
```

## Why the Asymmetry Matters

Success traces are high-volume and low-signal. Most production interactions work correctly and don't reveal new failure patterns. Error traces and negative feedback are low-volume and high-signal — they represent the exact problems you need to understand and fix.

By sampling successes at 10% (or your configured rate), you:
- **Reduce noise** in your analysis pipeline
- **Control costs** by not sending every happy-path trace
- **Preserve signal** with full coverage on failures that matter
- **Maintain statistical relevance** with a representative success sample

## Production Loop Connection

`reportTrace()` feeds directly into the auto-promotion pipeline:

1. **Errors & negative feedback** → Always captured → **Failure detection**
2. **Failure detection** → **Candidate eval cases** (auto-generated)
3. **Candidate eval cases** → **evalgate promote** → **Golden regression suite**

This creates a continuous improvement loop where real production failures automatically become test cases that prevent regressions.

## Integration Examples

### Express.js API

```typescript
app.post("/chat", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const response = await aiModel.generate(req.body.message);
    
    await reportTrace({
      input: req.body.message,
      output: response,
      metadata: {
        userId: req.user.id,
        duration: Date.now() - startTime,
        model: "gpt-4"
      }
    }, {
      successSampleRate: 0.1  // 10% sampling for production
    });
    
    res.json({ response });
    
  } catch (error) {
    // Errors always captured regardless of sampling
    await reportTrace({
      input: req.body.message,
      output: null,
      metadata: {
        userId: req.user.id,
        error: error.message,
        duration: Date.now() - startTime
      }
    });
    
    res.status(500).json({ error: "Generation failed" });
  }
});
```

### User Feedback Integration

```typescript
app.post("/feedback", async (req, res) => {
  const { traceId, feedback } = req.body;
  
  // Negative feedback always analyzed
  if (feedback.type === "thumbs_down") {
    await reportTrace({
      input: null,
      output: null,
      metadata: { originalTraceId: traceId }
    }, {
      feedback: {
        thumbsDown: true,
        comment: feedback.comment
      }
    });
  }
  
  res.json({ received: true });
});
```

## Best Practices

- **Set appropriate sampling rates** based on your traffic volume
- **Always include metadata** for context (userId, model, etc.)
- **Use environment-specific rates** (higher sampling for staging, lower for production)
- **Monitor your trace volume** to control costs
- **Include error details** when reporting failures
