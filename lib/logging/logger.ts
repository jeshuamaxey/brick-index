// Core logger instance and factory functions for structured logging

import pino from 'pino';
import { getRedactionConfig } from './redaction';
import type { AppLogger } from './types';

/**
 * Determine if we're in development mode
 * Handles various environment configurations
 */
function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;
}

/**
 * Get the configured log level
 * Defaults to 'info' in production, 'debug' in development
 */
function getLogLevel(): string {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }
  return isDevelopment() ? 'debug' : 'info';
}

/**
 * Base logger configuration
 * Creates the root logger with consistent settings across the application
 * 
 * Note: We use synchronous logging (no transport) because:
 * 1. Pino's async transport uses worker threads which don't work in Next.js serverless/Edge
 * 2. For pretty logs in development, pipe output: `npm run dev 2>&1 | pino-pretty`
 */
const baseLogger = pino({
  level: getLogLevel(),
  timestamp: pino.stdTimeFunctions.isoTime,
  
  // Base fields included in every log entry
  base: {
    service: 'bricks-pipeline',
    version: process.env.APP_VERSION || 'unknown',
    env: process.env.NODE_ENV || 'development',
  },
  
  // Redact sensitive data
  redact: getRedactionConfig(),
  
  // Error serializer for consistent error formatting
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

/**
 * Create a logger for Inngest job functions
 * 
 * @param jobId - The job ID (use 'pending' if not yet created)
 * @param jobType - The type of job (e.g., 'reconcile', 'capture')
 * @returns Logger with job context
 * 
 * @example
 * ```typescript
 * const log = createJobLogger('pending', 'reconcile');
 * log.info({ eventData }, 'Job triggered');
 * 
 * // After job creation, create child with actual ID
 * const jobLog = log.child({ jobId: job.id });
 * ```
 */
export function createJobLogger(jobId: string, jobType: string): AppLogger {
  return baseLogger.child({
    jobId,
    jobType,
    context: 'job',
  });
}

/**
 * Create a logger for API route handlers
 * 
 * @param requestId - Unique request identifier
 * @param path - The API route path
 * @param method - HTTP method (optional)
 * @returns Logger with request context
 * 
 * @example
 * ```typescript
 * const requestId = request.headers.get('x-request-id') || randomUUID();
 * const log = createRequestLogger(requestId, '/api/jobs/[jobId]', 'GET');
 * log.info({ jobId }, 'Fetching job');
 * ```
 */
export function createRequestLogger(
  requestId: string,
  path: string,
  method?: string
): AppLogger {
  return baseLogger.child({
    requestId,
    path,
    method,
    context: 'api',
  });
}

/**
 * Create a logger for service classes
 * 
 * @param serviceName - Name of the service class
 * @returns Logger with service context
 * 
 * @example
 * ```typescript
 * class CaptureService {
 *   private log: AppLogger;
 *   
 *   constructor(supabase: SupabaseClient, parentLogger?: AppLogger) {
 *     this.log = parentLogger 
 *       ? parentLogger.child({ service: 'CaptureService' })
 *       : createServiceLogger('CaptureService');
 *   }
 * }
 * ```
 */
export function createServiceLogger(serviceName: string): AppLogger {
  return baseLogger.child({
    service: serviceName,
    context: 'service',
  });
}

/**
 * Create a logger for middleware
 * 
 * @param middlewareName - Name of the middleware
 * @returns Logger with middleware context
 */
export function createMiddlewareLogger(middlewareName: string): AppLogger {
  return baseLogger.child({
    middleware: middlewareName,
    context: 'middleware',
  });
}

/**
 * Create a child logger with additional context
 * Useful for adding operation-specific context
 * 
 * @param parent - Parent logger
 * @param context - Additional context to add
 * @returns Child logger with merged context
 */
export function withContext(
  parent: AppLogger,
  context: Record<string, unknown>
): AppLogger {
  return parent.child(context);
}

// Export the base logger for direct use when context factories don't fit
export { baseLogger as logger };

// Re-export types for convenience
export type { AppLogger } from './types';
