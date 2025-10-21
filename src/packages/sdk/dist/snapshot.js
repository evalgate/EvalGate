"use strict";
/**
 * Snapshot Testing System
 * Tier 4.16: Visual regression detection for LLM outputs
 *
 * ⚠️ NOTE: This module requires Node.js and will not work in browsers.
 *
 * @example
 * ```typescript
 * import { snapshot, loadSnapshot } from '@ai-eval-platform/sdk';
 *
 * const output = await generateText('Write a haiku about coding');
 * await snapshot(output, 'haiku-test');
 *
 * // Later, compare with snapshot
 * const saved = await loadSnapshot('haiku-test');
 * const matches = compareSnapshots(saved, output);
 * ```
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
exports.SnapshotManager = void 0;
exports.snapshot = snapshot;
exports.loadSnapshot = loadSnapshot;
exports.compareWithSnapshot = compareWithSnapshot;
exports.deleteSnapshot = deleteSnapshot;
exports.listSnapshots = listSnapshots;
// Environment check
const isNode = typeof process !== 'undefined' && process.versions?.node;
if (!isNode) {
    throw new Error('Snapshot testing requires Node.js and cannot run in browsers. ' +
        'This feature uses the filesystem for storing snapshots.');
}
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
/**
 * Snapshot manager
 */
class SnapshotManager {
    constructor(snapshotDir = './.snapshots') {
        this.snapshotDir = snapshotDir;
        this.ensureSnapshotDir();
    }
    /**
     * Ensure snapshot directory exists
     */
    ensureSnapshotDir() {
        if (!fs.existsSync(this.snapshotDir)) {
            fs.mkdirSync(this.snapshotDir, { recursive: true });
        }
    }
    /**
     * Get snapshot file path with security checks
     */
    getSnapshotPath(name) {
        // Security: prevent empty names
        if (!name || name.trim().length === 0) {
            throw new Error('Snapshot name cannot be empty');
        }
        // Security: prevent path traversal
        if (name.includes('..') || name.includes('/') || name.includes('\\')) {
            throw new Error('Snapshot name cannot contain path separators or ".."');
        }
        // Sanitize to alphanumeric, hyphens, and underscores
        const sanitized = name.replace(/[^a-zA-Z0-9-_]/g, '-');
        // Security: ensure sanitized name is not empty
        if (sanitized.length === 0) {
            throw new Error('Snapshot name must contain at least one alphanumeric character');
        }
        // Security: prevent absolute paths
        const filePath = path.join(this.snapshotDir, `${sanitized}.json`);
        const resolvedPath = path.resolve(filePath);
        const resolvedDir = path.resolve(this.snapshotDir);
        if (!resolvedPath.startsWith(resolvedDir)) {
            throw new Error('Invalid snapshot path: path traversal detected');
        }
        return filePath;
    }
    /**
     * Generate content hash
     */
    generateHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    /**
     * Save a snapshot
     *
     * @example
     * ```typescript
     * const manager = new SnapshotManager();
     * await manager.save('haiku-test', output, { tags: ['poetry'] });
     * ```
     */
    async save(name, output, options) {
        const filePath = this.getSnapshotPath(name);
        // Check if snapshot exists
        if (!options?.overwrite && fs.existsSync(filePath)) {
            throw new Error(`Snapshot '${name}' already exists. Use overwrite: true to update.`);
        }
        const snapshotData = {
            output,
            metadata: {
                name,
                createdAt: new Date().toISOString(),
                hash: this.generateHash(output),
                tags: options?.tags,
                metadata: options?.metadata
            }
        };
        fs.writeFileSync(filePath, JSON.stringify(snapshotData, null, 2));
        return snapshotData;
    }
    /**
     * Load a snapshot
     *
     * @example
     * ```typescript
     * const snapshot = await manager.load('haiku-test');
     * console.log(snapshot.output);
     * ```
     */
    async load(name) {
        const filePath = this.getSnapshotPath(name);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Snapshot '${name}' not found`);
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    /**
     * Compare current output with saved snapshot
     *
     * @example
     * ```typescript
     * const comparison = await manager.compare('haiku-test', currentOutput);
     * if (!comparison.matches) {
     *   console.log('Differences:', comparison.differences);
     * }
     * ```
     */
    async compare(name, currentOutput) {
        const snapshot = await this.load(name);
        const original = snapshot.output;
        // Exact match check
        const exactMatch = original === currentOutput;
        // Calculate similarity (simple line-based diff)
        const originalLines = original.split('\n');
        const currentLines = currentOutput.split('\n');
        const differences = [];
        const maxLines = Math.max(originalLines.length, currentLines.length);
        let matchingLines = 0;
        for (let i = 0; i < maxLines; i++) {
            const origLine = originalLines[i] || '';
            const currLine = currentLines[i] || '';
            if (origLine === currLine) {
                matchingLines++;
            }
            else {
                differences.push(`Line ${i + 1}: "${origLine}" → "${currLine}"`);
            }
        }
        const similarity = maxLines > 0 ? matchingLines / maxLines : 1;
        return {
            matches: exactMatch,
            similarity,
            differences,
            original,
            current: currentOutput
        };
    }
    /**
     * List all snapshots
     *
     * @example
     * ```typescript
     * const snapshots = await manager.list();
     * snapshots.forEach(s => console.log(s.metadata.name));
     * ```
     */
    async list() {
        const files = fs.readdirSync(this.snapshotDir);
        const snapshots = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const content = fs.readFileSync(path.join(this.snapshotDir, file), 'utf-8');
                snapshots.push(JSON.parse(content));
            }
        }
        return snapshots;
    }
    /**
     * Delete a snapshot
     *
     * @example
     * ```typescript
     * await manager.delete('old-test');
     * ```
     */
    async delete(name) {
        const filePath = this.getSnapshotPath(name);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Snapshot '${name}' not found`);
        }
        fs.unlinkSync(filePath);
    }
    /**
     * Update a snapshot with new output
     *
     * @example
     * ```typescript
     * await manager.update('haiku-test', newOutput);
     * ```
     */
    async update(name, output) {
        const existing = await this.load(name);
        return this.save(name, output, {
            tags: existing.metadata.tags,
            metadata: existing.metadata.metadata,
            overwrite: true
        });
    }
}
exports.SnapshotManager = SnapshotManager;
// Global snapshot manager instance
let globalManager;
/**
 * Get or create global snapshot manager
 */
