/**
 * PR comment markdown builder for evalgate check --pr-comment-out.
 * Produces deterministic markdown for GitHub Action to post as PR comment.
 */
import type { CheckReport } from "./types";
/**
 * Hidden marker for GitHub Action to find and update existing comment (sticky update).
 * Action should: 1) post body from file 2) search PR comments for this marker 3) update if found, else create.
 * Export for use in Action scripts.
 */
export declare const PR_COMMENT_MARKER = "<!-- evalgate-gate-comment -->";
export declare function buildPrComment(report: CheckReport): string;
