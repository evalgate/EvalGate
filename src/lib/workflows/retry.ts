/**
 * Workflow Retry & Fallback Logic
 * Enterprise-grade retry mechanisms with fallback models and human escalation
 */

import type { WorkflowTracer } from '@/packages/sdk/src/workflows';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Retry configuration options
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Fallback model to use on failure */
  fallbackModel?: string;
  /** Whether to escalate to human on final failure */
  escalateOnFailure?: boolean;
  /** Initial delay between retries in ms */
  initialDelayMs?: number;
  /** Maximum delay between retries in ms */
  maxDelayMs?: number;
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Custom error handler */
  onError?: (error: Error, attempt: number) => void;
  /** Custom retry condition */
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

/**
 * Execution result with retry metadata
 */
export interface ExecutionResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  usedFallback: boolean;
  escalatedToHuman: boolean;
  totalDurationMs: number;
  retryHistory: RetryAttempt[];
}

/**
 * Individual retry attempt record
 */
export interface RetryAttempt {
  attempt: number;
  timestamp: string;
  durationMs: number;
  error?: string;
  model?: string;
  action: 'primary' | 'fallback' | 'escalate';
}

/**
 * Human escalation request
 */
export interface HumanEscalationRequest {
  id: string;
  workflowRunId?: number;
  error: string;
  context: Record<string, any>;
  attempts: RetryAttempt[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'dismissed';
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'fallbackModel' | 'onError' | 'shouldRetry'>> & Pick<RetryConfig, 'fallbackModel' | 'onError' | 'shouldRetry'> = {
  maxRetries: 3,
  fallbackModel: undefined,
  escalateOnFailure: true,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  onError: undefined,
  shouldRetry: undefined,
};

// ============================================================================
// RETRY UTILITIES
// ============================================================================

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: typeof DEFAULT_CONFIG): number {
  const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  const jitter = Math.random() * 0.3 * baseDelay; // 30% jitter
  return Math.min(baseDelay + jitter, config.maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Default retry condition - retry on transient errors
 */
function defaultShouldRetry(error: Error, attempt: number): boolean {
  const message = error.message.toLowerCase();
  
  // Retry on rate limits
  if (message.includes('rate limit') || message.includes('429')) {
    return true;
  }
  
  // Retry on timeout
  if (message.includes('timeout') || message.includes('timed out')) {
    return true;
  }
  
  // Retry on temporary server errors
  if (message.includes('503') || message.includes('502') || message.includes('500')) {
    return true;
  }
  
  // Retry on network errors
  if (message.includes('network') || message.includes('connection')) {
    return true;
  }
  
  // Don't retry on auth errors, validation errors, etc.
  if (message.includes('401') || message.includes('403') || message.includes('400')) {
    return false;
  }
  
  return true; // Default to retry
}

// ============================================================================
// MAIN RETRY FUNCTION
// ============================================================================

/**
 * Execute a function with retry logic, fallback models, and human escalation
 * 
 * @example
 * ```typescript
 * const result = await executeWithRetry(
 *   async () => await agent.run(input),
 *   {
 *     maxRetries: 3,
 *     fallbackModel: 'gpt-3.5-turbo',
 *     escalateOnFailure: true
 *   },
 *   tracer
 * );
 * ```
 */
export async function executeWithRetry<T>(
  agentFn: () => Promise<T>,
  config: RetryConfig = {},
  tracer?: WorkflowTracer,
  context?: Record<string, any>
): Promise<ExecutionResult<T>> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const retryHistory: RetryAttempt[] = [];
  
  let lastError: Error | undefined;
  let usedFallback = false;
  let escalatedToHuman = false;

  // Primary execution with retries
  for (let attempt = 1; attempt <= cfg.maxRetries; attempt++) {
    const attemptStart = Date.now();
    
    try {
      const result = await agentFn();
      
      retryHistory.push({
        attempt,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - attemptStart,
        action: 'primary',
      });

      // Record success decision if tracer provided
      if (tracer) {
        await tracer.recordDecision({
          agent: 'RetryHandler',
          type: 'action',
          chosen: 'success',
          alternatives: [],
          reasoning: `Succeeded on attempt ${attempt}`,
          confidence: 100,
        });
      }

      return {
        success: true,
        result,
        attempts: attempt,
        usedFallback: false,
        escalatedToHuman: false,
        totalDurationMs: Date.now() - startTime,
        retryHistory,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      retryHistory.push({
        attempt,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - attemptStart,
        error: lastError.message,
        action: 'primary',
      });

      // Call custom error handler
      if (cfg.onError) {
        cfg.onError(lastError, attempt);
      }

      // Record retry decision if tracer provided
      if (tracer) {
        await tracer.recordDecision({
          agent: 'RetryHandler',
          type: 'action',
          chosen: 'retry',
          alternatives: [
            { action: 'use_fallback_model', confidence: 0.6, reasoning: 'Could switch to fallback' },
            { action: 'escalate_to_human', confidence: 0.4, reasoning: 'Could escalate immediately' },
          ],
          reasoning: `Attempt ${attempt} failed: ${lastError.message}`,
          confidence: 70,
        });
      }

      // Check if we should retry
      const shouldRetry = cfg.shouldRetry 
        ? cfg.shouldRetry(lastError, attempt)
        : defaultShouldRetry(lastError, attempt);

      if (!shouldRetry || attempt === cfg.maxRetries) {
        break;
      }

      // Wait before next retry
      const delay = calculateDelay(attempt, cfg);
      await sleep(delay);
    }
  }

  // Try fallback model if configured
  if (cfg.fallbackModel && lastError) {
    const fallbackStart = Date.now();
    
    try {
      // Note: The caller should handle model switching in their agentFn
      // This is a placeholder for the fallback attempt
      if (tracer) {
        await tracer.recordDecision({
          agent: 'RetryHandler',
          type: 'action',
          chosen: 'use_fallback_model',
          alternatives: [
            { action: 'escalate_to_human', confidence: 0.5, reasoning: 'Could escalate instead' },
          ],
          reasoning: `Primary model failed after ${cfg.maxRetries} attempts, trying fallback: ${cfg.fallbackModel}`,
          confidence: 60,
        });
      }

      // Attempt with fallback (caller needs to implement model switching)
      const result = await agentFn();
      usedFallback = true;

      retryHistory.push({
        attempt: cfg.maxRetries + 1,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - fallbackStart,
        model: cfg.fallbackModel,
        action: 'fallback',
      });

      return {
        success: true,
        result,
        attempts: cfg.maxRetries + 1,
        usedFallback: true,
        escalatedToHuman: false,
        totalDurationMs: Date.now() - startTime,
        retryHistory,
      };
    } catch (fallbackError) {
      lastError = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
      
      retryHistory.push({
        attempt: cfg.maxRetries + 1,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - fallbackStart,
        error: lastError.message,
        model: cfg.fallbackModel,
        action: 'fallback',
      });
    }
  }

  // Escalate to human if configured
  if (cfg.escalateOnFailure && lastError) {
    escalatedToHuman = true;
    
    await escalateToHuman({
      error: lastError,
      context: context || {},
      attempts: retryHistory,
    }, tracer);

    retryHistory.push({
      attempt: retryHistory.length + 1,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      error: 'Escalated to human',
      action: 'escalate',
    });
  }

  return {
    success: false,
    error: lastError,
    attempts: retryHistory.length,
    usedFallback,
    escalatedToHuman,
    totalDurationMs: Date.now() - startTime,
    retryHistory,
  };
}

// ============================================================================
// HUMAN ESCALATION
// ============================================================================

// In-memory store for escalation requests (in production, use database)
const escalationQueue: HumanEscalationRequest[] = [];

/**
 * Escalate a failed workflow to human review
 */
export async function escalateToHuman(
  params: {
    error: Error;
    context: Record<string, any>;
    attempts: RetryAttempt[];
    workflowRunId?: number;
  },
  tracer?: WorkflowTracer
): Promise<HumanEscalationRequest> {
  const escalation: HumanEscalationRequest = {
    id: `esc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    workflowRunId: params.workflowRunId,
    error: params.error.message,
    context: params.context,
    attempts: params.attempts,
    priority: determinePriority(params.error, params.attempts),
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  escalationQueue.push(escalation);

  // Record escalation decision if tracer provided
  if (tracer) {
    await tracer.recordDecision({
      agent: 'RetryHandler',
      type: 'delegate',
      chosen: 'escalate_to_human',
      alternatives: [],
      reasoning: `All retry attempts exhausted. Error: ${params.error.message}`,
      confidence: 100,
      inputContext: {
        totalAttempts: params.attempts.length,
        lastError: params.error.message,
        priority: escalation.priority,
      },
    });

    // Record handoff to human
    await tracer.recordHandoff(
      'RetryHandler',
      'HumanReviewer',
      {
        escalationId: escalation.id,
        error: params.error.message,
        priority: escalation.priority,
      },
      'escalation'
    );
  }

  // In production, this would trigger notifications (email, Slack, PagerDuty, etc.)
  console.log(`[ESCALATION] Human review required: ${escalation.id}`, {
    priority: escalation.priority,
    error: escalation.error,
  });

  return escalation;
}

/**
 * Determine escalation priority based on error and attempts
 */
function determinePriority(error: Error, attempts: RetryAttempt[]): HumanEscalationRequest['priority'] {
  const message = error.message.toLowerCase();
  
  // Critical: Security or data integrity issues
  if (message.includes('security') || message.includes('unauthorized') || message.includes('data loss')) {
    return 'critical';
  }
  
  // High: Payment or financial issues
  if (message.includes('payment') || message.includes('billing') || message.includes('transaction')) {
    return 'high';
  }
  
  // High: Many failed attempts
  if (attempts.length >= 5) {
    return 'high';
  }
  
  // Medium: Standard failures
  if (attempts.length >= 3) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Get pending escalations
 */
export function getPendingEscalations(): HumanEscalationRequest[] {
  return escalationQueue.filter(e => e.status === 'pending');
}

/**
 * Resolve an escalation
 */
export function resolveEscalation(
  escalationId: string,
  resolution: 'resolved' | 'dismissed'
): HumanEscalationRequest | null {
  const escalation = escalationQueue.find(e => e.id === escalationId);
  if (escalation) {
    escalation.status = resolution;
  }
  return escalation || null;
}

// ============================================================================
// CIRCUIT BREAKER PATTERN
// ============================================================================

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting to close circuit */
  resetTimeoutMs: number;
  /** Number of successes needed to close circuit from half-open */
  successThreshold: number;
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  successThreshold: 2,
};

/**
 * Execute with circuit breaker pattern
 */
export async function executeWithCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  config: Partial<CircuitBreakerConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  
  let state = circuitBreakers.get(key);
  if (!state) {
    state = { failures: 0, lastFailure: 0, state: 'closed' };
    circuitBreakers.set(key, state);
  }

  // Check if circuit should transition from open to half-open
  if (state.state === 'open') {
    if (Date.now() - state.lastFailure > cfg.resetTimeoutMs) {
      state.state = 'half-open';
    } else {
      throw new Error(`Circuit breaker open for ${key}`);
    }
  }

  try {
    const result = await fn();
    
    // Success - reset or close circuit
    if (state.state === 'half-open') {
      state.failures = 0;
      state.state = 'closed';
    }
    
    return result;
  } catch (error) {
    state.failures++;
    state.lastFailure = Date.now();
    
    if (state.failures >= cfg.failureThreshold) {
      state.state = 'open';
    }
    
    throw error;
  }
}

/**
 * Get circuit breaker status
 */
export function getCircuitBreakerStatus(key: string): CircuitBreakerState | undefined {
  return circuitBreakers.get(key);
}

/**
 * Reset circuit breaker
 */
export function resetCircuitBreaker(key: string): void {
  circuitBreakers.delete(key);
}
