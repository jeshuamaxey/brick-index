# Testing Instructions for Reconcile Job

This document provides comprehensive testing instructions for the Reconcile job implementation.

## Prerequisites

1. **Database Setup**:
   - Run the migration: `supabase/migrations/20250121000000_add_reconcile_job.sql`
   - Ensure you have some listings in `pipeline.listings` table
   - Ensure you have some listings with `listing_analysis` records (reconcile job requires analyzed listings)
   - Ensure you have LEGO sets in `catalog.lego_sets` table for validation

2. **Inngest Setup**:
   - Inngest dev server should be running: `npm run dev:inngest`
   - Next.js dev server should be running: `npm run dev`

3. **Test Data Preparation**:
   - Create test listings with titles/descriptions containing LEGO set IDs (e.g., "LEGO set 75192-1", "Includes 10294")
   - Ensure some listings have been analyzed (have `listing_analysis` records)

## Test Categories

### 1. Database Schema Tests

#### Test 1.1: Verify Migration Applied
```sql
-- Check that reconcile job type exists
SELECT unnest(enum_range(NULL::pipeline.job_type)) AS job_type;
-- Should include 'reconcile'

-- Check listing_lego_set_joins table exists with correct columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'pipeline' 
  AND table_name = 'listing_lego_set_joins';
-- Should have: id, listing_id, lego_set_id, nature, reconciliation_version, status, created_at, updated_at

-- Check indexes exist
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'pipeline' 
  AND tablename = 'listing_lego_set_joins';
-- Should include indexes for listing_id, lego_set_id, reconciliation_version, status

-- Check listings table has reconciliation columns
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'pipeline' 
  AND table_name = 'listings'
  AND column_name IN ('reconciled_at', 'reconciliation_version');
-- Both columns should exist
```

#### Test 1.2: Verify Unique Constraint
```sql
-- Try to insert duplicate active join (should fail)
INSERT INTO pipeline.listing_lego_set_joins 
  (listing_id, lego_set_id, nature, reconciliation_version, status)
VALUES 
  ('test-listing-id', 'test-lego-set-id', 'mentioned', '1.0.0', 'active'),
  ('test-listing-id', 'test-lego-set-id', 'mentioned', '1.0.0', 'active');
-- Should fail with unique constraint violation

-- Verify superseded joins don't violate constraint
INSERT INTO pipeline.listing_lego_set_joins 
  (listing_id, lego_set_id, nature, reconciliation_version, status)
VALUES 
  ('test-listing-id', 'test-lego-set-id', 'mentioned', '1.0.0', 'superseded');
-- Should succeed (unique constraint only applies to active status)
```

### 2. Text Extraction Tests

#### Test 2.1: Basic LEGO ID Extraction
Test the `TextExtractor.extractLegoSetIds()` method:

```typescript
// Test cases to verify:
const testCases = [
  { text: "LEGO set 75192", expected: ["75192"] },
  { text: "Includes 75192-1 and 10294", expected: ["75192-1", "10294"] },
  { text: "Set number 21330-1", expected: ["21330-1"] },
  { text: "Price: $100", expected: [] }, // Should not match price
  { text: "500 pieces", expected: [] }, // Should not match piece count
  { text: "Year 2024", expected: [] }, // Should not match year
  { text: "Sets 75192, 10294, and 21330", expected: ["75192", "10294", "21330"] },
  { text: "LEGO 75192-1 Millennium Falcon", expected: ["75192-1"] },
];
```

**Manual Test**:
1. Create a test file or use browser console
2. Import `TextExtractor` from `@/lib/analyze/text-extractor`
3. Test each case above
4. Verify results match expected

### 3. Validation Tests

#### Test 3.1: LEGO Set ID Validation
Test the `LegoSetValidator.validateSetIds()` method:

**Setup**:
- Ensure `catalog.lego_sets` has some test sets (e.g., set_num = "75192-1", "10294")

**Test Cases**:
```typescript
// Valid set IDs that exist in catalog
const validIds = ["75192-1", "10294"]; // Should return Map with UUIDs

// Invalid set IDs not in catalog
const invalidIds = ["99999", "00000"]; // Should return Map with null values

// Mixed valid and invalid
const mixedIds = ["75192-1", "99999"]; // Should return Map with one UUID, one null
```

