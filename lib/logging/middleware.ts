// Request logging helpers for Next.js API routes
// Note: This file is for Node.js runtime only (API routes, not Edge middleware)
// Edge middleware should use console logging directly

import type { NextRequest } from 'next/server';
import { createRequestLogger, type AppLogger } from './logger';

/**
 * Extract or generate a request ID from the request headers
 * Uses Web Crypto API for broad compatibility
 * 
 * @param request - Next.js request object
 * @returns Request ID (from header or newly generated)
 */
export function getRequestId(request: NextRequest): string {
  return (
    request.headers.get('x-request-id') ||
    request.headers.get('x-correlation-id') ||
    crypto.randomUUID()
  );
}

/**
 * Get the request path, handling Next.js URL structure
 * 
 * @param request - Next.js request object
 * @returns Clean request path
 */
export function getRequestPath(request: NextRequest): string {
  return request.nextUrl.pathname;
}

/**
 * Create a logger for an API route request
 * Automatically extracts request ID and path from the request
 * 
 * NOTE: This is for Node.js runtime API routes only, not Edge middleware.
 * 
 * @param request - Next.js request object
 * @returns Logger configured for this request
 * 
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const log = createLoggerForRequest(request);
 *   log.info('Processing request');
 *   // ...
 * }
 * ```
 */
export function createLoggerForRequest(request: NextRequest): AppLogger {
  const requestId = getRequestId(request);
  const path = getRequestPath(request);
  const method = request.method;
  
  return createRequestLogger(requestId, path, method);
}

/**
 * Log request completion with timing
 * 
 * @param log - Logger instance
 * @param startTime - Request start time (Date.now())
 * @param statusCode - HTTP response status code
 */
export function logRequestComplete(
  log: AppLogger,
  startTime: number,
  statusCode: number
): void {
  const durationMs = Date.now() - startTime;
  
  if (statusCode >= 500) {
    log.error({ statusCode, durationMs }, 'Request failed with server error');
  } else if (statusCode >= 400) {
    log.warn({ statusCode, durationMs }, 'Request failed with client error');
  } else {
    log.info({ statusCode, durationMs }, 'Request completed');
  }
}

/**
 * Log an error that occurred during request handling
 * 
 * @param log - Logger instance
 * @param error - The error that occurred
 * @param context - Additional context about where the error occurred
 */
export function logRequestError(
  log: AppLogger,
  error: unknown,
  context?: Record<string, unknown>
): void {
  log.error(
    {
      err: error,
      ...context,
    },
    'Error processing request'
  );
}
