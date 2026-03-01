# 60-Second Demo Recording Script

Record your terminal running these commands in order. Each step takes ~5 seconds.

## Setup (off-camera)
```bash
mkdir /tmp/evalai-demo && cd /tmp/evalai-demo
npm init -y
echo 'const { test } = require("node:test"); const assert = require("node:assert");' > test.js
echo 'test("math", () => assert.strictEqual(1+1, 2));' >> test.js
echo 'test("string", () => assert.strictEqual("hello".length, 5));' >> test.js
echo 'test("array", () => assert.deepStrictEqual([1,2,3].filter(x=>x>1), [2,3]));' >> test.js
```

## Record starts here (~60 seconds)

### 1. Init (10s)
```bash
npx @evalgate/sdk init
```
Shows: config created, baseline created, CI workflow created, "Next: evalai doctor"

### 2. Doctor (5s)
```bash
npx evalgate doctor
```
Shows: 9 checks, ✅/❌/⚠️/⏭️ status for each

### 3. Gate — passes (5s)
```bash
npx evalgate gate
```
Shows: ✅ PASS, 3/3 tests passing

### 4. Break a test (5s)
```bash
# Edit test.js: change assert.strictEqual(1+1, 2) to assert.strictEqual(1+1, 3)
sed -i 's/1+1, 2/1+1, 3/' test.js
```

### 5. Gate — fails (5s)
```bash
npx evalgate gate --format json > .evalgate/last-report.json 2>/dev/null || true
npx evalgate gate
```
Shows: ❌ FAIL, regression detected

### 6. Explain (10s)
```bash
npx evalgate explain
```
Shows: verdict FAIL, what changed, top failures, root causes, suggested fixes

### 7. Fix it (5s)
```bash
sed -i 's/1+1, 3/1+1, 2/' test.js
```

### 8. Gate — green again (5s)
```bash
npx evalgate gate
```
Shows: ✅ PASS

## Record ends

## Post to:
1. **GitHub Release notes** — attach as `demo.mp4` to the v1.8.0 release
2. **LinkedIn** — 1 post with video, caption: "Built an AI evaluation SDK with a 30-second debug loop. init → doctor → check → explain → fix → green. Open source."
3. **Recruiter/interviewer** — forward LinkedIn post or send video directly with "quick update on what I shipped this week"
