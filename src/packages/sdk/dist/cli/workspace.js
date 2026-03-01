"use strict";
/**
 * CORE-402: Centralized .evalgate workspace resolution
 *
 * Provides unified workspace path resolution for all EvalGate CLI commands.
 * Prefers .evalgate/; falls back to .evalai/ for backward compatibility.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEvalWorkspace = resolveEvalWorkspace;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
/**
 * Resolve EvalGate workspace paths. Prefers .evalgate/, falls back to .evalai/.
 */
function resolveEvalWorkspace(projectRoot = process.cwd()) {
    const evalgateDir = path.join(projectRoot, ".evalgate");
    const evalaiDir = path.join(projectRoot, ".evalai");
    const useLegacy = fs.existsSync(evalaiDir) && !fs.existsSync(evalgateDir);
    const evalDir = useLegacy ? evalaiDir : evalgateDir;
    if (useLegacy && !process.__EVALGATE_LEGACY_EVALAI_WARNED) {
        console.warn("[EvalGate] Deprecation: .evalai/ is deprecated. Migrate to .evalgate/ (e.g. mv .evalai .evalgate).");
        process.__EVALGATE_LEGACY_EVALAI_WARNED = true;
    }
    const runsDir = path.join(evalDir, "runs");
    return {
        root: projectRoot,
        evalDir,
        evalgateDir: evalDir,
        runsDir,
        manifestPath: path.join(evalDir, "manifest.json"),
        lastRunPath: path.join(evalDir, "last-run.json"),
        indexPath: path.join(runsDir, "index.json"),
        baselinePath: path.join(evalDir, "baseline-run.json"),
    };
}
