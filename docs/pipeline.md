# Data Pipeline Documentation

This document describes how data flows through the LEGO marketplace scraper system, including all six pipeline jobs: **Capture**, **Enrich**, **Materialize**, **Sanitize**, **Reconcile**, and **Analyze**.

## Pipeline Overview

The system processes data through three sequential stages that transform raw marketplace API responses into analyzed, structured listing data with LEGO set associations.

| Step Name | Stage | Description | Output |
|-----------|-------|-------------|--------|
| Capture | Collect | Searches marketplace APIs and stores raw listing data from search results. | `raw_listings` |
| Enrich | Collect | Fetches detailed item information from marketplace APIs for each raw listing. | `raw_listing_details` |
| Materialize | Transform | Transforms raw listings into structured listing records, merging search and enrichment data. | `listings` |
| Sanitize | Transform | Removes HTML markup from listing titles and descriptions, converting them to clean plain text. | `listings` (updates `sanitised_title`, `sanitised_description`) |
| Reconcile | Transform | Extracts LEGO set IDs from sanitized text and creates join records linking listings to LEGO sets. | `listing_lego_set_joins` |
| Analyze | Analyze | Extracts attributes like piece count and minifig count, and calculates value metrics like price per piece. | `listing_analysis` |

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant User
    participant Capture as Capture Job
    participant Enrich as Enrich Job
    participant Materialize as Materialize Job
    participant Sanitize as Sanitize Job
    participant Reconcile as Reconcile Job
    participant Analyze as Analyze Job
    participant SearchAPI as eBay Search API
    participant BrowseAPI as eBay Browse API
    participant DB as Database
    
    User->>Capture: Trigger Capture Job
    Capture->>SearchAPI: Search Listings (paginated)
    SearchAPI-->>Capture: Raw Search Responses
    Capture->>DB: Store in raw_listings (page by page)
    Capture-->>User: Capture Complete (raw data stored)
    
    User->>Enrich: Trigger Enrich Job (Optional)
    Enrich->>DB: Query unenriched raw_listings
    loop For each raw listing
        Enrich->>BrowseAPI: getItem(itemId)
        BrowseAPI-->>Enrich: Detailed Item Data
        Enrich->>DB: Store enriched response in raw_listing_details
        Enrich->>DB: Update raw_listings.enriched_at
    end
    Enrich-->>User: Enrichment Complete
    
    User->>Materialize: Trigger Materialize Job
    Materialize->>DB: Query raw_listings and raw_listing_details
    Materialize->>Materialize: Transform to structured format
    Materialize->>Materialize: Merge search and enrichment data
    Materialize->>Materialize: Deduplicate listings
    Materialize->>DB: Insert new / Update existing in listings
    Materialize-->>User: Materialize Complete
    
    User->>Sanitize: Trigger Sanitize Job
    Sanitize->>DB: Query unsanitized listings
    loop For each listing
        Sanitize->>Sanitize: Remove HTML markup
        Sanitize->>Sanitize: Normalize whitespace
        Sanitize->>DB: Update sanitised_title, sanitised_description
    end
    Sanitize-->>User: Sanitization Complete
    
    User->>Reconcile: Trigger Reconcile Job
    Reconcile->>DB: Query unreconciled listings (reconciled_at IS NULL)
    loop For each listing
        Reconcile->>Reconcile: Extract LEGO Set IDs from sanitised text
        Reconcile->>DB: Validate IDs against catalog.lego_sets
        Reconcile->>DB: Create join records in listing_lego_set_joins
        Reconcile->>DB: Update listings.reconciled_at
    end
    Reconcile-->>User: Reconciliation Complete
    
    User->>Analyze: Trigger Analyze Job
    Analyze->>DB: Query unanalyzed listings
    loop For each listing
        Analyze->>Analyze: Extract Text (piece count, minifigs, condition)
        Analyze->>Analyze: Calculate Value (price per piece)
        Analyze->>DB: Store in listing_analysis
    end
    Analyze-->>User: Analysis Complete
