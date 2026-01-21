// Type definitions for structured logging contexts

import type { Logger } from 'pino';

/**
 * Context for job-related logging
 * Used in Inngest functions and background jobs
 */
export interface JobLogContext {
  jobId: string;
  jobType: string;
  marketplace?: string;
  datasetId?: string;
  batchNumber?: number;
  totalBatches?: number;
}

/**
 * Context for API request logging
 * Used in route handlers
 */
export interface RequestLogContext {
  requestId: string;
  path: string;
  method?: string;
  userId?: string;
}

/**
 * Context for service-level logging
 * Used in service classes
 */
export interface ServiceLogContext {
  service: string;
  operation?: string;
}

/**
 * Union type for all log contexts
 */
export type LogContext = JobLogContext | RequestLogContext | ServiceLogContext;

/**
 * Application logger type - Pino Logger instance
 */
export type AppLogger = Logger;

/**
 * Log level type
 */
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
