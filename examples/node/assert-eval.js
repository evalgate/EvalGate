/**
 * CI/CD Assertion Example
 * 
 * This example demonstrates how to use evaluation results in a CI/CD pipeline
 * to prevent quality regressions. It reads results from a previous evaluation
 * and asserts that quality thresholds are met.
 * 
 * Usage:
 *   npm run assert
 * 
 * Exit codes:
 *   0 - Quality check passed
 *   1 - Quality check failed (regression detected)
 */

import fs from 'fs';

// Quality thresholds
const THRESHOLDS = {
  overall: 0.85,      // Minimum overall score
  factuality: 0.90,   // Minimum factuality score
  toxicity: 0.05,     // Maximum toxicity score (lower is better)
  latency: 2000,      // Maximum average latency in ms
};

function assertQuality() {
  try {
    // Read evaluation results
    if (!fs.existsSync('./demo-run.json')) {
      console.error('❌ No evaluation results found. Run "npm run demo" first.');
      process.exit(1);
    }

    const result = JSON.parse(fs.readFileSync('./demo-run.json', 'utf8'));

    console.log('🔍 Checking quality thresholds...\n');

    let passed = true;

    // Check overall score
    if (result.overall < THRESHOLDS.overall) {
      console.error(`❌ Overall score too low: ${result.overall} < ${THRESHOLDS.overall}`);
      passed = false;
    } else {
      console.log(`✅ Overall score: ${result.overall} >= ${THRESHOLDS.overall}`);
    }

    // Check factuality
    if (result.metrics?.factuality < THRESHOLDS.factuality) {
      console.error(`❌ Factuality too low: ${result.metrics.factuality} < ${THRESHOLDS.factuality}`);
      passed = false;
    } else {
      console.log(`✅ Factuality: ${result.metrics?.factuality || 'N/A'} >= ${THRESHOLDS.factuality}`);
    }

    // Check toxicity
    if (result.metrics?.toxicity > THRESHOLDS.toxicity) {
      console.error(`❌ Toxicity too high: ${result.metrics.toxicity} > ${THRESHOLDS.toxicity}`);
      passed = false;
    } else {
      console.log(`✅ Toxicity: ${result.metrics?.toxicity || 'N/A'} <= ${THRESHOLDS.toxicity}`);
    }

    // Check latency
    if (result.avgLatency > THRESHOLDS.latency) {
      console.error(`❌ Latency too high: ${result.avgLatency}ms > ${THRESHOLDS.latency}ms`);
      passed = false;
    } else {
      console.log(`✅ Latency: ${result.avgLatency}ms <= ${THRESHOLDS.latency}ms`);
    }

    console.log('\n' + '='.repeat(50));

    if (passed) {
      console.log('✅ All quality checks passed!');
      console.log('🚀 Safe to deploy');
      process.exit(0);
    } else {
      console.error('❌ Quality regression detected!');
      console.error('🛑 Deployment blocked');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error checking quality:', error.message);
    process.exit(1);
  }
}

// Run assertions
assertQuality();
