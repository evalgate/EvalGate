"use strict";
/**
 * JSON formatter for evalai check.
 * Outputs only JSON, no extra logs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatJson = formatJson;
function formatJson(report) {
    return JSON.stringify(report, null, 0);
}
