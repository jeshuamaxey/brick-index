# Job Orchestration Architecture Analysis

## Executive Summary

This document analyzes the current job orchestration system and evaluates modern alternatives for scaling worldwide marketplace crawling operations. The analysis prioritizes free tier capabilities, considering Vercel's free plan limitations and the need to run long-running jobs (30-60 minutes) that exceed Vercel's 10-second timeout.

**Key Finding**: The current system cannot operate on free tier due to timeout constraints. Two viable alternatives exist: **Supabase Queues (PGMQ)** and **Inngest**. **Inngest is recommended** as it provides a complete workflow orchestration platform that eliminates most custom job management code while offering superior features for worldwide marketplace crawling.

## Current System Architecture

### Overview

The current implementation uses a custom job tracking system built on top of Supabase, with jobs executing in-process within Next.js API routes. The system tracks job lifecycle, progress, and handles stale job detection through a combination of database functions and Vercel cron jobs.

### Core Components

#### 1. BaseJobService (`lib/jobs/base-job-service.ts`)

Manages the job lifecycle:
- Creates job records in `pipeline.jobs` table
- Tracks job status (running, completed, failed)
- Implements type-specific timeouts (15-60 minutes)
- Updates job progress and statistics

**Key Methods:**
- `createJob()` - Creates job record with timeout tracking
- `updateJobProgress()` - Updates progress messages and statistics
- `completeJob()` - Marks job as completed
- `failJob()` - Marks job as failed with error message

#### 2. JobProgressTracker (`lib/jobs/job-progress-tracker.ts`)

Implements hybrid progress tracking:
- **Milestone-based**: Updates every N items processed (default: 10)
- **Time-based**: Updates every N milliseconds (default: 5000ms)
- Triggers updates when either condition is met

**Purpose**: Ensures progress is reported regularly for monitoring and stale job detection.

#### 3. JobCleanupService (`lib/jobs/job-cleanup-service.ts`)

Detects and handles stale jobs:
- Uses database function `pipeline.mark_stale_jobs_as_timed_out()`
- Detects jobs with no progress for 10 minutes
- Detects jobs exceeding their timeout duration
- Detects jobs running longer than 60 minutes (absolute maximum)
- Triggered by Vercel Cron (currently daily)

#### 4. Job Types

Current job types with their timeouts:
- `ebay_refresh_listings` - 30 minutes (initial marketplace capture)
- `ebay_enrich_listings` - 60 minutes (enriching listings with detailed data)
- `analyze_listings` - 15 minutes (batch analysis of listings)

### Execution Model

**Current Flow:**
1. API endpoint receives request (e.g., `POST /api/capture/trigger`)
2. `BaseJobService.createJob()` creates job record synchronously
3. Job executes immediately in same request context
4. `JobProgressTracker` periodically updates job progress
5. Job completes or fails, updates job record
6. Frontend polls `/api/jobs` every 2 seconds for status

**Critical Limitation**: Jobs execute in the same process as the API request, subject to Vercel function timeout limits.

### Current Limitations

#### 1. Timeout Constraints (Critical)

- **Vercel Hobby (Free)**: 10-second timeout
- **Vercel Pro**: 60-second timeout ($20/month)
- **Current Jobs**: 30-60 minutes duration
- **Impact**: Current system **cannot run on free tier**. Jobs will timeout and fail.

#### 2. Cron Job Constraints (Critical)

- **Vercel Free Plan**: Maximum 2 cron jobs per account
- **Current Usage**: 1 cron job for stale job cleanup
- **Limitation**: Only 1 cron slot remaining for future needs
- **Frequency**: Daily execution only (no timing guarantees)
- **Impact**: Stale jobs can remain undetected for up to 24 hours

#### 3. No True Queue System

- Jobs execute immediately in request context
- No buffering or rate limiting at infrastructure level
- If API endpoint times out, job may be lost
- No worker isolation

#### 4. Limited Retry Logic

- No automatic retries on failure
- Manual intervention required for failed jobs
- No exponential backoff
- Failed jobs may be permanently lost