**Manual Test**:
1. Query `catalog.lego_sets` to get some valid `set_num` values
2. Create `LegoSetValidator` instance
3. Test validation with valid, invalid, and mixed IDs
4. Verify results

### 4. Join Creation Tests

#### Test 4.1: Basic Join Creation
**Test**: Create joins for a listing with validated LEGO sets

**Steps**:
1. Create a test listing (or use existing)
2. Ensure some LEGO sets exist in catalog
3. Call `LegoSetJoinsService.createJoins()` with:
   - `listingId`: Your test listing ID
   - `validatedSetIds`: Map with valid set_num -> lego_set_id
   - `reconciliationVersion`: "1.0.0"
   - `cleanupMode`: "supersede"
4. Verify joins created in `pipeline.listing_lego_set_joins`:
   - Status = 'active'
   - reconciliation_version = '1.0.0'
   - Correct listing_id and lego_set_id

#### Test 4.2: Cleanup Mode - Supersede
**Test**: Re-reconcile listing with supersede mode

**Steps**:
1. Create a listing with join records (version 1.0.0)
2. Run reconcile again with version 1.1.0 and cleanupMode='supersede'
3. Verify:
   - Old joins have `status='superseded'`
   - New joins have `status='active'` and `reconciliation_version='1.1.0'`

**SQL Verification**:
```sql
SELECT id, reconciliation_version, status 
FROM pipeline.listing_lego_set_joins 
WHERE listing_id = 'your-test-listing-id'
ORDER BY created_at;
```

#### Test 4.3: Cleanup Mode - Delete
**Test**: Re-reconcile listing with delete mode

**Steps**:
1. Create a listing with join records (version 1.0.0)
2. Run reconcile again with version 1.1.0 and cleanupMode='delete'
3. Verify:
   - Old joins are deleted (not just marked superseded)
   - Only new joins exist

#### Test 4.4: Cleanup Mode - Keep
**Test**: Re-reconcile listing with keep mode

**Steps**:
1. Create a listing with join records (version 1.0.0)
2. Run reconcile again with version 1.1.0 and cleanupMode='keep'
3. Verify:
   - Old joins still exist with `status='active'`
   - New joins also exist with `status='active'`
   - Both have different `reconciliation_version` values

#### Test 4.5: Zero LEGO Sets Found
**Test**: Listing with no LEGO sets found

**Steps**:
1. Create a listing with title/description that has no LEGO set IDs
2. Run reconcile job
3. Verify:
   - Listing has `reconciled_at` set (not NULL)
   - Listing has `reconciliation_version` set
   - No join records created
   - Job metadata shows `listings_with_zero_ids` count incremented

### 5. Reconcile Service Tests

#### Test 5.1: Process Single Listing
**Test**: `ReconcileService.processListing()`

**Steps**:
1. Create test listing with LEGO set IDs in title/description
2. Call `processListing(listingId)`
3. Verify:
   - Listing marked as reconciled
   - Join records created (if sets found)
   - Returns correct statistics

#### Test 5.2: Version Constant
**Test**: Verify `RECONCILIATION_VERSION` constant

**Steps**:
1. Import `ReconcileService`
2. Check `ReconcileService.RECONCILIATION_VERSION === '1.0.0'`

### 6. Job Execution Tests

#### Test 6.1: Trigger Reconcile Job via API
**Test**: Basic job execution

**Steps**:
1. Ensure you have analyzed listings
2. POST to `/api/reconcile/trigger`:
   ```json
   {}
   ```
3. Verify:
   - Job created in `pipeline.jobs` table
   - Job type = 'reconcile'
   - Job status = 'running' initially
   - Check job progress via `/api/jobs`

#### Test 6.2: Query Unreconciled Listings
**Test**: Job finds unreconciled listings

**Steps**:
1. Create listings with analysis but no reconciliation
2. Run reconcile job
3. Verify:
   - Job processes these listings
   - Listings marked as reconciled after processing

#### Test 6.3: Skip Already Reconciled Listings
**Test**: Job skips listings with current version

**Steps**:
1. Reconcile some listings (version 1.0.0)
2. Run reconcile job again (version 1.0.0)
3. Verify:
   - Job skips already-reconciled listings
   - No duplicate processing

