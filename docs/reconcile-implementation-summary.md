# Reconcile Job Implementation Summary

## Implementation Status

All components of the Reconcile job have been implemented according to the plan.

## Files Created/Modified

### Database Migration
- **File**: `supabase/migrations/20250121000000_add_reconcile_job.sql`
- **Changes**:
  - Added `reconcile` job type to enum
  - Created `pipeline.listing_lego_set_joins` table with:
    - `reconciliation_version` column
    - `status` column (active/superseded/deprecated)
    - Partial unique constraint: `UNIQUE(listing_id, lego_set_id) WHERE status = 'active'`
    - Indexes on all relevant columns
  - Added `reconciled_at` and `reconciliation_version` columns to `pipeline.listings`
  - Added indexes for efficient querying

### Services

1. **TextExtractor** (`lib/analyze/text-extractor.ts`)
   - Added `extractLegoSetIds()` method with regex pattern `\b\d{3,7}(-\d{1,2})?\b`

2. **LegoSetValidator** (`lib/analyze/lego-set-validator.ts`) - NEW
   - Validates extracted set IDs against `catalog.lego_sets`
   - Returns Map of set_num -> lego_set_id (UUID)

3. **LegoSetJoinsService** (`lib/analyze/lego-set-joins-service.ts`) - NEW
   - Creates join records with `reconciliation_version` and `status`
   - Implements cleanup modes: 'delete', 'supersede', 'keep'
   - Handles existing joins from older versions

4. **ReconcileService** (`lib/analyze/reconcile-service.ts`) - NEW
   - Defines `RECONCILIATION_VERSION = '1.0.0'` constant
   - `processListing()` method:
     - Extracts LEGO set IDs from listing text
     - Validates IDs against catalog
     - Creates join records
     - **Marks listing as reconciled** (even if zero sets found)
   - `processListings()` method for batch processing

### Inngest Functions

5. **reconcile-job.ts** (`app/api/inngest/functions/reconcile-job.ts`) - NEW
   - Job type: `reconcile`
   - Event: `job/reconcile.triggered`
   - Parameters: `listingIds`, `limit`, `reconciliationVersion`, `cleanupMode`
   - Query logic: Finds listings that are:
     - Analyzed (have `listing_analysis` records)
     - AND either unreconciled OR reconciled with older version
   - Batch processing (100 listings per step)
   - Tracks distribution statistics
   - Stores metadata in job record

### API Endpoints

6. **reconcile/trigger/route.ts** (`app/api/reconcile/trigger/route.ts`) - NEW
   - `POST /api/reconcile/trigger`
   - Accepts: `listingIds`, `limit`, `reconciliationVersion`, `cleanupMode`
   - Triggers Inngest event

### Registry Updates

7. **registry.ts** (`app/api/inngest/functions/registry.ts`)
   - Added `RECONCILE_JOB: 'reconcile-job'`
   - Added mapping to `FUNCTION_TO_JOB_TYPE`

8. **route.ts** (`app/api/inngest/route.ts`)
   - Imported and registered `reconcileJob`

### Types

9. **types.ts** (`lib/types.ts`)
   - Added `LegoSetJoin` type export

### Configuration

10. **base-job-service.ts** (`lib/jobs/base-job-service.ts`)
    - Added `reconcile: 15 minutes` timeout configuration

### Documentation

11. **pipeline.md** (`docs/pipeline.md`)
    - Added Reconcile job as Job 5
    - Updated diagrams and documentation

12. **testing-reconcile-job.md** (`docs/testing-reconcile-job.md`) - NEW
    - Comprehensive testing instructions

## Key Features Implemented

### 1. Reconciliation Tracking
- Listings marked as reconciled with `reconciled_at` timestamp
- `reconciliation_version` tracks algorithm version used
- Even listings with zero LEGO sets found are marked (prevents re-processing)

### 2. Join Record Versioning
- Each join record has `reconciliation_version`
- `status` field tracks lifecycle (active/superseded/deprecated)
- Partial unique constraint allows multiple superseded joins

### 3. Cleanup Modes
- **'supersede'** (default): Marks old joins as superseded
- **'delete'**: Deletes old joins
- **'keep'**: Keeps all joins regardless of version

### 4. Version-Based Re-processing
- Job automatically finds listings with older reconciliation versions
- Allows re-running listings when logic improves
- Version comparison uses semantic versioning

### 5. Metadata Tracking
- Tracks total listings input
- Distribution by number of IDs found (0, 1, 2, 3, 4, 5+)
- Total joins created
- Stored in job metadata JSONB field

## Testing

See `docs/testing-reconcile-job.md` for comprehensive testing instructions.

## Next Steps

1. Run database migration
2. Test text extraction with various formats
3. Test validation against catalog
4. Test join creation with different cleanup modes
5. Test full job execution via API
6. Verify metadata tracking
7. Test re-reconciliation scenarios

## Analysis UI (Added in Later Update)

A dedicated UI has been added to analyze reconciliation job results and improve regex precision/recall:

### UI Components

1. **Reconciliation Analysis Page** (`app/backend/resources/reconcile/[jobId]/page.tsx`)
   - Listing-centric view with three-panel layout
   - Left sidebar: List of listings with extracted ID counts
   - Center: Selected listing with highlighted regex matches
   - Right panel: Unified notes field for feedback
   - Keyboard navigation (↑/↓ arrows, Enter to focus notes)
   - Export/copy notes functionality

2. **Regex Pattern Service** (`lib/analyze/regex-pattern-service.ts`)
   - Maps reconciliation versions to regex patterns
   - Supports versioning for future regex updates
   - Used by TextExtractor for consistent pattern application

3. **Text Highlighting Component** (`components/reconcile/regex-highlighted-text.tsx`)
   - Highlights regex matches in listing text
   - Different colors for extracted IDs vs false positives
   - Helps identify precision/recall issues

4. **Listing Analysis Component** (`components/reconcile/listing-analysis-item.tsx`)
   - Displays listing with extracted IDs
   - Shows validated/not validated badges
   - "Copy ID" button to append listing ID to notes

### API Endpoints

5. **GET /api/jobs/[jobId]** (`app/api/jobs/[jobId]/route.ts`)
   - Generic job endpoint
   - For reconcile jobs, enriches response with listing data
   - Groups extracted IDs by listing (listing-centric structure)
   - Batches listing queries to handle large datasets

### Refactoring

6. **TextExtractor** (`lib/analyze/text-extractor.ts`)
   - Refactored to use RegexPatternService
   - Accepts optional reconciliationVersion parameter
   - Maintains backward compatibility

### Navigation

7. **Jobs Page Updates** (`app/backend/resources/jobs/page.tsx`)
   - Added "Analyze" button for completed reconcile jobs
   - Navigates to reconciliation analysis page

8. **Job Detail Panel** (`components/jobs/job-detail-panel.tsx`)
   - Added "Analyze Results" button for reconcile jobs
