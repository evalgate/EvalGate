"use strict";
/**
 * EvalGate Runtime Registry - Layer 1 Foundation
 *
 * Scoped registry with proper lifecycle management.
 * Prevents cross-run contamination and memory leaks.
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
exports.createEvalRuntime = createEvalRuntime;
exports.withRuntime = withRuntime;
exports.getActiveRuntime = getActiveRuntime;
exports.setActiveRuntime = setActiveRuntime;
exports.disposeActiveRuntime = disposeActiveRuntime;
const crypto = __importStar(require("node:crypto"));
const path = __importStar(require("node:path"));
const types_1 = require("./types");
/**
 * Runtime registry implementation
 * Scoped lifecycle with proper memory management
 */
class EvalRuntimeImpl {
    constructor(projectRoot) {
        this.specs = new Map();
        this.disposed = false;
        this.id = crypto.randomUUID();
        this.namespace = this.generateNamespace(projectRoot);
        this.createdAt = new Date();
    }
    /**
     * Generate project namespace from project root
     * Content-addressable to prevent collisions
     */
    generateNamespace(projectRoot) {
        return crypto
            .createHash("sha256")
            .update(path.resolve(projectRoot))
            .digest("hex")
            .slice(0, 12);
    }
    /**
     * Register a new specification
     */
    register(spec) {
        if (this.disposed) {
            throw new types_1.RuntimeError("Runtime has been disposed", {
                runtimeId: this.id,
                namespace: this.namespace,
            });
        }
        // Validate specification
        this.validateSpec(spec);
        // Check for existing spec with same ID
        if (this.specs.has(spec.id)) {
            throw new types_1.SpecRegistrationError(`Specification with ID '${spec.id}' already exists`, {
                specId: spec.id,
                specName: spec.name,
                filePath: spec.filePath,
            });
        }
        // Register specification
        this.specs.set(spec.id, spec);
    }
    /**
     * Get specification by ID
     */
    get(id) {
        if (this.disposed) {
            throw new types_1.RuntimeError("Runtime has been disposed");
        }
        return this.specs.get(id);
    }
    /**
     * List all registered specifications
     */
    list() {
        if (this.disposed) {
            throw new types_1.RuntimeError("Runtime has been disposed");
        }
        return Array.from(this.specs.values());
    }
    /**
     * Find specifications by criteria
     */
    find(criteria) {
        if (this.disposed) {
            throw new types_1.RuntimeError("Runtime has been disposed");
        }
        return Array.from(this.specs.values()).filter((spec) => {
            // Tag filtering
            if (criteria.tags && criteria.tags.length > 0) {
                const specTags = spec.tags || [];
                if (!criteria.tags.some((tag) => specTags.includes(tag))) {
                    return false;
                }
            }
            // File filtering
            if (criteria.files && criteria.files.length > 0) {
                if (!criteria.files.includes(spec.filePath)) {
                    return false;
                }
            }
            // Name filtering
            if (criteria.names && criteria.names.length > 0) {
                if (!criteria.names.includes(spec.name)) {
                    return false;
                }
            }
            // Metadata filtering
            if (criteria.metadata) {
                const specMetadata = spec.metadata || {};
                for (const [key, value] of Object.entries(criteria.metadata)) {
                    if (specMetadata[key] !== value) {
                        return false;
                    }
                }
            }
            return true;
        });
    }
    /**
     * Clear all specifications and dispose runtime
     */
    clear() {
        this.specs.clear();
        this.disposed = true;
    }
    /**
     * Create runtime snapshot for persistence
     */
    snapshot() {
        if (this.disposed) {
            throw new types_1.RuntimeError("Runtime has been disposed");
        }
        const serializedSpecs = Array.from(this.specs.values()).map((spec) => ({
            id: spec.id,
            name: spec.name,
            filePath: spec.filePath,
            position: spec.position,
            description: spec.description,
            tags: spec.tags,
            metadata: spec.metadata,
            config: spec.config,
            executorSerialized: false, // Cannot serialize functions
        }));
        return {
            runtimeId: this.id,
            namespace: this.namespace,
            createdAt: this.createdAt.toISOString(),
            specs: serializedSpecs,
            version: "1.0.0",
        };
    }
    /**
     * Load runtime from snapshot
     * Note: Executors cannot be serialized and must be recreated
     */
    load(snapshot) {
        if (this.disposed) {
            throw new types_1.RuntimeError("Runtime has been disposed");
        }
        if (snapshot.runtimeId !== this.id) {
            throw new types_1.RuntimeError("Snapshot runtime ID does not match current runtime");
        }
        if (snapshot.namespace !== this.namespace) {
            throw new types_1.RuntimeError("Snapshot namespace does not match current runtime");
        }
        // Clear current specs
        this.specs.clear();
        // Load specs from snapshot (without executors)
        for (const serializedSpec of snapshot.specs) {
            // Note: Executors cannot be restored from snapshot
            // Users must recreate the defineEval calls to restore executors
            console.warn(`Cannot restore executor for spec '${serializedSpec.name}' from snapshot`);
        }
    }
    /**
     * Get runtime statistics
     */
    get stats() {
        if (this.disposed) {
            throw new types_1.RuntimeError("Runtime has been disposed");
        }
        const specsByTag = {};
        const specsByFile = {};
        for (const spec of this.specs.values()) {
            // Count by tags
            const tags = spec.tags || [];
            for (const tag of tags) {
                specsByTag[tag] = (specsByTag[tag] || 0) + 1;
            }
            // Count by files
            specsByFile[spec.filePath] = (specsByFile[spec.filePath] || 0) + 1;
        }
        // Estimate memory usage (rough calculation)
        const memoryUsage = this.estimateMemoryUsage();
        return {
            totalSpecs: this.specs.size,
            specsByTag,
            specsByFile,
            memoryUsage,
            lastUpdated: new Date(),
        };
    }
    /**
     * Get runtime health information
     */
    getHealth() {
        if (this.disposed) {
            return {
                status: "error",
                memoryUsage: 0,
                specCount: 0,
                issues: ["Runtime has been disposed"],
            };
        }
        const issues = [];
        const memoryUsage = this.estimateMemoryUsage();
        // Memory usage warnings
        if (memoryUsage > 50 * 1024 * 1024) {
            // 50MB
            issues.push("High memory usage detected");
        }
        // Spec count warnings
        if (this.specs.size > 10000) {
            issues.push("Large number of specifications may impact performance");
        }
        let status = "healthy";
        if (issues.length > 0) {
            status = issues.some((issue) => issue.includes("error"))
                ? "error"
                : "warning";
        }
        return {
            status,
            memoryUsage,
            specCount: this.specs.size,
            issues,
        };
    }
    /**
     * Validate specification before registration
     */
    validateSpec(spec) {
        if (!spec.name || spec.name.trim() === "") {
            throw new types_1.SpecRegistrationError("Specification name is required", {
                spec,
            });
        }
        if (!spec.filePath || spec.filePath.trim() === "") {
            throw new types_1.SpecRegistrationError("Specification file path is required", {
                spec,
            });
        }
        if (!spec.executor || typeof spec.executor !== "function") {
            throw new types_1.SpecRegistrationError("Specification executor is required and must be a function", {
                spec,
            });
        }
        if (!spec.position ||
            typeof spec.position.line !== "number" ||
            typeof spec.position.column !== "number") {
            throw new types_1.SpecRegistrationError("Specification AST position is required", {
                spec,
            });
        }
        // Validate ID format
        if (!spec.id || spec.id.length !== 20) {
            throw new types_1.SpecRegistrationError("Specification ID must be 20 characters long", {
                spec,
            });
        }
    }
    /**
     * Estimate memory usage of the registry
     */
    estimateMemoryUsage() {
        // Rough estimation: each spec ~1KB of data
        return this.specs.size * 1024;
    }
}
/**
 * Create a new scoped runtime with lifecycle management
 * Returns a handle for proper resource management
 */