```

## Job 1: Capture

**Purpose**: Fetch raw listing data from marketplace APIs and store it in the database.

**Process**:
1. Receives search keywords and eBay search parameters
2. Paginates through eBay Search API results (one page per Inngest step)
3. Stores each page of raw API responses immediately to `pipeline.raw_listings`
4. Associates all raw listings with the capture job ID

**Key Features**:
- **Page-level steps**: Each page fetch is a separate Inngest step, preventing timeout issues and enabling cancellation
- **Stream processing**: Data is stored immediately, avoiding "output too large" errors
- **No automatic triggers**: Capture job completes without triggering subsequent jobs

**Data Flow**:
```
eBay Search API → raw_listings (with job_id)
```

**Job Type**: `ebay_refresh_listings`

**Timeout**: 30 minutes

**API Endpoint**: `POST /api/capture/trigger`

### Capture Job Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `marketplace` | `string` | No | `'ebay'` | Marketplace identifier. Currently only `'ebay'` is supported. |
| `keywords` | `string[]` | **Yes** | - | Array of search keywords. Multiple keywords are joined with spaces. Must be a non-empty array. |
| `ebayParams` | `EbaySearchParams` | No | See below | eBay-specific search parameters. |

### eBay Search Parameters (`ebayParams`)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `entriesPerPage` | `number` | No | `200` | Number of results per page (1-200). |
| `listingTypes` | `string[]` | No | `undefined` | Array of listing types. Options: `'FixedPrice'`, `'AuctionWithBIN'`. |
| `hideDuplicateItems` | `boolean` | No | `undefined` | Whether to hide duplicate items in search results. |
| `categoryId` | `string` | No | `undefined` | eBay category ID to filter results (e.g., `'220'` for LEGO). |
| `marketplaceId` | `string` | No | `process.env.EBAY_MARKETPLACE_ID` or `'EBAY_US'` | eBay marketplace identifier (e.g., `'EBAY_US'`, `'EBAY_GB'`). |
| `enablePagination` | `boolean` | No | `true` | Whether to enable pagination through results. |
| `maxResults` | `number` | No | `10000` | Maximum number of results to fetch (max: 10000). |
| `fieldgroups` | `string` | No | `'EXTENDED'` | Field groups to include in response. Use `'EXTENDED'` for maximum data. |

### Example Request

```json
{
  "marketplace": "ebay",
  "keywords": ["lego bulk", "lego job lot"],
  "ebayParams": {
    "entriesPerPage": 200,
    "listingTypes": ["FixedPrice", "AuctionWithBIN"],
    "hideDuplicateItems": true,
    "categoryId": "220",
    "marketplaceId": "EBAY_US",
    "enablePagination": true,
    "maxResults": 10000,
    "fieldgroups": "EXTENDED"
  }
}
```

**Note**: The `keywords` parameter is required and must be a non-empty array. If not provided, the API will return a 400 error.

## Job 2: Enrich

**Purpose**: Enhance raw listings with detailed information from the eBay Browse API before materialization.

**Process**:
1. Queries `pipeline.raw_listings` for unenriched raw listings (`enriched_at IS NULL`)
2. Extracts `itemId` from `raw_listings.api_response`
3. For each raw listing, calls eBay Browse API `getItem` endpoint
4. Stores enriched responses in `pipeline.raw_listing_details` table
5. Updates `raw_listings.enriched_at` timestamp to mark as enriched

**Key Features**:
- **Rate limiting**: Configurable delay between API calls to prevent API abuse
- **Batch processing**: Processes raw listings in batches of 50 per Inngest step
- **Selective processing**: Only processes raw listings that haven't been enriched yet
- **Optional capture job filtering**: Can enrich specific capture job's raw listings
- **Error handling**: When items return 404 "Item not found" errors (indicating the listing is no longer available for purchase - sold, ended, removed, or temporarily disabled), the corresponding listings in the `listings` table are automatically marked as `status = 'expired'` to prevent unnecessary future processing

**Data Flow**:
```
raw_listings (unenriched) → eBay Browse API getItem → raw_listing_details → Update raw_listings.enriched_at
```

**Job Type**: `ebay_enrich_listings`

**Timeout**: 60 minutes

**API Endpoint**: `POST /api/capture/enrich`

### Enrich Job Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `marketplace` | `string` | No | `'ebay'` | Marketplace identifier. Currently only `'ebay'` is supported. |
| `captureJobId` | `string` | No | `undefined` | UUID of capture job. If provided, only enriches raw listings from that capture job. |
| `limit` | `number` | No | `undefined` | Maximum number of raw listings to enrich. If not provided, processes all unenriched raw listings. |
| `delayMs` | `number` | No | `200` | Delay in milliseconds between API calls to prevent rate limiting. |

### Example Request

```json
{
  "marketplace": "ebay",
  "captureJobId": "123e4567-e89b-12d3-a456-426614174000",
  "limit": 1000,
  "delayMs": 200
}
```

## Job 3: Materialize

**Purpose**: Transform raw listings from `raw_listings` table into structured `listings` table, including deduplication.

**Process**:
1. Queries `raw_listings` table for all entries associated with a specific capture job ID
2. Transforms raw API responses into structured listing format using marketplace adapter
3. Deduplicates listings based on `(marketplace, external_id)` unique constraint
4. Inserts new listings into `pipeline.listings`
5. Updates existing listings with new `last_seen_at` timestamp

**Key Features**:
- **Batch processing**: Processes listings in batches of 50 per Inngest step
- **Deduplication**: Prevents duplicate listings while tracking when listings are seen again
- **Job association**: Links materialized listings to the materialize job ID

**Data Flow**:
```
raw_listings (by captureJobId) → Transform → Deduplicate → listings (new/updated)
```

**Job Type**: `ebay_materialize_listings`

**Timeout**: 30 minutes

**API Endpoint**: `POST /api/materialize/trigger`

### Materialize Job Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `captureJobId` | `string` | Yes | - | UUID of the capture job whose raw listings should be materialized. |
| `marketplace` | `string` | Yes | - | Marketplace identifier (e.g., `'ebay'`). Must match the marketplace used in the capture job. |

### Example Request

```json
{
  "captureJobId": "123e4567-e89b-12d3-a456-426614174000",
  "marketplace": "ebay"
}
```

**Note**: The Materialize job should be triggered manually after capture and enrichment jobs complete.

## Job 4: Sanitize

**Purpose**: Clean HTML markup from listing title and description fields, converting them to plain text.

**Process**:
1. Queries `pipeline.listings` for unsanitized listings (`sanitised_at IS NULL` and `status = 'active'`)
2. For each listing, sanitizes `title` and `description` fields:
   - Removes all HTML tags and markup
   - Removes images, SVGs, scripts, styles, and CSS
   - Extracts text content from visible elements
   - Normalizes whitespace (condenses multiple newlines to at most one blank line)
3. Stores sanitized values in `sanitised_title` and `sanitised_description` fields
4. Marks listing as sanitized with `sanitised_at` timestamp

**Key Features**:
- **HTML-to-text conversion**: Uses `html-to-text` library for reliable HTML parsing
- **Whitespace normalization**: Condenses multiple consecutive newlines to at most one blank line
- **Batch processing**: Processes listings in batches of 50 per Inngest step
- **Selective processing**: Can sanitize specific listings by ID or all unsanitized listings
- **Status filtering**: Only processes active listings (excludes expired, sold, and removed listings)
- **Graceful handling**: Handles plain text gracefully (no-op if no HTML present)

**Data Flow**:
```
listings (unsanitized) → Sanitize HTML → listings (sanitised_title, sanitised_description)
```

**Job Type**: `sanitize_listings`

**Timeout**: 30 minutes

**API Endpoint**: `POST /api/sanitize/trigger`

### Sanitize Job Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `listingIds` | `string[]` | No | `undefined` | Array of specific listing IDs to sanitize. If not provided, processes all unsanitized listings. |
| `limit` | `number` | No | `undefined` | Maximum number of listings to sanitize. If not provided, processes all unsanitized listings. |

**Note**: The sanitize job should be run after materialization to prepare listings for reconciliation. The reconcile job uses sanitized fields exclusively.

## Job 5: Reconcile

**Purpose**: Extract LEGO set IDs from listing titles and descriptions, validate them against the catalog, and create join records linking listings to LEGO sets.

**Process**:
1. Queries `pipeline.listings` for unreconciled listings (`reconciled_at IS NULL`)
2. For each listing, combines title and description text
3. Text extractor uses regex pattern to extract potential LEGO set IDs (e.g., "75192-1", "10294")
4. Validates extracted IDs against `catalog.lego_sets` table
5. Creates join records in `pipeline.listing_lego_set_joins` for validated set IDs
6. Updates `listings.reconciled_at` timestamp and `reconciliation_version`

**Key Features**:
- **Batch processing**: Processes listings in batches of 100 per Inngest step
- **Selective processing**: Can reconcile specific listings by ID or all unreconciled listings
- **Validation**: Only creates joins for set IDs that exist in the catalog
- **Deduplication**: Unique constraint prevents duplicate join records
- **Version tracking**: Supports re-running reconciliation with improved algorithms

**Extraction Methods**:
- **LEGO Set IDs**: Regex pattern `\b\d{3,7}(-\d{1,2})?\b` matches:
  - Main set number: 3-7 digits (e.g., "75192", "10294")
  - Optional version suffix: dash + 1-2 digits (e.g., "-1" in "75192-1")
  - Word boundaries prevent matching partial numbers

**Data Flow**:
```
listings (unreconciled) → Text Extraction → ID Validation → listing_lego_set_joins + Update listings.reconciled_at
```

**Job Type**: `reconcile`

**Timeout**: 15 minutes

**API Endpoint**: `POST /api/reconcile/trigger`

### Reconcile Job Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `listingIds` | `string[]` | No | `undefined` | Array of specific listing IDs to reconcile. If provided, only these listings will be reconciled. |
| `limit` | `number` | No | `undefined` | Maximum number of unreconciled listings to process. If not provided, processes all unreconciled listings. |
| `reconciliationVersion` | `string` | No | Current version | Version of reconciliation algorithm to use. Allows re-running listings with improved logic. |
| `cleanupMode` | `string` | No | `'supersede'` | How to handle old join records: `'supersede'` (mark as superseded), `'delete'` (delete old records), or `'keep'` (keep all). |

**Note**: If `listingIds` is provided, `limit` is ignored. If neither is provided, all unreconciled listings (where `reconciled_at IS NULL`) are processed. The job queries the `listings` table directly and does not rely on `listing_analysis`. The reconcile job uses sanitized fields (`sanitised_title` and `sanitised_description`) exclusively to ensure clean text extraction without HTML markup interference.

### Example Requests

**Reconcile all unreconciled listings:**
```json
{}
```

**Reconcile specific listings:**
```json
{
  "listingIds": [
    "123e4567-e89b-12d3-a456-426614174000",
    "223e4567-e89b-12d3-a456-426614174001"
  ]
}
```

**Reconcile up to 500 unreconciled listings:**
```json
{
  "limit": 500
}
```

## Job 6: Analyze

**Purpose**: Extract key attributes from listings and evaluate value.

**Process**:
1. Queries for unanalyzed listings (no `listing_analysis` record exists)
2. For each listing, combines title and description text
3. Text extractor parses text to extract:
   - Piece count (with estimated flag)
   - Minifig count (with estimated flag)
   - Condition
4. Value evaluator calculates price per piece (if price and piece count available)
5. Stores results in `pipeline.listing_analysis`
6. Updates existing analysis records if they already exist

**Key Features**:
- **Batch processing**: Processes listings in batches of 100 per Inngest step
- **Selective processing**: Can analyze specific listings by ID or all unanalyzed listings
- **Analysis versioning**: Analysis records include version numbers for algorithm changes

**Extraction Methods**:
- **Piece Count**: Regex patterns for "500 pieces", "~1000 pcs", etc.
- **Minifig Count**: Regex patterns for "5 minifigs", "10 figs", etc.
- **Condition**: Keyword matching for "new", "used", "sealed", etc.
- **Price Per Piece**: Calculated from listing price ÷ piece count

**Data Flow**:
```
listings (unanalyzed) → Text Extraction → Value Evaluation → listing_analysis
```

**Job Type**: `analyze_listings`

**Timeout**: 15 minutes

**API Endpoint**: `POST /api/analyze/trigger`

### Analyze Job Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `listingIds` | `string[]` | No | `undefined` | Array of specific listing IDs to analyze. If provided, only these listings will be analyzed. |
| `limit` | `number` | No | `undefined` | Maximum number of unanalyzed listings to process. If not provided, processes all unanalyzed listings. |

**Note**: If `listingIds` is provided, `limit` is ignored. If neither is provided, all unanalyzed listings are processed.

### Example Requests

**Analyze all unanalyzed listings:**
```json
{}
```

**Analyze specific listings:**
```json
{
  "listingIds": [
    "123e4567-e89b-12d3-a456-426614174000",
    "223e4567-e89b-12d3-a456-426614174001"
  ]
}
```

**Analyze up to 500 unanalyzed listings:**
```json
{
  "limit": 500
}
```



## Job Orchestration with Inngest

All jobs are orchestrated using [Inngest](https://www.inngest.com/), which provides:

- **Long-running job support**: Jobs can run for hours without timing out
- **Step functions**: Work is broken into atomic steps that can be cancelled between steps
- **Automatic retries**: Failed steps can be automatically retried
- **Progress tracking**: Each step can report progress independently
- **Cancellation support**: Jobs can be cancelled from the Inngest UI, and cancellation status is synced to the database

### Job Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Running: Job Created
    Running --> Completed: Success
    Running --> Failed: Error
    Running --> Failed: Cancelled
    Running --> Failed: Timeout
    Completed --> [*]
    Failed --> [*]
```

