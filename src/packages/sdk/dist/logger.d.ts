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
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
export interface LoggerOptions {
    /** Log level (default: 'info') */
    level?: LogLevel;
    /** Pretty print logs (default: false) */
    pretty?: boolean;
    /** Include timestamps (default: true) */
    timestamps?: boolean;
    /** Custom log handler */
    handler?: (entry: LogEntry) => void;
    /** Prefix for all logs */
    prefix?: string;
}
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    data?: any;
    prefix?: string;
}
/**
 * Logger for SDK debugging and troubleshooting
 */
export declare class Logger {
    private options;
    constructor(options?: LoggerOptions);
    /**
     * Log a trace message
     */
    trace(message: string, data?: any): void;
    /**
     * Log a debug message
     */
    debug(message: string, data?: any): void;
    /**
     * Log an info message
     */
    info(message: string, data?: any): void;
    /**
     * Log a warning message
     */
    warn(message: string, data?: any): void;
    /**
     * Log an error message
     */
    error(message: string, data?: any): void;
    /**
     * Log HTTP request
     */
    logRequest(method: string, url: string, data?: any): void;
    /**
     * Log HTTP response
     */
    logResponse(method: string, url: string, status: number, duration: number, data?: any): void;
    /**
     * Create child logger with prefix
     */
    child(prefix: string): Logger;
    /**
     * Set log level
     */
    setLevel(level: LogLevel): void;
    /**
     * Check if level is enabled
     */
    isLevelEnabled(level: LogLevel): boolean;
    private log;
    private defaultHandler;
}
/**
 * Create a logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger({ level: 'debug', pretty: true });
 * logger.debug('Starting evaluation');
 * ```
 */
export declare function createLogger(options?: LoggerOptions): Logger;
/**
 * Get global logger (creates one if it doesn't exist)
 */
export declare function getLogger(): Logger;
/**
 * Set global logger
 */
export declare function setLogger(logger: Logger): void;
/**
 * Request/Response interceptor for logging
 */
export declare class RequestLogger {
    private logger;
    constructor(logger: Logger);
    /**
     * Log request before sending
     */
    logRequest(request: {
        method: string;
        url: string;
        headers?: Record<string, string>;
        body?: any;
    }): void;
    /**
     * Log response after receiving
     */
    logResponse(response: {
        method: string;
        url: string;
        status: number;
        duration: number;
        headers?: Record<string, string>;
        body?: any;
    }): void;
}