function createEvalRuntime(projectRoot = process.cwd()) {
    const runtime = new EvalRuntimeImpl(projectRoot);
    // Create bound defineEval function
    const boundDefineEval = ((nameOrConfig, executor, options) => {
        // Temporarily set this runtime as active
        const previousRuntime = activeRuntime;
        activeRuntime = runtime;
        try {
            // Import and call defineEval
            const { defineEval } = require("./eval");
            return defineEval(nameOrConfig, executor, options);
        }
        finally {
            // Restore previous runtime
            activeRuntime = previousRuntime;
        }
    });
    return {
        runtime,
        defineEval: boundDefineEval,
        dispose: () => {
            runtime.clear();
            if (activeRuntime === runtime) {
                activeRuntime = null;
            }
        },
        snapshot: () => runtime.snapshot(),
        load: (snapshot) => runtime.load(snapshot),
    };
}
/**
 * Helper function for safe runtime execution with automatic cleanup
 * Ensures runtime is disposed even if an exception is thrown
 */
async function withRuntime(projectRoot, fn) {
    const handle = createEvalRuntime(projectRoot);
    try {
        return await fn(handle);
    }
    finally {
        // Always dispose, even on exception
        handle.dispose();
    }
}
/**
 * Get the currently active runtime (for backward compatibility)
 */
let activeRuntime = null;
function getActiveRuntime() {
    if (!activeRuntime) {
        activeRuntime = new EvalRuntimeImpl(process.cwd());
    }
    return activeRuntime;
}
/**
 * Set the active runtime (for backward compatibility)
 */
function setActiveRuntime(runtime) {
    if (activeRuntime) {
        throw new types_1.RuntimeError("Active runtime already exists");
    }
    activeRuntime = runtime;
}
/**
 * Dispose the active runtime (for backward compatibility)
 */
function disposeActiveRuntime() {
    if (activeRuntime) {
        activeRuntime.clear();
        activeRuntime = null;
    }
}
/**
 * Runtime cleanup hook for process termination
 */
process.on("exit", () => {
    disposeActiveRuntime();
});
process.on("SIGINT", () => {
    disposeActiveRuntime();
    process.exit(0);
});
process.on("SIGTERM", () => {
    disposeActiveRuntime();
    process.exit(0);
});