#### 5. Scaling Challenges

- No built-in concurrency limits
- Manual rate limiting in code (e.g., 200ms delays)
- Each marketplace requires separate rate limit management
- No horizontal worker scaling
- Worldwide expansion will require managing multiple API rate limits manually

#### 6. Monitoring Gaps

- Custom frontend UI requires polling every 2 seconds
- No built-in metrics or alerting
- No dead letter queue for permanently failed jobs
- Limited observability into job execution

## Alternative Solutions

### Option 1: Supabase Queues (PGMQ)

#### What It Is

Supabase Queues is a Postgres-native message queue built on the `pgmq` extension. It runs entirely within your Supabase PostgreSQL database, providing guaranteed message delivery with exactly-once semantics.

#### Key Features

- **Postgres-Native**: No additional infrastructure required
- **Guaranteed Delivery**: Exactly-once message delivery
- **Visibility Timeout**: Automatic stale message detection
- **Built-in Retries**: Configurable retry mechanisms with delays
- **Message Archival**: Keep processed messages for audit/replay
- **Edge Function Integration**: Workers run as Supabase Edge Functions

#### Free Tier Limits

- **Edge Function Invocations**: 500,000 per month
- **Function Timeout**: 150 seconds (2.5 minutes)
- **Function Memory**: 256MB
- **Maximum Functions**: 25 per project
- **Cost**: $0 (included in Supabase free plan)

#### Architecture

```
API Endpoint → Enqueue to PGMQ → Edge Function Worker → Process Job
```

Workers poll queues and process messages. Messages become invisible during processing (visibility timeout), preventing duplicate processing.

#### Advantages

- Stays within Supabase ecosystem
- Postgres-native (can query queue state directly)
- No external service dependencies
- 150s timeout (15x better than Vercel free)
- Eliminates need for cron-based cleanup
- Horizontal worker scaling (within invocation limits)

#### Disadvantages

- Still requires custom progress tracking code
- Still requires custom job management code
- Must manage Edge Functions and polling intervals
- 150s timeout still requires chunking for very long jobs
- Less code reduction compared to Inngest

### Option 2: Inngest (Workflow Orchestration Platform)

#### What It Is

Inngest is a full-featured workflow orchestration platform, not just a queue. It provides event-driven workflows with automatic state management, built-in reliability, and advanced flow control.

#### Key Features

**Workflow Orchestration:**
- Multi-step workflows with automatic state persistence
- Code-level transactions (`step.run`) with automatic retries
- Function state automatically managed across steps

**Advanced Flow Control:**
- Per-key concurrency limits (e.g., max 2 jobs per marketplace)
- Built-in throttling and rate limiting
- Priority queues
- Fair resource distribution

**Reliability:**
- Automatic retries with exponential backoff
- Bulk replay of failed workflows
- Bulk cancellation
- Dead-letter queue alternative

**Observability:**
- Live traces for every workflow run
- Structured logs with inputs/outputs
- Metrics and alerting
- Real-time debugging

**Developer Experience:**
- `npx inngest-cli dev` for local development
- Step-by-step debugging
- No infrastructure management (auto-scaling)

#### Free Tier Limits (Hosted)

- **Executions**: 50,000 per month
- **Concurrency**: 5 concurrent steps
- **Realtime Connections**: 50
- **Users**: 3
- **Workers**: 3
- **Cost**: $0

#### Self-Hosted Option

- **Unlimited executions** (no monthly limit)
- **Unlimited concurrency** (no step limit)
- **Unlimited workers**
- **All features** of hosted version
- **Cost**: $0 (infrastructure costs only, can use free tiers)

#### Architecture

```
API Endpoint → Send Event to Inngest → Inngest Orchestrates Workflow → Serverless Functions
```

Inngest manages the entire workflow lifecycle, including state persistence, retries, and observability.

#### Advantages