#### Test 6.4: Re-process Older Version Listings
**Test**: Job re-processes listings with older version

**Steps**:
1. Reconcile listings with version 1.0.0
2. Update `ReconcileService.RECONCILIATION_VERSION` to '1.1.0' (or pass version in API)
3. Run reconcile job with version 1.1.0
4. Verify:
   - Job processes listings with version 1.0.0
   - Listings updated to version 1.1.0
   - Join records updated based on cleanupMode

#### Test 6.5: Job with Specific Listing IDs
**Test**: Process specific listings

**Steps**:
1. POST to `/api/reconcile/trigger`:
   ```json
   {
     "listingIds": ["listing-id-1", "listing-id-2"]
   }
   ```
2. Verify:
   - Only specified listings are processed
   - Job completes successfully

#### Test 6.6: Job with Limit
**Test**: Process limited number of listings

**Steps**:
1. POST to `/api/reconcile/trigger`:
   ```json
   {
     "limit": 10
   }
   ```
2. Verify:
   - Only 10 listings processed
   - Job completes successfully

#### Test 6.7: Job with Cleanup Mode
**Test**: Process with different cleanup modes

**Steps**:
1. Create listings with existing joins (version 1.0.0)
2. POST to `/api/reconcile/trigger`:
   ```json
   {
     "cleanupMode": "delete"
   }
   ```
3. Verify:
   - Old joins deleted (for delete mode)
   - Old joins superseded (for supersede mode)
   - Old joins kept (for keep mode)

### 7. Metadata Tracking Tests

#### Test 7.1: Distribution Statistics
**Test**: Job metadata tracks distribution

**Steps**:
1. Create test listings with:
   - 0 LEGO set IDs
   - 1 LEGO set ID
   - 2 LEGO set IDs
   - 3 LEGO set IDs
   - 4 LEGO set IDs
   - 5+ LEGO set IDs
2. Run reconcile job
3. Check job metadata:
   ```sql
   SELECT metadata FROM pipeline.jobs 
   WHERE type = 'reconcile' 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```
4. Verify metadata contains:
   - `total_listings_input`
   - `distribution.listings_with_zero_ids`
   - `distribution.listings_with_one_id`
   - `distribution.listings_with_two_ids`
   - `distribution.listings_with_three_ids`
   - `distribution.listings_with_four_ids`
   - `distribution.listings_with_five_or_more_ids`
   - `total_joins_created`

### 8. Edge Cases and Error Handling

#### Test 8.1: Listing Not Found
**Test**: Handle missing listing gracefully

**Steps**:
1. Try to reconcile with invalid listing ID
2. Verify:
   - Error logged but job continues
   - Other listings still processed

#### Test 8.2: Invalid LEGO Set IDs
**Test**: Handle invalid set IDs

**Steps**:
1. Create listing with text containing numbers that look like set IDs but aren't valid
2. Run reconcile
3. Verify:
   - No joins created for invalid IDs
   - Listing still marked as reconciled
   - Metadata tracks zero IDs found

#### Test 8.3: Duplicate Set IDs in Text
**Test**: Same set ID mentioned multiple times

**Steps**:
1. Create listing: "LEGO 75192-1 and 75192-1"
2. Run reconcile
3. Verify:
   - Only one join record created (deduplication)
   - `extractedCount` reflects unique count

#### Test 8.4: Multiple Versions of Same Set
**Test**: Listing mentions "75192" and "75192-1"

**Steps**:
1. Create listing with both base and versioned set number
2. Run reconcile
3. Verify:
   - Both extracted (if both exist in catalog)
   - Both validated separately
   - Two join records created (if both valid)

### 9. Integration Tests

#### Test 9.1: Full Pipeline Flow
**Test**: Complete pipeline from capture to reconcile

**Steps**:
1. Run capture job
2. Run materialize job
3. Run analyze job
4. Run reconcile job
5. Verify:
   - All steps complete successfully
   - Listings have analysis records
   - Listings have reconciliation records
   - Join records created where applicable

#### Test 9.2: Re-reconciliation Flow
**Test**: Re-run reconcile with improved version

