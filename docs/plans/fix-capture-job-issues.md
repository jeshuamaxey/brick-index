# Plan: Fix Capture Job Output Size and Cancellation Issues

## Problem Summary

Two critical issues were identified when running capture jobs with large result sets (36,000 listings):

1. **Output Too Large**: The `search-marketplace` step returns all raw responses at once, exceeding Inngest's 4MB per-step output limit and 32MB total function state limit. This causes "output too large" errors.

2. **Cancellation Not Working**: When a job is cancelled via the Inngest dev server UI, the function continues executing (making API calls) because:
   - All pagination happens inside a single `step.run()` call, which is atomic
   - Even if Inngest cancels the function, the current step completes fully before cancellation takes effect
   - With 180 pages (36k listings / 200 per page), cancellation during search means all 180 API calls still execute

## Root Causes

### Issue 1: Output Size
- **Current flow**: `search-marketplace` step calls `adapter.searchListings()` which returns ALL 36,000 listings as a single array
- **Problem**: This entire array is serialized and passed to subsequent steps, exceeding Inngest limits
- **Impact**: Function fails with "output too large" error during finalization

### Issue 2: Cancellation
- **Current flow**: Pagination loop (180+ API calls) happens inside a single `step.run()` call
- **Problem**: Inngest steps are atomic - if cancelled during step execution, the step completes fully before cancellation takes effect
- **Impact**: Wasted API calls and resources continue after cancellation (all pages in current step still fetch)

## Solution Architecture

### Unified Solution: Page-Level Steps

The solution addresses both issues simultaneously by restructuring the workflow:

1. **Break search into page-level steps**: Each page fetch becomes its own `step.run()` call
2. **Store immediately**: Store raw responses to database as each page is fetched
3. **Pass only metadata**: Between steps, pass only counts, IDs, or references, not full data
4. **Process in batches**: Transform and deduplicate in batches using stored data

**Benefits**:
- **Output Size**: No large data structures in function state - each step output stays well under 4MB limit
- **Cancellation**: Automatic cancellation between steps - Inngest stops before the next step runs
- **Scalability**: Can handle arbitrarily large result sets
- **Efficiency**: Natural cancellation points between pages means minimal wasted work

**How Cancellation Works**:
- Inngest processes cancellations **between steps**, not during step execution
- If each page fetch is its own step, cancellation stops before the next page step runs
- No explicit cancellation checks needed - Inngest handles it automatically

## Detailed Implementation Plan

### Phase 1: Make `fetchPage()` Accessible

**File**: `lib/capture/marketplace-adapters/ebay-adapter.ts`

**Changes**:
- Make `fetchPage()` method `public` (currently `private`)
- Ensure it can be called directly from Inngest functions
- Keep the method signature and functionality the same

**Rationale**: We need to call `fetchPage()` directly from each step, rather than using `searchListings()` which does pagination internally.

### Phase 2: Refactor Search to Page-Level Steps

**File**: `app/api/inngest/functions/capture-job.ts`

**Changes**:
- Replace single `search-marketplace` step with a loop of page-level steps
- Each step:
  1. Calls `adapter.fetchPage()` directly (one API call per step)
  2. Immediately stores raw responses to database
  3. Returns only metadata: `{ pageNumber, itemsStored, totalItems, hasMore, rawListingIds }`
- Track cumulative counts and raw listing IDs across steps
- Loop continues until `hasMore` is false or maxResults reached

**Structure**:
```typescript
let totalItems = 0;
let pageNumber = 0;
let offset = 0;
let hasMore = true;
const rawListingIds: string[] = [];
const limit = 200; // Items per page

// Get adapter (create once, reuse)
const adapter = await step.run('create-adapter', async () => {
  // ... adapter creation logic ...
  return { /* adapter config */ };
});

while (hasMore) {
  const pageResult = await step.run(`search-page-${pageNumber}`, async () => {
    // Fetch one page
    const response = await adapter.fetchPage(
      keywordQuery,
      limit,
      offset,
      fieldgroups,
      params,
      token,
      marketplaceId
    );
    
    const items = response.itemSummaries || [];
    
    // Store immediately to database
    const ids: string[] = [];
    for (const item of items) {
      const { data: rawListing, error } = await supabaseServer
        .schema('pipeline')
        .from('raw_listings')
        .insert({
          marketplace,
          api_response: item as Json,
        })
        .select('id')
        .single();
      
      if (!error && rawListing) {
        ids.push(rawListing.id);
      }
    }
    
    return {
      pageNumber,
      itemsStored: ids.length,
      totalItems: response.total ?? null,
      hasMore: response.next && (totalItems + ids.length < maxResults),
      rawListingIds: ids,
    };
  });
  
  // Accumulate results
  totalItems += pageResult.itemsStored;
  rawListingIds.push(...pageResult.rawListingIds);
  hasMore = pageResult.hasMore;
  offset += limit;
  pageNumber++;
  
  // If cancelled, Inngest stops here before next step.run()
}
```

