/**
 * Local Development Mode (Tier 2.10)
 * Offline mode with local storage for development
 * 
 * ⚠️ NOTE: This module requires Node.js and will not work in browsers.
 */

// Environment check
const isNode = typeof process !== 'undefined' && process.versions?.node;
if (!isNode) {
  throw new Error(
    'Local storage mode requires Node.js and cannot run in browsers. ' +
    'This feature uses the filesystem for storing data.'
  );
}

import fs from 'fs/promises'
import path from 'path'
import type { 
  Trace, 
  Evaluation, 
  Span
} from './types'

export interface LocalStorageOptions {
  directory?: string
  autoSave?: boolean
}

export class LocalStorage {
  private directory: string
  private autoSave: boolean
  private traces: Map<string, Trace> = new Map()
  private evaluations: Map<string, Evaluation> = new Map()
  private spans: Map<string, Span[]> = new Map()

  constructor(options: LocalStorageOptions = {}) {
    this.directory = options.directory || './.evalai-data'
    this.autoSave = options.autoSave !== false
    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.directory, { recursive: true })
      await fs.mkdir(path.join(this.directory, 'traces'), { recursive: true })
      await fs.mkdir(path.join(this.directory, 'evaluations'), { recursive: true })
      await fs.mkdir(path.join(this.directory, 'spans'), { recursive: true })
      
      // Load existing data
      await this.loadAllData()
    } catch (error) {
      console.warn('Failed to initialize local storage:', error)
    }
  }

  private async loadAllData(): Promise<void> {
    try {
      // Load traces
      const tracesDir = path.join(this.directory, 'traces')
      const traceFiles = await fs.readdir(tracesDir)
      for (const file of traceFiles) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(tracesDir, file), 'utf-8')
          const trace = JSON.parse(content) as Trace
          this.traces.set(trace.id.toString(), trace)
        }
      }

      // Load evaluations
      const evalsDir = path.join(this.directory, 'evaluations')
      const evalFiles = await fs.readdir(evalsDir)
      for (const file of evalFiles) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(evalsDir, file), 'utf-8')
          const evaluation = JSON.parse(content) as Evaluation
          this.evaluations.set(evaluation.id.toString(), evaluation)
        }
      }
    } catch (error) {
      // Directories might not exist yet, that's fine
    }
  }

  private async saveTraceToDisk(trace: Trace): Promise<void> {
    const filePath = path.join(this.directory, 'traces', `${trace.id}.json`)
    await fs.writeFile(filePath, JSON.stringify(trace, null, 2))
  }

  async saveTrace(trace: Trace): Promise<void> {
    this.traces.set(trace.id.toString(), trace)
    if (this.autoSave) {
      await this.saveTraceToDisk(trace)
    }
  }

  async getTrace(id: string): Promise<Trace | undefined> {
    return this.traces.get(id)
  }

  async listTraces(): Promise<Trace[]> {
    return Array.from(this.traces.values())
  }

  private async saveEvaluationToDisk(evaluation: Evaluation): Promise<void> {
    const filePath = path.join(this.directory, 'evaluations', `${evaluation.id}.json`)
    await fs.writeFile(filePath, JSON.stringify(evaluation, null, 2))
  }

  async saveEvaluation(evaluation: Evaluation): Promise<void> {
    this.evaluations.set(evaluation.id.toString(), evaluation)
    if (this.autoSave) {
      await this.saveEvaluationToDisk(evaluation)
    }
  }

  async getEvaluation(id: string): Promise<Evaluation | undefined> {
    return this.evaluations.get(id)
  }

  async listEvaluations(): Promise<Evaluation[]> {
    return Array.from(this.evaluations.values())
  }

  private async saveSpansToDisk(traceId: string, spans: Span[]): Promise<void> {
    const filePath = path.join(this.directory, 'spans', `${traceId}.json`)
    await fs.writeFile(filePath, JSON.stringify(spans, null, 2))
  }

  async saveSpans(traceId: string, spans: Span[]): Promise<void> {
    this.spans.set(traceId, spans)
    if (this.autoSave) {
      await this.saveSpansToDisk(traceId, spans)
    }
  }

  async getSpans(traceId: string): Promise<Span[] | undefined> {
    return this.spans.get(traceId)
  }

  async clear(): Promise<void> {
    this.traces.clear()
    this.evaluations.clear()
    this.spans.clear()
    
    // Optionally delete files
    try {
      await fs.rm(this.directory, { recursive: true, force: true })
      await this.initialize()
    } catch (error) {
      console.warn('Failed to clear local storage:', error)
    }
  }

  async export(format: 'json'): Promise<string> {
    const data = {
      traces: Array.from(this.traces.values()),
      evaluations: Array.from(this.evaluations.values()),
      spans: Object.fromEntries(this.spans)
    }
    
    const exportPath = path.join(this.directory, `export-${Date.now()}.json`)
    await fs.writeFile(exportPath, JSON.stringify(data, null, 2))
    
    return exportPath
  }

  getStats() {
    return {
      traces: this.traces.size,
      evaluations: this.evaluations.size,
      totalSpans: Array.from(this.spans.values()).reduce((sum, spans) => sum + spans.length, 0)
    }
  }
}