**Steps**:
1. Reconcile listings with version 1.0.0
2. Update reconciliation logic (or change version to 1.1.0)
3. Re-run reconcile job with version 1.1.0
4. Verify:
   - Listings re-processed
   - Old joins handled according to cleanupMode
   - New joins created with version 1.1.0

### 10. Performance Tests

#### Test 10.1: Batch Processing
**Test**: Job processes listings in batches

**Steps**:
1. Create 250 analyzed listings
2. Run reconcile job
3. Verify:
   - Job processes in batches of 100
   - Progress updates between batches
   - All listings processed

#### Test 10.2: Large Dataset
**Test**: Job handles large number of listings

**Steps**:
1. Create 1000+ analyzed listings
2. Run reconcile job
3. Verify:
   - Job completes without timeout
   - All listings processed
   - Metadata accurate

## Verification Queries

Use these SQL queries to verify test results:

### Check Reconciliation Status
```sql
-- Listings reconciled vs not reconciled
SELECT 
  COUNT(*) FILTER (WHERE reconciled_at IS NULL) as unreconciled,
  COUNT(*) FILTER (WHERE reconciled_at IS NOT NULL) as reconciled
FROM pipeline.listings
WHERE status = 'active';
```

### Check Join Records
```sql
-- Active joins by reconciliation version
SELECT 
  reconciliation_version,
  status,
  COUNT(*) as count
FROM pipeline.listing_lego_set_joins
GROUP BY reconciliation_version, status
ORDER BY reconciliation_version, status;
```

### Check Job Metadata
```sql
-- Latest reconcile job metadata
SELECT 
  id,
  status,
  metadata->'total_listings_input' as total_input,
  metadata->'distribution' as distribution,
  metadata->'total_joins_created' as total_joins
FROM pipeline.jobs
WHERE type = 'reconcile'
ORDER BY created_at DESC
LIMIT 1;
```

### Check Listing Reconciliation
```sql
-- Listings with their reconciliation status
SELECT 
  id,
  title,
  reconciled_at,
  reconciliation_version,
  (SELECT COUNT(*) FROM pipeline.listing_lego_set_joins 
   WHERE listing_id = l.id AND status = 'active') as active_joins
FROM pipeline.listings l
WHERE status = 'active'
ORDER BY reconciled_at DESC NULLS LAST
LIMIT 20;
```

## Common Issues and Solutions

### Issue: Job doesn't find listings to reconcile
**Solution**: 
- Ensure listings have `listing_analysis` records
- Check that listings are `status='active'`
- Verify `reconciled_at IS NULL` or `reconciliation_version != current version`

### Issue: Joins not created
**Solution**:
- Verify LEGO set IDs exist in `catalog.lego_sets` table
- Check that extracted IDs match `set_num` format exactly
- Verify validation is working (check logs)

### Issue: Unique constraint violation
**Solution**:
- Ensure cleanupMode is working correctly
- Check that old joins are being superseded/deleted before creating new ones
- Verify partial unique constraint is applied correctly

### Issue: Metadata not stored
**Solution**:
- Check job completion step
- Verify metadata update query executes
- Check job record in database

## Manual Testing Checklist

- [ ] Migration applied successfully
- [ ] Text extraction finds LEGO set IDs correctly
- [ ] Validation works for valid and invalid set IDs
- [ ] Join creation works for single listing
- [ ] Cleanup mode 'supersede' works correctly
- [ ] Cleanup mode 'delete' works correctly
- [ ] Cleanup mode 'keep' works correctly
- [ ] Listings marked as reconciled (even with zero sets)
- [ ] Job skips already-reconciled listings
- [ ] Job re-processes older version listings
- [ ] Metadata tracks distribution correctly
- [ ] Job handles errors gracefully
- [ ] Batch processing works correctly
- [ ] API endpoint accepts all parameters

## Automated Test Suggestions

Consider creating unit tests for:
- `TextExtractor.extractLegoSetIds()`
- `LegoSetValidator.validateSetIds()`
- `LegoSetJoinsService.createJoins()` with different cleanup modes
- `ReconcileService.processListing()`

Consider creating integration tests for:
- Full reconcile job execution
- Re-reconciliation scenarios
- Cleanup mode behaviors
