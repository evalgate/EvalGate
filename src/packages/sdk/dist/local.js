"use strict";
/**
 * Local Development Mode (Tier 2.10)
 * Offline mode with local storage for development
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorage = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class LocalStorage {
    constructor(options = {}) {
        this.traces = new Map();
        this.evaluations = new Map();
        this.spans = new Map();
        this.directory = options.directory || './.evalai-data';
        this.autoSave = options.autoSave !== false;
        this.initialize();
    }
    async initialize() {
        try {
            await promises_1.default.mkdir(this.directory, { recursive: true });
            await promises_1.default.mkdir(path_1.default.join(this.directory, 'traces'), { recursive: true });
            await promises_1.default.mkdir(path_1.default.join(this.directory, 'evaluations'), { recursive: true });
            await promises_1.default.mkdir(path_1.default.join(this.directory, 'spans'), { recursive: true });
            // Load existing data
            await this.loadAllData();
        }
        catch (error) {
            console.warn('Failed to initialize local storage:', error);
        }
    }
    async loadAllData() {
        try {
            // Load traces
            const tracesDir = path_1.default.join(this.directory, 'traces');
            const traceFiles = await promises_1.default.readdir(tracesDir);
            for (const file of traceFiles) {
                if (file.endsWith('.json')) {
                    const content = await promises_1.default.readFile(path_1.default.join(tracesDir, file), 'utf-8');
                    const trace = JSON.parse(content);
                    this.traces.set(trace.id.toString(), trace);
                }
            }
            // Load evaluations
            const evalsDir = path_1.default.join(this.directory, 'evaluations');
            const evalFiles = await promises_1.default.readdir(evalsDir);
            for (const file of evalFiles) {
                if (file.endsWith('.json')) {
                    const content = await promises_1.default.readFile(path_1.default.join(evalsDir, file), 'utf-8');
                    const evaluation = JSON.parse(content);
                    this.evaluations.set(evaluation.id.toString(), evaluation);
                }
            }
        }
        catch (error) {
            // Directories might not exist yet, that's fine
        }
    }
    async saveTraceToDisk(trace) {
        const filePath = path_1.default.join(this.directory, 'traces', `${trace.id}.json`);
        await promises_1.default.writeFile(filePath, JSON.stringify(trace, null, 2));
    }
    async saveTrace(trace) {
        this.traces.set(trace.id.toString(), trace);
        if (this.autoSave) {
            await this.saveTraceToDisk(trace);
        }
    }
    async getTrace(id) {
        return this.traces.get(id);
    }
    async listTraces() {
        return Array.from(this.traces.values());
    }
    async saveEvaluationToDisk(evaluation) {
        const filePath = path_1.default.join(this.directory, 'evaluations', `${evaluation.id}.json`);
        await promises_1.default.writeFile(filePath, JSON.stringify(evaluation, null, 2));
    }
    async saveEvaluation(evaluation) {
        this.evaluations.set(evaluation.id.toString(), evaluation);
        if (this.autoSave) {
            await this.saveEvaluationToDisk(evaluation);
        }
    }
    async getEvaluation(id) {
        return this.evaluations.get(id);
    }
    async listEvaluations() {
        return Array.from(this.evaluations.values());
    }
    async saveSpansToDisk(traceId, spans) {
        const filePath = path_1.default.join(this.directory, 'spans', `${traceId}.json`);
        await promises_1.default.writeFile(filePath, JSON.stringify(spans, null, 2));
    }
    async saveSpans(traceId, spans) {
        this.spans.set(traceId, spans);
        if (this.autoSave) {
            await this.saveSpansToDisk(traceId, spans);
        }
    }
    async getSpans(traceId) {
        return this.spans.get(traceId);
    }
    async clear() {
        this.traces.clear();
        this.evaluations.clear();
        this.spans.clear();
        // Optionally delete files
        try {
            await promises_1.default.rm(this.directory, { recursive: true, force: true });
            await this.initialize();
        }
        catch (error) {
            console.warn('Failed to clear local storage:', error);
        }
    }
    async export(format) {
        const data = {
            traces: Array.from(this.traces.values()),
            evaluations: Array.from(this.evaluations.values()),
            spans: Object.fromEntries(this.spans)
        };
        const exportPath = path_1.default.join(this.directory, `export-${Date.now()}.json`);
        await promises_1.default.writeFile(exportPath, JSON.stringify(data, null, 2));
        return exportPath;
    }
    getStats() {
        return {
            traces: this.traces.size,
            evaluations: this.evaluations.size,
            totalSpans: Array.from(this.spans.values()).reduce((sum, spans) => sum + spans.length, 0)
        };
    }
}
exports.LocalStorage = LocalStorage;
