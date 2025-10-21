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
export interface SnapshotMetadata {
    /** Snapshot name/ID */
    name: string;
    /** When snapshot was created */
    createdAt: string;
    /** Content hash for change detection */
    hash: string;
    /** Optional tags for organization */
    tags?: string[];
    /** Additional metadata */
    metadata?: Record<string, any>;
}
export interface SnapshotData {
    /** The actual output that was snapshotted */
    output: string;
    /** Metadata about the snapshot */
    metadata: SnapshotMetadata;
}
export interface SnapshotComparison {
    /** Whether snapshots match */
    matches: boolean;
    /** Similarity score 0-1 */
    similarity: number;
    /** Differences found */
    differences: string[];
    /** Original snapshot */
    original: string;
    /** New output */
    current: string;
}
/**
 * Snapshot manager
 */
export declare class SnapshotManager {
    private snapshotDir;
    constructor(snapshotDir?: string);
    /**
     * Ensure snapshot directory exists
     */
    private ensureSnapshotDir;
    /**
     * Get snapshot file path with security checks
     */
    private getSnapshotPath;
    /**
     * Generate content hash
     */
    private generateHash;
    /**
     * Save a snapshot
     *
     * @example
     * ```typescript
     * const manager = new SnapshotManager();
     * await manager.save('haiku-test', output, { tags: ['poetry'] });
     * ```
     */
    save(name: string, output: string, options?: {
        tags?: string[];
        metadata?: Record<string, any>;
        overwrite?: boolean;
    }): Promise<SnapshotData>;
    /**
     * Load a snapshot
     *
     * @example
     * ```typescript
     * const snapshot = await manager.load('haiku-test');
     * console.log(snapshot.output);
     * ```
     */
    load(name: string): Promise<SnapshotData>;
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
    compare(name: string, currentOutput: string): Promise<SnapshotComparison>;
    /**
     * List all snapshots
     *
     * @example
     * ```typescript
     * const snapshots = await manager.list();
     * snapshots.forEach(s => console.log(s.metadata.name));
     * ```
     */
    list(): Promise<SnapshotData[]>;
    /**
     * Delete a snapshot
     *
     * @example
     * ```typescript
     * await manager.delete('old-test');
     * ```
     */
    delete(name: string): Promise<void>;
    /**
     * Update a snapshot with new output
     *
     * @example
     * ```typescript
     * await manager.update('haiku-test', newOutput);
     * ```
     */
    update(name: string, output: string): Promise<SnapshotData>;
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
export declare function snapshot(output: string, name: string, options?: {
    tags?: string[];
    metadata?: Record<string, any>;
    overwrite?: boolean;
    dir?: string;
}): Promise<SnapshotData>;
/**
 * Load a snapshot (convenience function)
 *
 * @example
 * ```typescript
 * const saved = await loadSnapshot('haiku-test');
 * console.log(saved.output);
 * ```
 */
export declare function loadSnapshot(name: string, dir?: string): Promise<SnapshotData>;
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
export declare function compareWithSnapshot(name: string, currentOutput: string, dir?: string): Promise<SnapshotComparison>;
/**
 * Delete a snapshot (convenience function)
 */
export declare function deleteSnapshot(name: string, dir?: string): Promise<void>;
/**
 * List all snapshots (convenience function)
 */
export declare function listSnapshots(dir?: string): Promise<SnapshotData[]>;
