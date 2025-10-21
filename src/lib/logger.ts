/**
 * Structured logging utility
 * Replaces console.log/error calls with proper structured logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

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

    // In production, this could send to external logging service
    // For now, structured console output
    const output = JSON.stringify(logEntry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(output);
        }
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, meta?: LogContext) {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: LogContext) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: LogContext) {
    this.log('warn', message, meta);
  }

  error(metaOrMessage: LogContext | string, messageOrError?: string | Error | unknown, additionalMeta?: LogContext) {
    // Support both: logger.error({ meta }, 'message') and logger.error('message', error)
    let message: string;
    let meta: LogContext;

    if (typeof metaOrMessage === 'string') {
      // Old signature: error(message, error, meta)
      message = metaOrMessage;
      const error = messageOrError;
      const errorMeta = error instanceof Error 
        ? { error: error.message, stack: error.stack, ...additionalMeta }
        : error 
          ? { error: String(error), ...additionalMeta }
          : additionalMeta || {};
      meta = errorMeta;
    } else {
      // New signature: error({ meta }, message)
      meta = metaOrMessage;
      message = typeof messageOrError === 'string' ? messageOrError : 'Error occurred';
    }
    
    this.log('error', message, meta);
  }

  child(context: LogContext): Logger {
    return new Logger({ ...this.context, ...context });
  }
}

// Default logger instance
export const logger = new Logger({
  service: 'ai-evaluation-platform',
  environment: process.env.NODE_ENV || 'development',
});

// Create logger for specific modules
export function createModuleLogger(module: string): Logger {
  return logger.child({ module });
}

