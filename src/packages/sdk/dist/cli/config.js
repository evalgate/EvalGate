"use strict";
/**
 * EvalAI config loader
 * Discovery: evalai.config.json → evalai.config.js → evalai.config.cjs → package.json evalai
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
exports.findConfigPath = findConfigPath;
exports.loadConfig = loadConfig;
exports.mergeConfigWithArgs = mergeConfigWithArgs;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CONFIG_FILES = [
    'evalai.config.json',
    'evalai.config.js',
    'evalai.config.cjs',
];
/**
 * Find config file path in directory, walking up to root
 */
function findConfigPath(cwd = process.cwd()) {
    let dir = path.resolve(cwd);
    const root = path.parse(dir).root;
    while (dir !== root) {
        for (const file of CONFIG_FILES) {
            const filePath = path.join(dir, file);
            if (fs.existsSync(filePath)) {
                return filePath;
            }
        }
        // Check package.json for evalai field
        const pkgPath = path.join(dir, 'package.json');
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                if (pkg.evalai != null) {
                    return pkgPath;
                }
            }
            catch {
                // ignore
            }
        }
        dir = path.dirname(dir);
    }
    return null;
}
/**
 * Load config from file system
 */
function loadConfig(cwd = process.cwd()) {
    const configPath = findConfigPath(cwd);
    if (!configPath)
        return null;
    try {
        if (configPath.endsWith('package.json')) {
            const pkg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            return pkg.evalai ?? null;
        }
        const content = fs.readFileSync(configPath, 'utf-8');
        if (configPath.endsWith('.json')) {
            return JSON.parse(content);
        }
        // .js or .cjs - would need to require/import; for v1 we only support JSON
        if (configPath.endsWith('.js') || configPath.endsWith('.cjs')) {
            // Try to parse as JSON first (some projects use .js with JSON content)
            try {
                return JSON.parse(content);
            }
            catch {
                // Dynamic require of .js could have side effects; skip for v1
                return null;
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Merge config with CLI args. Priority: args > config > defaults.
 */
function mergeConfigWithArgs(config, args) {
    const merged = {};
    if (config) {
        if (config.evaluationId)
            merged.evaluationId = config.evaluationId;
        if (config.baseUrl)
            merged.baseUrl = config.baseUrl;
        if (config.minScore != null)
            merged.minScore = config.minScore;
        if (config.minN != null)
            merged.minN = config.minN;
        if (config.allowWeakEvidence != null)
            merged.allowWeakEvidence = config.allowWeakEvidence;
        if (config.baseline)
            merged.baseline = config.baseline;
    }
    // Args override
    if (args.evaluationId !== undefined && args.evaluationId !== '') {
        merged.evaluationId = String(args.evaluationId);
    }
    if (args.baseUrl !== undefined && args.baseUrl !== '') {
        merged.baseUrl = String(args.baseUrl);
    }
    if (args.minScore !== undefined) {
        merged.minScore = typeof args.minScore === 'number' ? args.minScore : parseInt(String(args.minScore), 10);
    }
    if (args.minN !== undefined) {
        merged.minN = typeof args.minN === 'number' ? args.minN : parseInt(String(args.minN), 10);
    }
    if (args.allowWeakEvidence !== undefined) {
        merged.allowWeakEvidence = args.allowWeakEvidence === true || args.allowWeakEvidence === 'true' || args.allowWeakEvidence === '1';
    }
    if (args.baseline !== undefined && args.baseline !== '') {
        const b = String(args.baseline);
        if (b === 'previous' || b === 'production') {
            merged.baseline = b;
        }
        else {
            merged.baseline = 'published';
        }
    }
    return merged;
}
