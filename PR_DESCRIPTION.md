# Add eBay Listing Enrichment Functionality

## Overview

This PR implements a comprehensive listing enrichment system that enhances eBay listings with detailed information from the eBay Browse API's `getItem` endpoint. The initial search API only provides basic listing information, but enrichment retrieves critical details like descriptions, additional images, condition descriptions, and more.

## Problem Statement

The existing capture step uses the eBay search API which provides limited information per listing. Most importantly, it doesn't include the `description` field, which contains valuable information about the listing. This PR adds a two-step capture process:

1. **Initial Capture**: Discover listings via search API (existing functionality)
2. **Enrichment**: Retrieve detailed information via `getItem` API (new functionality)

## Key Features

### 1. Database Schema Extensions
- Added enrichment tracking fields (`enriched_at`, `enriched_raw_listing_id`)
- Added extracted fields from `getItem` API:
  - `description` - Full listing description
  - `additional_images` - Array of additional image URLs
  - `condition_description` - Detailed condition information
  - `category_path` - Full category hierarchy
  - `item_location` - Structured location data (city, state, country, postal code)
  - `estimated_availabilities` - Stock/quantity information
  - `buying_options` - Array of buying options (FIXED_PRICE, BEST_OFFER, etc.)

### 2. Core Components

#### `EbayAdapter.getItemDetails()`
- New method to fetch detailed item information from eBay Browse API
- Uses OAuth authentication (required for Browse API)
- Handles both legacy and RESTful item ID formats
- Comprehensive error handling (404, 429 rate limits, network errors)

#### `EnrichmentService`
- Orchestrates the enrichment process
- Queries for unenriched, active listings
- Processes listings with configurable rate limiting
- Stores raw enriched responses in `raw_listings` table
- Extracts and updates listing fields
- Handles individual item failures gracefully

#### API Endpoint: `POST /api/capture/enrich`
- HTTP endpoint to trigger enrichment
- Supports optional parameters:
  - `marketplace` (default: 'ebay')
  - `limit` - Maximum number of listings to enrich
  - `delayMs` - Delay between API calls (default: 200ms)
- Returns enrichment results with success/failure counts

### 3. Snapshot System Integration

#### `enrich-ebay-snapshot.ts` Script
- Enriches existing snapshot files with detailed item data
- Works sequentially with other snapshot scripts
- Supports filtering by file, profile, or all snapshots
- Skips already-enriched snapshots (unless `--force` flag is used)
- Updates snapshot files with `enrichedItems` and `enrichmentMetadata`

#### `load-ebay-snapshot-into-supabase.ts` Updates
- Automatically detects and loads enriched data from snapshots
- Creates separate `raw_listing` entries for enriched responses
- Updates listings with extracted enrichment fields
- Maintains backward compatibility with non-enriched snapshots

## Technical Details

### Authentication
- Switched from Finding API (App ID only) to Browse API (OAuth required)
- `EbayAdapter` now requires OAuth token in constructor
- Environment variable: `EBAY_OAUTH_APP_TOKEN`

### Rate Limiting
- Configurable delay between API calls (default: 200ms)
- Prevents API abuse and ensures stable operation
- Applied in both `EnrichmentService` and snapshot enrichment script

### Data Flow
1. Initial capture stores basic listing information
2. Enrichment process queries for `enriched_at IS NULL` listings
3. For each listing, calls `getItemDetails(itemId)`
4. Stores raw response in `raw_listings` table
5. Extracts relevant fields and updates `listings` table
6. Marks listing as enriched with timestamp

## Testing

### Comprehensive Test Coverage (100 tests, all passing)

#### `EbayAdapter.getItemDetails()` Tests (16 tests)
- Success cases with different item ID formats
- Error handling (404, 429, network errors, invalid input)
- URL encoding and authentication
- Environment and marketplace handling

