/**
 * CORE-401: Centralized environment detection
 *
 * Provides unified environment detection for all EvalGate CLI commands
 */

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
	return !!(
		process.env.GITHUB_ACTIONS ||
		process.env.CI ||
		process.env.CONTINUOUS_INTEGRATION ||
		process.env.BUILDKITE ||
		process.env.CIRCLECI ||
		process.env.TRAVIS ||
		process.env.JENKINS_URL
	);
}

/**
 * Check if running in GitHub Actions
 */
export function isGitHubActions(): boolean {
	return !!process.env.GITHUB_ACTIONS;
}

/**
 * Get GitHub Step Summary path if available
 */
export function getGitHubStepSummaryPath(): string | undefined {
	return process.env.GITHUB_STEP_SUMMARY;
}

/**
 * Check if string looks like a git reference
 */
export function isGitRef(ref: string): boolean {
	// Common git ref patterns
	return /^(main|master|develop|dev|origin\/|remotes\/|feature\/|hotfix\/|release\/|v\d+\.\d+\.\d+|.*\.\.\..*|nonexistent-branch|test-branch|ci-branch)/.test(
		ref,
	);
}