**Key Points**:
- Each `step.run()` is a single API call - cancellation works automatically between steps
- Raw responses stored immediately - no large arrays in function state
- Only metadata passed between steps - stays well under 4MB limit

### Phase 3: Refactor Transformation to Use Stored Data

**File**: `app/api/inngest/functions/capture-job.ts`

**Changes**:
- Remove dependency on `rawResponses` array (no longer exists)
- Query stored raw listings from database using `rawListingIds`
- Process in batches - each batch step:
  1. Fetches raw listings from database
  2. Transforms them
  3. Returns transformed listings (small batch, under 4MB)

**Structure**:
```typescript
// Process stored raw listings in batches
const listings: Listing[] = [];
const batches = Math.ceil(rawListingIds.length / BATCH_SIZE);

for (let i = 0; i < batches; i++) {
  const start = i * BATCH_SIZE;
  const end = Math.min(start + BATCH_SIZE, rawListingIds.length);
  const batchIds = rawListingIds.slice(start, end);

  const transformed = await step.run(`transform-batch-${i}`, async () => {
    // Fetch raw listings from database
    const { data: rawListings, error } = await supabaseServer
      .schema('pipeline')
      .from('raw_listings')
      .select('*')
      .in('id', batchIds);

    if (error || !rawListings) {
      console.error('Error fetching raw listings:', error);
      return [];
    }

    // Create adapter (can't serialize between steps)
    const adapter = /* create adapter */;

    // Transform each
    const transformedListings: Listing[] = [];
    for (const rawListing of rawListings) {
      try {
        const listing = adapter.transformToListing(
          rawListing.api_response as Record<string, unknown>,
          rawListing.id
        );
        transformedListings.push(listing);
      } catch (error) {
        console.error('Error transforming listing:', error);
      }
    }

    return transformedListings;
  });

  listings.push(...transformed);
  
  // If cancelled, Inngest stops here before next batch step
}
```

### Phase 4: Update Error Handling

**File**: `app/api/inngest/functions/capture-job.ts`

**Changes**:
- Wrap entire function in try-catch
- If job was created, mark it as failed on error
- Ensure job status is always updated (success or failure)

**Structure**:
```typescript
export const captureJob = inngest.createFunction(
  { id: 'capture-job' },
  { event: 'job/capture.triggered' },
  async ({ event, step }) => {
    let jobId: string | null = null;
    
    try {
      // Step 1: Create job
      const job = await step.run('create-job', async () => {
        // ... create job ...
      });
      jobId = job.id;
      
      // ... rest of job execution ...
      
      // Final step: Complete job
      await step.run('complete-job', async () => {
        // ... complete job ...
      });
      
      return { jobId, status: 'completed', ... };
    } catch (error) {
      // Mark job as failed if it was created
      if (jobId) {
        await step.run('fail-job', async () => {
          const jobService = new BaseJobService(supabaseServer);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await jobService.failJob(jobId!, errorMessage);
        });
      }
      
      // Re-throw to let Inngest know function failed
      throw error;
    }
  }
);
```

## Implementation Checklist

### Phase 1: Make fetchPage() Accessible
- [ ] Change `fetchPage()` from `private` to `public` in `EbayAdapter`
- [ ] Verify `fetchPage()` can be called with required parameters
- [ ] Test that `fetchPage()` works independently

