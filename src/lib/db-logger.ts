import { logger } from './logger';

/**
 * Database query logger for monitoring and debugging
 */

interface QueryLog {
  query: string;
  params?: any[];
  duration?: number;
  table?: string;
  operation?: 'select' | 'insert' | 'update' | 'delete';
}

const dbLogger = logger.child({ module: 'database' });

/**
 * Log database queries with duration
 */
export function logQuery(log: QueryLog) {
  const { query, params, duration, table, operation } = log;
  
  if (duration && duration > 1000) {
    // Warn on slow queries (> 1s)
    dbLogger.warn('Slow database query detected', {
      query,
      duration,
      table,
      operation,
      threshold: '1000ms',
    });
  } else if (process.env.NODE_ENV === 'development') {
    // Log all queries in development
    dbLogger.debug('Database query', {
      query,
      params,
      duration,
      table,
      operation,
    });
  }
}

/**
 * Wrap database operations with timing and logging
 */
export async function withQueryLogging<T>(
  operation: () => Promise<T>,
  metadata: Omit<QueryLog, 'duration'>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await operation();
    const duration = Date.now() - startTime;
    
    logQuery({ ...metadata, duration });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    dbLogger.error('Database query failed', error as Error, {
      ...metadata,
      duration,
    });
    
    throw error;
  }
}

/**
 * Log connection pool stats
 */
export function logConnectionStats(stats: {
  active: number;
  idle: number;
  waiting: number;
}) {
  dbLogger.info('Database connection pool stats', stats);
}

/**
 * Log database errors
 */
export function logDatabaseError(error: Error, context?: Record<string, any>) {
  dbLogger.error('Database error', error, context);
}