#### `EnrichmentService` Tests (15 tests)
- Success scenarios with field extraction
- Error handling for individual item failures
- Rate limiting behavior
- Database query and update error handling
- Field extraction correctness

#### Enrichment API Route Tests (9 tests)
- Request validation and parameter handling
- Error responses
- Missing credentials handling
- Empty body handling

#### Script Tests (32 tests)
- `enrich-ebay-snapshot.ts`: 21 tests
  - Argument parsing
  - Index file operations
  - Snapshot selection logic
  - Enrichment structure validation
- `load-ebay-snapshot-enrichment.test.ts`: 11 tests
  - Field extraction function
  - Enrichment processing logic
  - Edge cases

## Migration

### Database Migration
Run the migration to add enrichment fields:
```sql
-- Migration: 20250116000000_add_listing_enrichment.sql
-- Adds enrichment tracking and extracted fields
```

### Environment Variables
Ensure the following are set:
- `EBAY_APP_ID` - eBay Application ID
- `EBAY_OAUTH_APP_TOKEN` - OAuth token for Browse API access
- `EBAY_ENVIRONMENT` - Optional, defaults to 'production'

## Usage Examples

### Via API Endpoint
```bash
# Enrich all unenriched listings
curl -X POST http://localhost:3000/api/capture/enrich \
  -H "Content-Type: application/json" \
  -d '{}'

# Enrich with limit and custom delay
curl -X POST http://localhost:3000/api/capture/enrich \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "delayMs": 300}'
```

### Via Snapshot Scripts
```bash
# Step 1: Capture listings (existing)
npm run seed:fetch-ebay-snapshot -- --profile=lego-bulk

# Step 2: Enrich snapshots (new)
npm run seed:enrich-ebay-snapshot -- --profile=lego-bulk

# Step 3: Load into Supabase (updated to handle enriched data)
npm run seed:load-ebay-snapshot-into-supabase -- --profile=lego-bulk
```

## Files Changed

### New Files
- `app/api/capture/enrich/route.ts` - Enrichment API endpoint
- `lib/capture/enrichment-service.ts` - Enrichment orchestration service
- `scripts/enrich-ebay-snapshot.ts` - Snapshot enrichment script
- `supabase/migrations/20250116000000_add_listing_enrichment.sql` - Database migration
- `__tests__/capture/ebay-adapter.test.ts` - EbayAdapter tests
- `__tests__/capture/enrichment-service.test.ts` - EnrichmentService tests
- `__tests__/capture/enrich-route.test.ts` - API route tests
- `__tests__/scripts/enrich-ebay-snapshot.test.ts` - Script tests
- `__tests__/scripts/load-ebay-snapshot-enrichment.test.ts` - Load script enrichment tests

### Modified Files
- `lib/capture/marketplace-adapters/ebay-adapter.ts` - Added `getItemDetails()` method
- `lib/capture/marketplace-adapters/ebay-snapshot-adapter.ts` - Added enriched data support
- `lib/types.ts` - Added enrichment fields to `Listing` interface
- `scripts/load-ebay-snapshot-into-supabase.ts` - Added enriched data loading
- `package.json` - Added `seed:enrich-ebay-snapshot` script

## Breaking Changes

⚠️ **OAuth Token Required**: The `EbayAdapter` constructor now requires an OAuth token. Any code directly instantiating `EbayAdapter` must provide both `appId` and `oauthToken`.

## Future Enhancements

- [ ] Batch enrichment API calls (if eBay supports it)
- [ ] Automatic retry logic for failed enrichments
- [ ] Enrichment status dashboard
- [ ] Webhook notifications for enrichment completion

## Checklist

- [x] Database migration created and tested
- [x] Core enrichment functionality implemented
- [x] API endpoint created
- [x] Snapshot scripts updated
- [x] Comprehensive test coverage (100 tests)
- [x] All tests passing
- [x] Documentation updated
- [x] Environment variables documented

## Related Issues

Closes #[issue-number] - Add listing enrichment functionality