### Phase 2: Refactor Search to Page-Level Steps
- [ ] Replace single `search-marketplace` step with page-level loop
- [ ] Implement immediate storage of raw responses per page
- [ ] Return only metadata from each page step (counts, IDs)
- [ ] Track cumulative counts and raw listing IDs
- [ ] Handle pagination state (offset, hasMore) between steps
- [ ] Test with small result sets first (< 1000 listings)
- [ ] Test with large result sets (10k+, 36k+ listings)

### Phase 3: Refactor Transformation
- [ ] Remove dependency on `rawResponses` array
- [ ] Query stored raw listings from database using `rawListingIds`
- [ ] Process transformation in batches (each batch = one step)
- [ ] Ensure each batch step output stays under 4MB
- [ ] Test transformation with stored data

### Phase 4: Error Handling
- [ ] Wrap entire function in try-catch
- [ ] Mark job as failed on any error
- [ ] Ensure job status is always updated
- [ ] Test error scenarios (API failures, database errors)

## Testing Strategy

### Test Case 1: Large Result Set
- **Setup**: Trigger capture job with keywords that return 36,000+ listings
- **Expected**: Job completes successfully without "output too large" error
- **Verify**: 
  - All listings stored in database
  - All listings transformed correctly
  - All listings deduplicated correctly
  - Job marked as completed with correct counts

### Test Case 2: Cancellation During Search (Automatic)
- **Setup**: Start capture job, cancel via Inngest UI after 5-10 pages
- **Expected**: 
  - Job stops before next page step runs (automatic cancellation)
  - No additional API calls after cancellation point
  - Job marked as cancelled/failed in database
- **Verify**: 
  - Check Inngest dashboard shows cancellation
  - Check database - job status is 'failed' or 'cancelled'
  - Count API calls made vs. total pages available
  - Partial results (pages fetched before cancellation) are stored

### Test Case 3: Cancellation During Transformation
- **Setup**: Start capture job, cancel during transformation phase
- **Expected**: 
  - Job stops before next batch transformation step
  - Partial results stored correctly
- **Verify**: 
  - Raw listings stored up to cancellation point
  - Transformed listings stored up to cancellation point
  - Job status updated correctly

### Test Case 4: Normal Completion
- **Setup**: Run capture job with normal result set (< 1000 listings)
- **Expected**: Job completes successfully as before
- **Verify**: 
  - All functionality works as expected
  - Performance is acceptable
  - Results match previous implementation

## Performance Considerations

### Benefits
- **Memory**: No large arrays in memory - process incrementally
- **Scalability**: Can handle arbitrarily large result sets (tested with 36k+)
- **Cancellation**: Automatic cancellation between steps - minimal wasted work
- **Reliability**: Each step is independent, failures are isolated
- **Output Size**: Each step output stays well under 4MB limit

### Trade-offs
- **More steps**: More Inngest step invocations (e.g., 180 steps for 36k listings)
  - **Mitigation**: Each step is fast (single API call), Inngest handles this efficiently
- **Database queries**: More queries to fetch stored data
  - **Mitigation**: Necessary for large datasets, queries are fast with proper indexing
- **Complexity**: Slightly more complex code structure
  - **Mitigation**: Clear separation of concerns, easier to debug

### Step Count Estimation
- **36,000 listings / 200 per page = 180 page steps**
- **36,000 listings / 50 per batch = 720 transformation steps**
- **Total: ~900 steps for 36k listings**
- **Inngest handles this efficiently** - steps are lightweight and fast

## Migration Notes

- **Backward compatibility**: 
  - Keep existing `EbayAdapter.searchListings()` method unchanged (used elsewhere)
  - Only change `fetchPage()` visibility (private → public)
- **Testing**: 
  - Test with small datasets first (< 100 listings)
  - Gradually test with larger datasets
  - Monitor Inngest dashboard for step execution
- **Rollback**: 
  - Can revert to previous implementation if needed
  - Changes are isolated to `capture-job.ts` and `EbayAdapter`

## Future Enhancements

1. **Parallel page fetching**: Use Inngest's fan-out pattern to fetch multiple pages in parallel (if rate limits allow)
2. **Resume capability**: Store pagination state to allow resuming cancelled jobs
3. **Progress granularity**: More detailed progress updates per page
4. **Rate limiting**: Better rate limit handling with exponential backoff
5. **Adaptive batching**: Adjust batch sizes based on item size to stay under 4MB