## Schema Organization

### `pipeline` Schema

All data related to the capture and analysis pipeline:

- **`raw_listings`**: Raw API responses (ground truth)
  - Includes both search and enrichment responses
  - `job_id` column links raw listings to their capture job
  - Preserved for auditability and reprocessing

- **`raw_listing_details`**: Enriched item details from getItem API
  - Linked to `raw_listings` via `raw_listing_id`
  - Stores full getItem API response
  - Created by enrich job

- **`listings`**: Structured listing data
  - Basic fields: `title`, `description`, `price`, `currency`, `url`, `image_urls`, etc.
  - Sanitised fields: `sanitised_title`, `sanitised_description`, `sanitised_at`
  - Enrichment fields: `description`, `additional_images`, `condition_description`, `category_path`, `item_location`, `estimated_availabilities`, `buying_options`
  - Tracking fields: `first_seen_at`, `last_seen_at`, `enriched_at`, `reconciled_at`, `reconciliation_version`
  - Unique constraint: `(marketplace, external_id)`

- **`listing_analysis`**: Extracted attributes and calculated values
  - `piece_count`, `estimated_piece_count`, `minifig_count`, `estimated_minifig_count`
  - `condition`, `price_per_piece`
  - `analysis_metadata` (JSONB), `analysis_version`, `analyzed_at`

