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

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

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
	data?: unknown;
	prefix?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
	trace: 0,
	debug: 1,
	info: 2,
	warn: 3,
	error: 4,
};

const LOG_COLORS: Record<LogLevel, string> = {
	trace: "\x1b[90m", // gray
	debug: "\x1b[36m", // cyan
	info: "\x1b[32m", // green
	warn: "\x1b[33m", // yellow
	error: "\x1b[31m", // red
};

const COLOR_RESET = "\x1b[0m";

/**
 * Logger for SDK debugging and troubleshooting
 */
export class Logger {
	private options: Required<LoggerOptions>;

	constructor(options: LoggerOptions = {}) {
		this.options = {
			level: options.level || "info",
			pretty: options.pretty ?? false,
			timestamps: options.timestamps ?? true,
			handler: options.handler || this.defaultHandler.bind(this),
			prefix: options.prefix || "EvalGate",
		};
	}

	/**
	 * Log a trace message
	 */
	trace(message: string, data?: unknown): void {
		this.log("trace", message, data);
	}

	/**
	 * Log a debug message
	 */
	debug(message: string, data?: unknown): void {
		this.log("debug", message, data);
	}

	/**
	 * Log an info message
	 */
	info(message: string, data?: unknown): void {
		this.log("info", message, data);
	}

	/**
	 * Log a warning message
	 */
	warn(message: string, data?: unknown): void {
		this.log("warn", message, data);
	}

	/**
	 * Log an error message
	 */
	error(message: string, data?: unknown): void {
		this.log("error", message, data);
	}

	/**
	 * Log HTTP request
	 */
	logRequest(method: string, url: string, data?: unknown): void {
		this.debug(`→ ${method} ${url}`, data);
	}

	/**
	 * Log HTTP response
	 */
	logResponse(
		method: string,
		url: string,
		status: number,
		duration: number,
		data?: unknown,
	): void {
		const level = status >= 400 ? "error" : status >= 300 ? "warn" : "debug";
		this.log(level, `← ${method} ${url} ${status} (${duration}ms)`, data);
	}

	/**
	 * Create child logger with prefix
	 */
	child(prefix: string | { prefix: string }): Logger {
		const resolvedPrefix = typeof prefix === "string" ? prefix : prefix.prefix;
		return new Logger({
			...this.options,
			prefix: `${this.options.prefix}:${resolvedPrefix}`,
		});
	}

	/**
	 * Set log level
	 */
	setLevel(level: LogLevel): void {
		this.options.level = level;
	}

	/**
	 * Check if level is enabled
	 */
	isLevelEnabled(level: LogLevel): boolean {
		return LOG_LEVELS[level] >= LOG_LEVELS[this.options.level];
	}

	private log(level: LogLevel, message: string, data?: unknown): void {
		if (!this.isLevelEnabled(level)) return;

		const entry: LogEntry = {
			level,
			message,
			timestamp: new Date().toISOString(),
			data,
			prefix: this.options.prefix,
		};

		this.options.handler(entry);
	}

	private defaultHandler(entry: LogEntry): void {
		const parts: string[] = [];

		// Timestamp
		if (this.options.timestamps) {
			const time = this.options.pretty
				? new Date(entry.timestamp).toLocaleTimeString()
				: entry.timestamp;
			parts.push(this.options.pretty ? `\x1b[90m${time}${COLOR_RESET}` : time);
		}

		// Level
		const levelStr = entry.level.toUpperCase().padEnd(5);
		parts.push(
			this.options.pretty
				? `${LOG_COLORS[entry.level]}${levelStr}${COLOR_RESET}`
				: levelStr,
		);

		// Prefix
		if (entry.prefix) {
			parts.push(
				this.options.pretty
					? `\x1b[35m[${entry.prefix}]${COLOR_RESET}`
					: `[${entry.prefix}]`,
			);
		}

		// Message
		parts.push(entry.message);

		// Log
		const logLine = parts.join(" ");

		if (entry.level === "error") {
			console.error(logLine);
		} else if (entry.level === "warn") {
			console.warn(logLine);
		} else {
			console.log(logLine);
		}

		// Data
		if (entry.data !== undefined) {
			if (this.options.pretty) {
				console.log(JSON.stringify(entry.data, null, 2));
			} else {
				console.log(JSON.stringify(entry.data));
			}
		}
	}
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
export function createLogger(options?: LoggerOptions): Logger {
	return new Logger(options);
}

/**
 * Global logger instance
 */
let globalLogger: Logger | undefined;

/**
 * Get global logger (creates one if it doesn't exist)
 */
export function getLogger(): Logger {
	if (!globalLogger) {
		globalLogger = new Logger();
	}
	return globalLogger;
}

/**
 * Set global logger
 */
export function setLogger(logger: Logger): void {
	globalLogger = logger;
}

/**
 * Request/Response interceptor for logging
 */
export class RequestLogger {
	constructor(private logger: Logger) {}

	/**
	 * Log request before sending
	 */
	logRequest(request: {
		method: string;
		url: string;
		headers?: Record<string, string>;
		body?: unknown;
	}): void {
		this.logger.logRequest(request.method, request.url, {
			headers: request.headers,
			body: request.body,
		});
	}

	/**
	 * Log response after receiving
	 */
	logResponse(response: {
		method: string;
		url: string;
		status: number;
		duration: number;
		headers?: Record<string, string>;
		body?: unknown;
	}): void {
		this.logger.logResponse(
			response.method,
			response.url,
			response.status,
			response.duration,
			{
				headers: response.headers,
				body: response.body,
			},
		);
	}
}