- **Eliminates most custom job code** (3 major service classes)
- **Built-in progress tracking** (automatic step tracking)
- **Built-in state management** (no manual database updates)
- **Advanced flow control** (perfect for worldwide marketplace crawling)
- **Full observability** (no custom UI needed)
- **Better developer experience** (local debugging, step-by-step traces)
- **No timeout limits** (runs on your Vercel functions, can chain steps)
- **Auto-scaling** (no infrastructure management)

#### Disadvantages

- New service to learn (but excellent DX)
- Must monitor execution count on free tier (50k/month)
- Self-hosting requires infrastructure management (but removes limits)

## Detailed Comparison

### Architecture Comparison

| Aspect | Current System | Supabase Queues | Inngest |
|--------|----------------|-----------------|---------|
| **Type** | Custom job tracking | Postgres-native queue | Workflow orchestration platform |
| **Job Execution** | In-process (API route) | Edge Functions | Serverless functions |
| **Timeout** | 10s (free) / 60s (pro) | 150s | No limit (chains steps) |
| **State Management** | Manual (database) | Manual (database) | **Automatic** |
| **Progress Tracking** | Custom `JobProgressTracker` | Custom (reuse tracker) | **Built-in** |
| **Retry Logic** | Manual | Built-in | **Built-in with backoff** |
| **Stale Detection** | Cron (daily) | Visibility timeout | **Automatic timeouts** |
| **Flow Control** | Manual in code | Manual | **Built-in (concurrency, throttling)** |
| **Observability** | Custom UI (polling) | Basic metrics | **Full traces, logs, metrics** |
| **Error Recovery** | Manual | Manual | **Bulk replay, cancellation** |
| **Cron Jobs Needed** | 1 (cleanup) | 0 | 0 |
| **Code Reduction** | N/A | Minimal | **Major (3 service classes)** |

### Free Tier Feasibility

#### Current System

❌ **Cannot operate on free tier**
- 10s timeout vs 30-60 minute jobs
- Requires Vercel Pro ($20/month) to even attempt
- Uses 1 of 2 available cron slots

#### Supabase Queues

✅ **Can operate on free tier**
- 150s timeout (can chain for longer jobs)
- 500k Edge Function invocations/month
- No cron jobs needed
- Still requires most custom job code

#### Inngest

✅ **Can operate on free tier**
- No timeout limit (chains steps)
- 50k executions/month (or self-host for unlimited)
- No cron jobs needed
- Eliminates most custom job code

### Code Reduction Analysis

#### Current System Code to Maintain

1. `BaseJobService` - ~200 lines
2. `JobProgressTracker` - ~90 lines
3. `JobCleanupService` - ~180 lines
4. Custom monitoring UI - ~300 lines
5. Cron job integration - ~50 lines

**Total**: ~820 lines of custom job management code

#### With Supabase Queues

**Keep:**
- `BaseJobService` (modified for queue integration)
- `JobProgressTracker` (reuse existing)
- `JobCleanupService` (simplified, but still needed)
- Custom monitoring UI

**Code Reduction**: ~100 lines (minimal)

#### With Inngest

**Delete:**
- `BaseJobService` (entirely)
- `JobProgressTracker` (entirely)
- `JobCleanupService` (entirely)
- Custom monitoring UI (optional, Inngest provides)

**Code Reduction**: ~570 lines (major reduction)

### Use Case Fit: Worldwide Marketplace Crawling

#### Requirements

1. **Rate Limiting**: Each marketplace has different rate limits
2. **Concurrency Control**: Limit concurrent jobs per marketplace
3. **Long-Running Jobs**: 30-60 minute jobs
4. **Multiple Regions**: UK, US, and other regions with different limits
5. **Error Recovery**: Handle API failures gracefully
6. **Observability**: Monitor job execution across marketplaces

#### Current System

- ❌ Manual rate limiting in code
- ❌ No per-marketplace concurrency control
- ❌ Cannot run on free tier
- ❌ Manual error recovery
- ❌ Limited observability

#### Supabase Queues

- ⚠️ Must implement rate limiting manually
- ⚠️ Must implement concurrency control manually
- ✅ Can run on free tier (with chunking)
- ✅ Built-in retries
- ⚠️ Basic observability

#### Inngest