- **`listing_lego_set_joins`**: Join records linking listings to LEGO sets
  - `listing_id` - Reference to `pipeline.listings`
  - `lego_set_id` - Reference to `catalog.lego_sets`
  - `nature` - Relationship type (e.g., "mentioned", "included", "complete", "partial")
  - Unique constraint on `(listing_id, lego_set_id)` prevents duplicates

- **`jobs`**: Job tracking for async operations
  - Job types: `ebay_refresh_listings`, `ebay_enrich_listings`, `ebay_materialize_listings`, `sanitize_listings`, `reconcile`, `analyze_listings`
  - Includes progress tracking (`updated_at`, `last_update`), timeout management (`timeout_at`), and statistics
  - Metadata field (JSONB) stores job-specific parameters

### `public` Schema

All data related to user-facing features:
- `profiles`: User profiles (linked to auth.users)

## Job Processing System

All asynchronous operations in the pipeline are managed through a unified job processing system. This ensures consistent tracking, progress monitoring, and error handling across all job types.

### Job Timeout Configuration

| Job Type | Timeout Duration |
|----------|----------------|
| `ebay_refresh_listings` (Capture) | 30 minutes |
| `ebay_enrich_listings` (Enrich) | 60 minutes |
| `ebay_materialize_listings` (Materialize) | 30 minutes |
| `sanitize_listings` (Sanitize) | 30 minutes |
| `reconcile` (Reconcile) | 15 minutes |
| `analyze_listings` (Analyze) | 15 minutes |
| Default (unknown types) | 30 minutes |

