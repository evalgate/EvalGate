/**
 * Structured logging utility
 *
 * Console output is always emitted (Vercel captures it automatically).
 * For external log drains, set LOG_DRAIN_URL to an HTTPS ingest endpoint
 * (Axiom, Betterstack, Datadog, etc.) and logs are shipped in batches.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
	[key: string]: unknown;
}

const LOG_DRAIN_URL =
	typeof process !== "undefined" ? process.env.LOG_DRAIN_URL : undefined;
const DRAIN_BATCH_SIZE = 20;
const DRAIN_FLUSH_MS = 5_000;

let drainBuffer: Record<string, unknown>[] = [];
let drainTimer: ReturnType<typeof setTimeout> | null = null;

function flushDrain() {
	if (drainBuffer.length === 0 || !LOG_DRAIN_URL) return;
	const batch = drainBuffer;
	drainBuffer = [];
	drainTimer = null;

	fetch(LOG_DRAIN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(batch),
	}).catch(() => {});
}

function enqueueDrain(entry: Record<string, unknown>) {
	if (!LOG_DRAIN_URL) return;
	drainBuffer.push(entry);
	if (drainBuffer.length >= DRAIN_BATCH_SIZE) {
		flushDrain();
	} else if (!drainTimer) {
		drainTimer = setTimeout(flushDrain, DRAIN_FLUSH_MS);
	}
}

/** Structured JSON logger that writes to the console and can be extended with child contexts. */
class Logger {
	private context: LogContext;

	constructor(context: LogContext = {}) {
		this.context = context;
	}

	private log(level: LogLevel, message: string, meta: LogContext = {}) {
		const timestamp = new Date().toISOString();
		const logEntry = {
			timestamp,
			level,
			message,
			...this.context,
			...meta,
		};

		let output: string;
		try {
			output = JSON.stringify(logEntry);
		} catch {
			const safe = { timestamp, level, message, _serializationError: true };
			output = JSON.stringify(safe);
		}

		switch (level) {
			case "error":
				console.error(output);
				break;
			case "warn":
				console.warn(output);
				break;
			case "debug":
				if (process.env.NODE_ENV === "development") {
					console.debug(output);
				}
				break;
			default:
				console.log(output);
		}

		if (level !== "debug") {
			enqueueDrain(logEntry);
		}
	}

	/** Log at DEBUG level (suppressed outside development). */
	debug(message: string, meta?: LogContext) {
		this.log("debug", message, meta);
	}

	/** Log at INFO level. */
	info(message: string, meta?: LogContext) {
		this.log("info", message, meta);
	}

	/** Log at WARN level. */
	warn(message: string, meta?: LogContext) {
		this.log("warn", message, meta);
	}

	/** Log at ERROR level. Accepts `(message, error?, meta?)` or `(meta, message)` signatures. */
	error(
		metaOrMessage: LogContext | string,
		messageOrError?: string | Error | unknown,
		additionalMeta?: LogContext,
	) {
		// Support both: logger.error({ meta }, 'message') and logger.error('message', error)
		let message: string;
		let meta: LogContext;

		if (typeof metaOrMessage === "string") {
			// Old signature: error(message, error, meta)
			message = metaOrMessage;
			const error = messageOrError;
			const errorMeta =
				error instanceof Error
					? { error: error.message, stack: error.stack, ...additionalMeta }
					: error
						? { error: String(error), ...additionalMeta }
						: additionalMeta || {};
			meta = errorMeta;
		} else {
			// New signature: error({ meta }, message)
			meta = metaOrMessage;
			message =
				typeof messageOrError === "string" ? messageOrError : "Error occurred";
		}

		this.log("error", message, meta);
	}

	/** Create a child logger that inherits this logger's context plus additional fields. */
	child(context: LogContext): Logger {
		return new Logger({ ...this.context, ...context });
	}
}

/** Default application-wide logger instance. */
export const logger = new Logger({
	service: "evalgate",
	environment: process.env.NODE_ENV || "development",
});

/** Create a child logger scoped to a specific module name. */
export function createModuleLogger(module: string): Logger {
	return logger.child({ module });
}
