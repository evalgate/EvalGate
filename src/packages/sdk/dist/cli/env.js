"use strict";
/**
 * CORE-401: Centralized environment detection
 *
 * Provides unified environment detection for all EvalAI CLI commands
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCI = isCI;
exports.isGitHubActions = isGitHubActions;
exports.getGitHubStepSummaryPath = getGitHubStepSummaryPath;
exports.isGitRef = isGitRef;
/**
 * Check if running in CI environment
 */
function isCI() {
    return !!(process.env.GITHUB_ACTIONS ||
        process.env.CI ||
        process.env.CONTINUOUS_INTEGRATION ||
        process.env.BUILDKITE ||
        process.env.CIRCLECI ||
        process.env.TRAVIS ||
        process.env.JENKINS_URL);
}
/**
 * Check if running in GitHub Actions
 */
function isGitHubActions() {
    return !!process.env.GITHUB_ACTIONS;
}
/**
 * Get GitHub Step Summary path if available
 */
function getGitHubStepSummaryPath() {
    return process.env.GITHUB_STEP_SUMMARY;
}
/**
 * Check if string looks like a git reference
 */
function isGitRef(ref) {
    // Common git ref patterns
    return /^(main|master|develop|dev|origin\/|remotes\/|feature\/|hotfix\/|release\/|v\d+\.\d+\.\d+|.*\.\.\..*|nonexistent-branch|test-branch|ci-branch)/.test(ref);
}