### Stale Job Detection

Jobs are considered stale and marked as timed out if **any** of the following conditions are met:

1. **No Progress Update**: `updated_at < NOW() - 10 minutes`
2. **Exceeded Timeout**: `timeout_at IS NOT NULL AND timeout_at < NOW()`
3. **Absolute Maximum**: `started_at < NOW() - 60 minutes`

### Job Monitoring

The frontend UI (`/backend/resources/jobs`) provides real-time job monitoring:
- Auto-refresh: Polls `/api/jobs` every 2 seconds when running jobs are detected
- Progress display: Shows `updated_at`, `last_update`, and job statistics
- Status indicators: Visual indicators for running, completed, failed, and timed out jobs

## API Endpoints Summary

| Endpoint | Method | Purpose | Job Type Created |
|----------|--------|---------|------------------|
| `/api/capture/trigger` | POST | Trigger capture job | `ebay_refresh_listings` |
| `/api/capture/enrich` | POST | Trigger enrichment job | `ebay_enrich_listings` |
| `/api/materialize/trigger` | POST | Trigger materialize job | `ebay_materialize_listings` |
| `/api/sanitize/trigger` | POST | Trigger sanitize job | `sanitize_listings` |
| `/api/reconcile/trigger` | POST | Trigger reconcile job | `reconcile` |
| `/api/analyze/trigger` | POST | Trigger analysis job | `analyze_listings` |
| `/api/jobs` | GET | View all jobs with optional filtering | - |
| `/api/jobs/cleanup` | POST | Manually trigger stale job cleanup | - |
| `/api/jobs/cleanup` | GET | Get stale job statistics | - |

