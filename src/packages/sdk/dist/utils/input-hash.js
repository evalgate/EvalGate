"use strict";
/**
 * Input normalization and hashing for deterministic matching.
 * Must match platform's @/lib/utils/input-hash.ts for reportToEvalGate.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeInput = normalizeInput;
exports.sha256Input = sha256Input;
const node_crypto_1 = __importDefault(require("node:crypto"));
function sortKeys(obj) {
    const sorted = {};
    for (const k of Object.keys(obj).sort()) {
        const v = obj[k];
        sorted[k] =
            v != null && typeof v === "object" && !Array.isArray(v)
                ? sortKeys(v)
                : v;
    }
    return sorted;
}
/** Normalize input for stable matching (whitespace, JSON key order). */
function normalizeInput(input) {
    const s = input.trim();
    try {
        const obj = JSON.parse(s);
        return JSON.stringify(sortKeys(obj));
    }
    catch {
        return s.replace(/\s+/g, " ");
    }
}
/** SHA-256 hash of normalized input. */
function sha256Input(s) {
    return node_crypto_1.default
        .createHash("sha256")
        .update(normalizeInput(s), "utf8")
        .digest("hex");
}
