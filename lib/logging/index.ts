// Main export file for logging module

// Core logger and factory functions
export {
  logger,
  createJobLogger,
  createRequestLogger,
  createServiceLogger,
  createMiddlewareLogger,
  withContext,
} from './logger';

// Middleware helpers
export {
  getRequestId,
  getRequestPath,
  createLoggerForRequest,
  logRequestComplete,
  logRequestError,
} from './middleware';

// Types
export type {
  AppLogger,
  LogLevel,
  JobLogContext,
  RequestLogContext,
  ServiceLogContext,
  LogContext,
} from './types';

// Redaction config (for testing/extension)
export { getRedactionConfig, redactPaths, redactCensor } from './redaction';