- ✅ **Built-in throttling and rate limiting**
- ✅ **Per-key concurrency limits** (perfect for per-marketplace)
- ✅ **No timeout limits** (perfect for long jobs)
- ✅ **Built-in error recovery** (bulk replay)
- ✅ **Full observability** (traces, logs, metrics)

## Recommendation

### Primary Recommendation: Inngest

**Inngest is the recommended solution** for the following reasons:

#### 1. Code Reduction (Major Benefit)

Inngest eliminates three major service classes:
- `BaseJobService` - Job management handled automatically
- `JobProgressTracker` - Progress tracking built-in
- `JobCleanupService` - Stale detection automatic

This saves **weeks of maintenance work** and reduces long-term technical debt.

#### 2. Perfect Fit for Use Case

Inngest's built-in features align perfectly with worldwide marketplace crawling:
- **Per-key concurrency**: Limit concurrent jobs per marketplace
- **Throttling**: Respect API rate limits automatically
- **Priority queues**: Prioritize certain marketplaces
- **Fair resource distribution**: Ensure all marketplaces get processed

#### 3. Free Tier Viable

- **No timeout limits**: Can run jobs of any length by chaining steps
- **50k executions/month**: Sufficient for moderate usage
- **Self-hosted option**: Unlimited executions if needed
- **No cron jobs needed**: Frees up both Vercel cron slots

#### 4. Superior Developer Experience

- Local debugging with `npx inngest-cli dev`
- Step-by-step traces showing exactly what happened
- Bulk replay for error recovery
- Full observability out of the box

#### 5. Future-Proof Architecture

- Easy to add new marketplaces (new workflows)
- Auto-scaling (no infrastructure management)
- Built-in features reduce need for custom code
- Perfect for worldwide expansion

### Alternative Recommendation: Supabase Queues

**Supabase Queues is a good alternative** if:
- You prefer staying entirely within Supabase ecosystem
- You want Postgres-native solutions
- You want maximum control over queue implementation
- You're already heavily invested in Supabase Edge Functions

**Trade-offs:**
- Less code reduction (still need most custom job code)
- Must implement rate limiting and concurrency control manually
- 150s timeout requires chunking for very long jobs
- More operational overhead

### Not Recommended: Current System

**The current system should not be used** because:
- ❌ Cannot run on free tier (10s timeout vs 30-60 minute jobs)
- ❌ Requires Vercel Pro ($20/month) to even attempt
- ❌ Uses 1 of 2 available cron slots
- ❌ Will become increasingly difficult to maintain at scale

## Implementation Guidance

### Migration Strategy: Inngest

#### Phase 1: Setup and First Workflow (1 week)

1. **Install Inngest SDK**
   ```bash
   npm install inngest
   ```

2. **Set up local development**
   ```bash
   npx inngest-cli dev
   ```

3. **Create Inngest client**
   ```typescript
   // lib/inngest/client.ts
   import { Inngest } from 'inngest';
   
   export const inngest = new Inngest({ id: 'marketplace-crawler' });
   ```

4. **Migrate one job type** (e.g., `ebay_refresh_listings`)
   ```typescript
   // inngest/functions/capture-listings.ts
   import { inngest } from '@/lib/inngest/client';
   import { CaptureService } from '@/lib/capture/capture-service';
   
   export const captureListings = inngest.createFunction(
     { id: 'capture-listings' },
     { event: 'marketplace/capture' },
     async ({ event, step }) => {
       const { marketplace, keywords, adapterParams } = event.data;
       
       // step.run is a transaction: auto-retries, state persisted
       const rawResponses = await step.run('search-marketplace', async () => {
         const adapter = createAdapter(marketplace);
         return await adapter.searchListings(keywords, adapterParams);
       });
       
       const processed = await step.run('process-listings', async () => {
         const captureService = new CaptureService(supabase);
         return await captureService.processListings(rawResponses);
       });
       
       // All state automatically managed
       return { success: true, count: processed.length };
     }
   );
   ```

