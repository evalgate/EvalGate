"use strict";
/**
 * Debug Mode with Request Logging
 * Tier 4.17: Troubleshooting utilities
 *
 * @example
 * ```typescript
 * import { createLogger } from '@ai-eval-platform/sdk';
 *
 * const logger = createLogger({ level: 'debug', pretty: true });
 *
 * logger.debug('Trace created', { traceId: '123' });
 * logger.error('Request failed', { error: err });
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestLogger = exports.Logger = void 0;
exports.createLogger = createLogger;
exports.getLogger = getLogger;
exports.setLogger = setLogger;
const LOG_LEVELS = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4
};
const LOG_COLORS = {
    trace: '\x1b[90m', // gray
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m', // green
    warn: '\x1b[33m', // yellow
    error: '\x1b[31m' // red
};
const COLOR_RESET = '\x1b[0m';
/**
 * Logger for SDK debugging and troubleshooting
 */
class Logger {
    constructor(options = {}) {
        this.options = {
            level: options.level || 'info',
            pretty: options.pretty ?? false,
            timestamps: options.timestamps ?? true,
            handler: options.handler || this.defaultHandler.bind(this),
            prefix: options.prefix || 'EvalAI'
        };
    }
    /**
     * Log a trace message
     */
    trace(message, data) {
        this.log('trace', message, data);
    }
    /**
     * Log a debug message
     */
    debug(message, data) {
        this.log('debug', message, data);
    }
    /**
     * Log an info message
     */
    info(message, data) {
        this.log('info', message, data);
    }
    /**
     * Log a warning message
     */
    warn(message, data) {
        this.log('warn', message, data);
    }
    /**
     * Log an error message
     */
    error(message, data) {
        this.log('error', message, data);
    }
    /**
     * Log HTTP request
     */
    logRequest(method, url, data) {
        this.debug(`→ ${method} ${url}`, data);
    }
    /**
     * Log HTTP response
     */
    logResponse(method, url, status, duration, data) {
        const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'debug';
        this.log(level, `← ${method} ${url} ${status} (${duration}ms)`, data);
    }
    /**
     * Create child logger with prefix
     */
    child(prefix) {
        return new Logger({
            ...this.options,
            prefix: `${this.options.prefix}:${prefix}`
        });
    }
    /**
     * Set log level
     */
    setLevel(level) {
        this.options.level = level;
    }
    /**
     * Check if level is enabled
     */
    isLevelEnabled(level) {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.options.level];
    }
    log(level, message, data) {
        if (!this.isLevelEnabled(level))
            return;
        const entry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            data,
            prefix: this.options.prefix
        };
        this.options.handler(entry);
    }
    defaultHandler(entry) {
        const parts = [];
        // Timestamp
        if (this.options.timestamps) {
            const time = this.options.pretty
                ? new Date(entry.timestamp).toLocaleTimeString()
                : entry.timestamp;
            parts.push(this.options.pretty ? `\x1b[90m${time}${COLOR_RESET}` : time);
        }
        // Level
        const levelStr = entry.level.toUpperCase().padEnd(5);
        parts.push(this.options.pretty
            ? `${LOG_COLORS[entry.level]}${levelStr}${COLOR_RESET}`
            : levelStr);
        // Prefix
        if (entry.prefix) {
            parts.push(this.options.pretty
                ? `\x1b[35m[${entry.prefix}]${COLOR_RESET}`
                : `[${entry.prefix}]`);
        }
        // Message
        parts.push(entry.message);
        // Log
        const logLine = parts.join(' ');
        if (entry.level === 'error') {
            console.error(logLine);
        }
        else if (entry.level === 'warn') {
            console.warn(logLine);
        }
        else {
            console.log(logLine);
        }
        // Data
        if (entry.data !== undefined) {
            if (this.options.pretty) {
                console.log(JSON.stringify(entry.data, null, 2));
            }
            else {
                console.log(JSON.stringify(entry.data));
            }
        }
    }
}
exports.Logger = Logger;
/**
 * Create a logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger({ level: 'debug', pretty: true });
 * logger.debug('Starting evaluation');
 * ```
 */
function createLogger(options) {
    return new Logger(options);
}
/**
 * Global logger instance
 */
let globalLogger;
/**
 * Get global logger (creates one if it doesn't exist)
 */
function getLogger() {
    if (!globalLogger) {
        globalLogger = new Logger();
    }
    return globalLogger;
}
/**
 * Set global logger
 */
function setLogger(logger) {
    globalLogger = logger;
}
/**
 * Request/Response interceptor for logging
 */
class RequestLogger {
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * Log request before sending
     */
    logRequest(request) {
        this.logger.logRequest(request.method, request.url, {
            headers: request.headers,
            body: request.body
        });
    }
    /**
     * Log response after receiving
     */
    logResponse(response) {
        this.logger.logResponse(response.method, response.url, response.status, response.duration, {
            headers: response.headers,
            body: response.body
        });
    }
}
exports.RequestLogger = RequestLogger;
