"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_BOOTSTRAP_SAMPLE_SIZE = exports.MIN_DISCRIMINATIVE_POWER = void 0;
exports.computeCorrectedPassRate = computeCorrectedPassRate;
exports.computeBootstrapCI = computeBootstrapCI;
exports.MIN_DISCRIMINATIVE_POWER = 0.05;
exports.MIN_BOOTSTRAP_SAMPLE_SIZE = 30;
function clamp01(value) {
    if (value < 0)
        return 0;
    if (value > 1)
        return 1;
    return value;
}
function createSeededRng(seed) {
    let state = (seed >>> 0) + 0x6d2b79f5;
    return () => {
        state |= 0;
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function quantile(sortedValues, q) {
    if (sortedValues.length === 0)
        return 0;
    const clampedQ = Math.min(1, Math.max(0, q));
    const idx = Math.floor((sortedValues.length - 1) * clampedQ);
    return sortedValues[idx];
}
function computeCorrectedPassRate(input) {
    const threshold = input.nearRandomThreshold ?? exports.MIN_DISCRIMINATIVE_POWER;
    const discriminativePower = input.tpr + input.tnr - 1;
    if (discriminativePower <= threshold) {
        return {
            rawPassRate: clamp01(input.rawPassRate),
            correctedPassRate: clamp01(input.rawPassRate),
            applied: false,
            discriminativePower,
            warning: "judge_too_weak_to_correct",
        };
    }
    const corrected = (input.rawPassRate + input.tnr - 1) / discriminativePower;
    return {
        rawPassRate: clamp01(input.rawPassRate),
        correctedPassRate: clamp01(corrected),
        applied: true,
        discriminativePower,
    };
}
function computeBootstrapCI(input) {
    const minSample = input.minSampleSizeForCI ?? exports.MIN_BOOTSTRAP_SAMPLE_SIZE;
    if (input.outcomes.length < minSample) {
        return { applied: false, warning: "insufficient_samples_for_ci" };
    }
    const baseCorrection = computeCorrectedPassRate({
        rawPassRate: 0.5,
        tpr: input.tpr,
        tnr: input.tnr,
        nearRandomThreshold: input.nearRandomThreshold,
    });
    if (!baseCorrection.applied) {
        return { applied: false, warning: "judge_too_weak_to_correct" };
    }
    const rng = createSeededRng(input.seed);
    const n = input.outcomes.length;
    const correctedSamples = [];
    for (let i = 0; i < input.iterations; i++) {
        let passCount = 0;
        for (let j = 0; j < n; j++) {
            const pick = Math.floor(rng() * n);
            if (input.outcomes[pick])
                passCount++;
        }
        const rawPassRate = passCount / n;
        const corrected = computeCorrectedPassRate({
            rawPassRate,
            tpr: input.tpr,
            tnr: input.tnr,
            nearRandomThreshold: input.nearRandomThreshold,
        });
        correctedSamples.push(corrected.correctedPassRate);
    }
    correctedSamples.sort((a, b) => a - b);
    return {
        low: quantile(correctedSamples, 0.025),
        high: quantile(correctedSamples, 0.975),
        applied: true,
    };
}
