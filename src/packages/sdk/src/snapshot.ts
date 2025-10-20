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

// Environment check
const isNode = typeof process !== 'undefined' && process.versions?.node;
if (!isNode) {
  throw new Error(
    'Snapshot testing requires Node.js and cannot run in browsers. ' +
    'This feature uses the filesystem for storing snapshots.'
  );
}

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

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
export class SnapshotManager {
  private snapshotDir: string;

  constructor(snapshotDir: string = './.snapshots') {
    this.snapshotDir = snapshotDir;
    this.ensureSnapshotDir();
  }

  /**
   * Ensure snapshot directory exists
   */
  private ensureSnapshotDir(): void {
    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true });
    }
  }

  /**
   * Get snapshot file path with security checks
   */
  private getSnapshotPath(name: string): string {
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
  private generateHash(content: string): string {
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
  async save(
    name: string,
    output: string,
    options?: {
      tags?: string[];
      metadata?: Record<string, any>;
      overwrite?: boolean;
    }
  ): Promise<SnapshotData> {
    const filePath = this.getSnapshotPath(name);
    
    // Check if snapshot exists
    if (!options?.overwrite && fs.existsSync(filePath)) {
      throw new Error(`Snapshot '${name}' already exists. Use overwrite: true to update.`);
    }

    const snapshotData: SnapshotData = {
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
  async load(name: string): Promise<SnapshotData> {
    const filePath = this.getSnapshotPath(name);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Snapshot '${name}' not found`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as SnapshotData;
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
  async compare(name: string, currentOutput: string): Promise<SnapshotComparison> {
    const snapshot = await this.load(name);
    const original = snapshot.output;

    // Exact match check
    const exactMatch = original === currentOutput;

    // Calculate similarity (simple line-based diff)
    const originalLines = original.split('\n');
    const currentLines = currentOutput.split('\n');
    
    const differences: string[] = [];
    const maxLines = Math.max(originalLines.length, currentLines.length);
    let matchingLines = 0;

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i] || '';
      const currLine = currentLines[i] || '';
      
      if (origLine === currLine) {
        matchingLines++;
      } else {
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
  async list(): Promise<SnapshotData[]> {
    const files = fs.readdirSync(this.snapshotDir);
    const snapshots: SnapshotData[] = [];

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
  async delete(name: string): Promise<void> {
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
  async update(name: string, output: string): Promise<SnapshotData> {
    const existing = await this.load(name);
    return this.save(name, output, {
      tags: existing.metadata.tags,
      metadata: existing.metadata.metadata,
      overwrite: true
    });
  }
}

// Global snapshot manager instance
let globalManager: SnapshotManager | undefined;

/**
 * Get or create global snapshot manager
 */
function getSnapshotManager(dir?: string): SnapshotManager {
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
export async function snapshot(
  output: string,
  name: string,
  options?: {
    tags?: string[];
    metadata?: Record<string, any>;
    overwrite?: boolean;
    dir?: string;
  }
): Promise<SnapshotData> {
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
export async function loadSnapshot(name: string, dir?: string): Promise<SnapshotData> {
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
export async function compareWithSnapshot(
  name: string,
  currentOutput: string,
  dir?: string
): Promise<SnapshotComparison> {
  const manager = getSnapshotManager(dir);
  return manager.compare(name, currentOutput);
}

/**
 * Delete a snapshot (convenience function)
 */
export async function deleteSnapshot(name: string, dir?: string): Promise<void> {
  const manager = getSnapshotManager(dir);
  return manager.delete(name);
}

/**
 * List all snapshots (convenience function)
 */
export async function listSnapshots(dir?: string): Promise<SnapshotData[]> {
  const manager = getSnapshotManager(dir);
  return manager.list();
}