"use strict";
/**
 * TICKET 2 — Evaluation Manifest Generation
 *
 * Goal: turn discovery output into a stable, versioned, machine-consumable artifact
 * that becomes the input to run / impact / diff.
 *
 * This is the compiler output that everything else consumes.
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
exports.MANIFEST_SCHEMA_VERSION = exports.SDK_VERSION = void 0;
exports.generateManifest = generateManifest;
exports.writeManifest = writeManifest;
exports.readManifest = readManifest;
exports.readLock = readLock;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const version_1 = require("../version");
Object.defineProperty(exports, "SDK_VERSION", { enumerable: true, get: function () { return version_1.SDK_VERSION; } });
/**
 * Manifest schema version
 */
exports.MANIFEST_SCHEMA_VERSION = 1;
/**
 * Generate evaluation manifest from discovery results
 */
async function generateManifest(specs, projectRoot, projectName, executionMode) {
    const generatedAt = Math.floor(Date.now() / 1000);
    const namespace = generateNamespace(projectRoot);
    // Process spec files and specs
    const specFiles = [];
    const processedSpecs = [];
    // Group specs by file
    const specsByFile = new Map();
    for (const spec of specs) {
        const normalizedPath = normalizePath(spec.file, projectRoot);
        if (!specsByFile.has(normalizedPath)) {
            specsByFile.set(normalizedPath, []);
        }
        specsByFile.get(normalizedPath)?.push(spec);
    }
    // Process each file
    for (const [filePath, fileSpecs] of specsByFile) {
        const absolutePath = path.join(projectRoot, filePath);
        const fileHash = await hashFile(absolutePath);
        specFiles.push({
            filePath,
            fileHash,
            specCount: fileSpecs.length,
        });
        // Process individual specs
        for (const spec of fileSpecs) {
            const processedSpec = await processSpec(spec, filePath, projectRoot);
            processedSpecs.push(processedSpec);
        }
    }
    return {
        schemaVersion: exports.MANIFEST_SCHEMA_VERSION,
        generatedAt,
        project: {
            name: projectName,
            root: ".",
            namespace,
        },
        runtime: {
            mode: executionMode.mode,
            sdkVersion: version_1.SDK_VERSION,
        },
        specFiles,
        specs: processedSpecs,
    };
}
/**
 * Process individual specification
 */
async function processSpec(spec, filePath, projectRoot) {
    const absolutePath = path.join(projectRoot, filePath);
    const content = await fs.readFile(absolutePath, "utf-8");
    // Extract position from AST analysis (simplified for now)
    const position = extractPosition(content, spec.name);
    // Extract dependencies from content
    const dependsOn = extractDependencies(content);
    // Generate suite path from tags or file structure
    const suitePath = generateSuitePath(spec.tags, filePath);
    return {
        id: spec.id,
        name: spec.name,
        suitePath,
        filePath: normalizePath(spec.file, projectRoot),
        position,
        tags: spec.tags,
        dependsOn,
    };
}
/**
 * Extract position from content (simplified implementation)
 */
function extractPosition(content, specName) {
    const lines = content.split("\n");
    const specPattern = new RegExp(`defineEval\\s*\\(\\s*["'\`]${specName}["'\`]`, "g");
    let match = null;
    let line = 1;
    let column = 1;
    for (let i = 0; i < lines.length; i++) {
        const lineContent = lines[i];
        specPattern.lastIndex = 0;
        match = specPattern.exec(lineContent);
        if (match) {
            line = i + 1;
            column = match.index + 1;
            break;
        }
    }
    return { line, column };
}
/**
 * Extract dependencies from content
 */
function extractDependencies(content) {
    const dependsOn = {
        prompts: [],
        datasets: [],
        tools: [],
        code: [],
    };
    // Extract from dependsOn option if present
    const dependsOnMatch = content.match(/dependsOn\s*:\s*({[^}]+})/s);
    if (dependsOnMatch) {
        try {
            // Use JSON.parse instead of eval for safety
            const deps = JSON.parse(dependsOnMatch[1]);
            return {
                prompts: deps.prompts || [],
                datasets: deps.datasets || [],
                tools: deps.tools || [],
                code: deps.code || [],
            };
        }
        catch (_error) {
            // If parsing fails, return empty dependencies
            return {
                prompts: [],
                datasets: [],
                tools: [],
                code: [],
            };
        }
    }
    // Simple extraction as fallback
    const patterns = {
        prompts: /["']([^"']*\.md)["']/g,
        datasets: /["']([^"']*\.json)["']/g,
        tools: /["']([^"']*\.ts)["']/g,
        code: /import.*from\s*["']([^"']+)["']/g,
    };
    for (const [type, pattern] of Object.entries(patterns)) {
        let match;
        match = pattern.exec(content);
        while (match !== null) {
            dependsOn[type].push(match[1]);
            match = pattern.exec(content);
        }
    }
    return dependsOn;
}
/**
 * Generate suite path from tags or file structure
 */
function generateSuitePath(tags, filePath) {
    // Use tags as primary suite path
    if (tags.length > 0) {
        return [tags[0]];
    }
    // Fall back to file structure
    const parts = filePath.split("/");
    if (parts.length > 1) {
        return [parts[0]];
    }
    return ["general"];
}
/**
 * Generate namespace from project root
 */
function generateNamespace(projectRoot) {
    const hash = crypto.createHash("sha256");
    hash.update(projectRoot);
    return hash.digest("hex").slice(0, 8);
}
/**
 * Normalize path to POSIX format
 */
function normalizePath(filePath, projectRoot) {
    const relativePath = path.relative(projectRoot, filePath);
    return relativePath.replace(/\\/g, "/");
}
/**
 * Hash file content
 */
async function hashFile(filePath) {
    const content = await fs.readFile(filePath, "utf-8");
    const hash = crypto.createHash("sha256");
    hash.update(content);
    return `sha256:${hash.digest("hex")}`;
}
/**
 * Write manifest to disk
 */
async function writeManifest(manifest, projectRoot) {
    const evalgateDir = path.join(projectRoot, ".evalgate");
    // Ensure .evalgate directory exists
    await fs.mkdir(evalgateDir, { recursive: true });
    // Write manifest.json
    const manifestPath = path.join(evalgateDir, "manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    // Write lock file
    const lock = {
        generatedAt: manifest.generatedAt,
        fileHashes: Object.fromEntries(manifest.specFiles.map((f) => [f.filePath, f.fileHash])),
    };
    const lockPath = path.join(evalgateDir, "manifest.lock.json");
    await fs.writeFile(lockPath, JSON.stringify(lock, null, 2), "utf-8");
}
/**
 * Read existing manifest
 */
async function readManifest(projectRoot) {
    const manifestPath = path.join(projectRoot, ".evalgate", "manifest.json");
    try {
        const content = await fs.readFile(manifestPath, "utf-8");
        return JSON.parse(content);
    }
    catch (_error) {
        return null;
    }
}
/**
 * Read existing lock file
 */
async function readLock(projectRoot) {
    const lockPath = path.join(projectRoot, ".evalgate", "manifest.lock.json");
    try {
        const content = await fs.readFile(lockPath, "utf-8");
        return JSON.parse(content);
    }
    catch (_error) {
        return null;
    }
}