## Key Design Decisions

1. **Raw Listings as Ground Truth**: All raw API responses are preserved in `raw_listings` for auditability and reprocessing
2. **Two-Stage Capture Process**: Capture fetches raw data; Materialize transforms it into structured format
3. **Separation of Concerns**: Capture only fetches data; Materialize handles transformation and deduplication
4. **Page-Level Steps**: Capture job uses page-level Inngest steps to prevent timeouts and enable cancellation
5. **Stream Processing**: Data is stored immediately to avoid "output too large" errors
6. **Optional Enrichment**: Enrichment is a separate, optional step that can be run independently
7. **Text Sanitization**: Sanitize job removes HTML markup from listings to prepare clean text for reconciliation and analysis
8. **Schema Separation**: Pipeline data is isolated from user data for better organization and security
9. **Modular Value Evaluation**: Value evaluators are pluggable, allowing different evaluation strategies
10. **Deduplication**: Prevents duplicate listings while tracking when listings are seen again
11. **Analysis Versioning**: Analysis records include version numbers for algorithm changes
12. **Rate Limiting**: Enrichment includes configurable delays to prevent API abuse
13. **Unified Job Processing**: All async operations use the same job tracking system for consistency
14. **Progress Tracking**: Jobs report progress at regular intervals for visibility and stale detection
15. **Automatic Timeout Detection**: Hybrid approach ensures stale jobs are detected and marked
16. **Type-Specific Timeouts**: Different job types have appropriate timeout durations based on expected execution time
17. **Sanitized Text Processing**: Reconcile job uses sanitized fields exclusively to ensure clean text extraction without HTML markup interference