5. **Update API endpoint** to send events instead of executing jobs
   ```typescript
   // app/api/capture/trigger/route.ts
   import { inngest } from '@/lib/inngest/client';
   
   export async function POST(request: NextRequest) {
     const body = await request.json();
     
     // Send event to Inngest (returns immediately)
     await inngest.send({
       name: 'marketplace/capture',
       data: {
         marketplace: body.marketplace,
         keywords: body.keywords,
         adapterParams: body.ebayParams,
       },
     });
     
     return NextResponse.json({ success: true });
   }
   ```

6. **Test locally** with step-by-step debugging

#### Phase 2: Full Migration (2-3 weeks)

1. **Migrate remaining job types**
   - `ebay_enrich_listings` → Inngest workflow
   - `analyze_listings` → Inngest workflow

2. **Remove custom job code**
   - Delete `lib/jobs/base-job-service.ts`
   - Delete `lib/jobs/job-progress-tracker.ts`
   - Delete `lib/jobs/job-cleanup-service.ts`
   - Remove Vercel cron job from `vercel.json`

3. **Simplify API routes**
   - Remove job creation logic
   - Just send events to Inngest
   - Keep business logic (adapters, services)

4. **Update frontend** (optional)
   - Keep custom UI or use Inngest's observability
   - Update to query Inngest runs instead of jobs table

5. **Add flow control**
   ```typescript
   // Per-marketplace concurrency limits
   export const captureListings = inngest.createFunction(
     { 
       id: 'capture-listings',
       concurrency: [
         {
           key: 'event.data.marketplace',
           limit: 2, // Max 2 concurrent jobs per marketplace
         },
       ],
     },
     { event: 'marketplace/capture' },
     async ({ event, step }) => {
       // Throttle API calls
       await step.sleep('rate-limit', '200ms');
       // ... rest of workflow
     }
   );
   ```

#### Phase 3: Optimization (Ongoing)

1. **Implement rate limiting per marketplace**
   - Use Inngest's throttling features
   - Configure per-marketplace limits

2. **Set up monitoring and alerting**
   - Use Inngest's built-in metrics
   - Set up alerts for failed workflows

3. **Optimize for free tier**
   - Monitor execution count
   - Consider self-hosting if exceeding 50k/month

4. **Add error recovery workflows**
   - Use bulk replay for failed jobs
   - Implement dead-letter handling

### Migration Strategy: Supabase Queues

If choosing Supabase Queues instead:

#### Phase 1: Setup (1 week)

1. **Enable PGMQ extension** in Supabase
   ```sql
   create extension pgmq;
   ```

2. **Create queues**
   ```sql
   select pgmq.create('marketplace_capture');
   select pgmq.create('marketplace_enrich');
   select pgmq.create('analyze_listings');
   ```

3. **Create Edge Function workers** for each queue

#### Phase 2: Migration (2-3 weeks)

1. **Update API endpoints** to enqueue jobs
2. **Create Edge Function workers** that poll queues
3. **Keep existing progress tracking** (reuse `JobProgressTracker`)
4. **Simplify cleanup** (leverage visibility timeout)
5. **Remove Vercel cron job**

#### Phase 3: Optimization (Ongoing)

1. **Implement rate limiting** at queue level
2. **Optimize polling intervals** to stay within 500k invocations/month
3. **Add dead letter queues** for permanent failures

## Conclusion

The current job orchestration system cannot operate on free tier and will become increasingly difficult to maintain as you scale to worldwide marketplace crawling.

**Inngest is the recommended solution** because it:
- Eliminates most custom job management code (major maintenance savings)
- Provides built-in features perfect for your use case (rate limiting, concurrency control)
- Works on free tier (50k executions/month, or self-host for unlimited)
- Offers superior developer experience (local debugging, full observability)
- Frees up both Vercel cron slots
- Provides future-proof architecture for worldwide expansion

**Supabase Queues is a viable alternative** if you prefer staying within the Supabase ecosystem, but requires maintaining more custom code and manual implementation of advanced features.

The migration is not just recommended—it's necessary for free tier operation and will significantly reduce long-term maintenance burden.