function getSnapshotManager(dir) {
    if (!globalManager || dir) {
        globalManager = new SnapshotManager(dir);
    }
    return globalManager;
}
/**
 * Save a snapshot (convenience function)
 *
 * @example
 * ```typescript
 * const output = await generateText('Write a haiku');
 * await snapshot(output, 'haiku-test');
 * ```
 */
async function snapshot(output, name, options) {
    const manager = getSnapshotManager(options?.dir);
    return manager.save(name, output, options);
}
/**
 * Load a snapshot (convenience function)
 *
 * @example
 * ```typescript
 * const saved = await loadSnapshot('haiku-test');
 * console.log(saved.output);
 * ```
 */
async function loadSnapshot(name, dir) {
    const manager = getSnapshotManager(dir);
    return manager.load(name);
}
/**
 * Compare with snapshot (convenience function)
 *
 * @example
 * ```typescript
 * const comparison = await compareWithSnapshot('haiku-test', currentOutput);
 * if (!comparison.matches) {
 *   console.log('Output changed!');
 * }
 * ```
 */
async function compareWithSnapshot(name, currentOutput, dir) {
    const manager = getSnapshotManager(dir);
    return manager.compare(name, currentOutput);
}
/**
 * Delete a snapshot (convenience function)
 */
async function deleteSnapshot(name, dir) {
    const manager = getSnapshotManager(dir);
    return manager.delete(name);
}
/**
 * List all snapshots (convenience function)
 */
async function listSnapshots(dir) {
    const manager = getSnapshotManager(dir);
    return manager.list();
}
