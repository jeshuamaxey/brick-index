# Backend Logging Guidelines

This document describes the logging system and best practices for the Bricks backend.

## Overview

The backend uses [Pino](https://github.com/pinojs/pino) for structured logging. Pino was chosen for its:
- **High performance** - 5-10x faster than alternatives, critical for serverless
- **Native JSON output** - Machine-readable logs for aggregation systems
- **Child loggers** - Built-in context propagation
- **Low memory overhead** - Important for Vercel/serverless environments

## Quick Start

```typescript
// For API routes
import { createLoggerForRequest } from '@/lib/logging';

export async function GET(request: NextRequest) {
  const log = createLoggerForRequest(request);
  log.info({ userId }, 'Processing request');
}

// For services
import { createServiceLogger, type AppLogger } from '@/lib/logging';

class MyService {
  private log: AppLogger;
  
  constructor(supabase: SupabaseClient, parentLogger?: AppLogger) {
    this.log = parentLogger 
      ? parentLogger.child({ service: 'MyService' })
      : createServiceLogger('MyService');
  }
}

// For Inngest jobs
import { createJobLogger } from '@/lib/logging';

const myJob = inngest.createFunction(
  { id: 'my-job' },
  { event: 'job/my.triggered' },
  async ({ event, step }) => {
    let log = createJobLogger('pending', 'my-job');
    
    const job = await step.run('create-job', async () => { ... });
    log = log.child({ jobId: job.id });
    
    log.info({ listingsFound: 100 }, 'Processing started');
  }
);
```

## Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| **error** | Unrecoverable failures, exceptions | Database connection failed, critical job errors |
| **warn** | Recoverable issues, degraded state | Rate limit approaching, retry triggered, non-critical errors |
| **info** | Significant operations, milestones | Job started, job completed, batch processed |
| **debug** | Detailed execution flow | Query results, transformation details (dev only) |
| **trace** | Very verbose debugging | Loop iterations, individual records (rarely used) |

### Examples

```typescript
// Error - critical failure
log.error({ err: error, listingId }, 'Failed to process listing');

// Warn - recoverable issue
log.warn({ err: error, batch: i }, 'Error in batch, continuing with next');

// Info - significant milestone
log.info({ listingsProcessed: 100, duration: 5000 }, 'Job completed');

// Debug - detailed flow (development only)
log.debug({ queryParams }, 'Executing database query');
```

## Context Propagation

Always pass context through child loggers:

```typescript
// In Inngest job
const log = createJobLogger('pending', 'reconcile');
const jobLog = log.child({ jobId: job.id });

// Pass to services
const service = new ReconcileService(supabase, jobLog);

// In service, create child with additional context
this.log = parentLogger.child({ service: 'ReconcileService' });

// For operations, add more context
const opLog = this.log.child({ listingId, operation: 'processListing' });
opLog.info('Processing listing');
```

This creates logs with full context chain:
```json
{
  "jobId": "abc-123",
  "jobType": "reconcile",
  "service": "ReconcileService",
  "listingId": "listing-456",
  "operation": "processListing",
  "msg": "Processing listing"
}
```

## Error Logging

Always use the `err` key for error objects (Pino convention):

```typescript
// Correct
log.error({ err: error }, 'Operation failed');

// Also correct - with additional context
log.error({ 
  err: error, 
  listingId, 
  attemptNumber: 3 
}, 'Failed to process listing after retries');

// Incorrect - don't use 'error' key
log.error({ error: error }, 'Operation failed');
```

## Sensitive Data

Sensitive data is automatically redacted. The following paths are redacted:

- `req.headers.authorization`
- `*.password`, `*.token`, `*.apiKey`, `*.secret`
- `*.ebayAppId`, `*.ebayClientSecret`, `*.ebayAccessToken`
- `*.supabaseKey`, `*.serviceRoleKey`, `*.anonKey`

## Logger Factory Functions

| Function | Use Case | Context |
|----------|----------|---------|
| `createJobLogger(jobId, jobType)` | Inngest jobs | `{ jobId, jobType, context: 'job' }` |
| `createRequestLogger(requestId, path, method)` | API routes | `{ requestId, path, method, context: 'api' }` |
| `createLoggerForRequest(request)` | API routes (auto-extracts context) | Same as above |
| `createServiceLogger(serviceName)` | Service classes | `{ service, context: 'service' }` |
| `createMiddlewareLogger(middlewareName)` | Middleware | `{ middleware, context: 'middleware' }` |

## Environment Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` (prod), `debug` (dev) | Minimum log level |
| `NODE_ENV` | - | `development` enables pretty printing |

## Development vs Production

**Development:**
- JSON output by default (for compatibility with Next.js serverless)
- Use `npm run dev:pretty` for pretty-printed, colorized logs
- Debug level enabled by default

**Production:**
- Raw JSON output for log aggregation
- Info level by default
- Minimal overhead

### Pretty Logging in Development

For human-readable logs during development, use:

```bash
npm run dev:pretty
```

This pipes the JSON logs through `pino-pretty` for colorized, formatted output.

Note: We don't use Pino's built-in `transport` option because it spawns worker threads, which don't work in Next.js serverless/Edge environments.

## ESLint Rule

The codebase has an ESLint rule that warns on `console.*` usage:

```javascript
// eslint.config.mjs
"no-console": ["warn", { allow: [] }]
```

This encourages using structured logging instead of console statements.

## Migration Guide

When updating code to use structured logging:

1. **Import the appropriate logger factory:**
   ```typescript
   import { createLoggerForRequest } from '@/lib/logging';
   // or
   import { createServiceLogger, type AppLogger } from '@/lib/logging';
   ```

2. **Create logger at the appropriate scope:**
   - API routes: At the start of the handler
   - Services: In the constructor
   - Jobs: At the start of the function

3. **Replace console calls:**
   ```typescript
   // Before
   console.error('Error:', error);
   
   // After
   log.error({ err: error }, 'Error occurred');
   ```

4. **Add context to log messages:**
   ```typescript
   // Before
   console.log(`Processing listing ${listingId}`);
   
   // After
   log.info({ listingId }, 'Processing listing');
   ```

## File Locations

- `lib/logging/logger.ts` - Core logger and factory functions
- `lib/logging/types.ts` - TypeScript type definitions
- `lib/logging/redaction.ts` - Sensitive data redaction config
- `lib/logging/middleware.ts` - Request logging helpers
- `lib/logging/index.ts` - Main exports
