# Data Pipeline Documentation

This document describes how data flows through the LEGO marketplace scraper system.

## Pipeline Overview

The system processes data through three main stages: **Capture**, **Analyze**, and **Discover**.

```mermaid
flowchart TD
    Start([User Triggers Capture]) --> Capture[1. CAPTURE]
    
    Capture --> MarketplaceAPI[eBay Search API]
    MarketplaceAPI --> RawListings[(pipeline.raw_listings<br/>Raw Search Responses)]
    RawListings --> Transform[Transform to Structured Data]
    Transform --> Listings[(pipeline.listings<br/>Basic Listing Data)]
    
    Listings --> Enrich[ENRICHMENT<br/>Optional Step]
    Enrich --> EnrichAPI[eBay Browse API<br/>getItem Endpoint]
    EnrichAPI --> EnrichedRaw[(pipeline.raw_listings<br/>Enriched Responses)]
    EnrichedRaw --> EnrichExtract[Extract Enrichment Fields]
    EnrichExtract --> EnrichedListings[(pipeline.listings<br/>Enriched with Description, Images, etc.)]
    
    EnrichedListings --> Analyze[2. ANALYZE]
    Listings --> Analyze
    Analyze --> TextExtractor[Text Extractor<br/>Extract piece count, minifigs, condition]
    TextExtractor --> ValueEvaluator[Value Evaluator<br/>Calculate price per piece]
    ValueEvaluator --> Analysis[(pipeline.listing_analysis<br/>Analysis Results)]
    
    Analysis --> Discover[3. DISCOVER]
    EnrichedListings --> Discover
    Listings --> Discover
    Searches[(public.searches<br/>User Search Criteria)] --> Discover
    Discover --> Matching[Matching Service<br/>Find listings matching criteria]
    Matching --> SearchResults[(public.search_results<br/>Matched Listings)]
    SearchResults --> EmailService[Email Service<br/>Send alerts via Resend]
    EmailService --> UserEmail[User Email]
    
    style Capture fill:#dbeafe,stroke:#3b82f6
    style Enrich fill:#bfdbfe,stroke:#3b82f6
    style Analyze fill:#fef3c7,stroke:#f59e0b
    style Discover fill:#fce7f3,stroke:#ec4899
    style RawListings fill:#dcfce7,stroke:#22c55e
    style Listings fill:#dcfce7,stroke:#22c55e
    style EnrichedRaw fill:#dcfce7,stroke:#22c55e
    style EnrichedListings fill:#dcfce7,stroke:#22c55e
    style Analysis fill:#fef3c7,stroke:#f59e0b
    style Searches fill:#fce7f3,stroke:#ec4899
    style SearchResults fill:#fce7f3,stroke:#ec4899
```

## Stage 1: Capture

**Purpose**: Collect LEGO listings from marketplace APIs

### Initial Capture

**Process**:
1. Marketplace adapter (eBay) searches for listings using keywords via Search API
2. Raw API responses are stored in `pipeline.raw_listings` (ground truth)
3. Raw responses are transformed into structured `pipeline.listings` records
4. Deduplication ensures no duplicate listings are stored
5. Existing listings are updated with new `last_seen_at` timestamp

**Data Flow**:
```
eBay Search API → raw_listings → Transform → listings (basic data)
```

### Enrichment (Optional)

**Purpose**: Enhance listings with detailed information from eBay Browse API

**Process**:
1. Enrichment service queries for unenriched listings (`enriched_at IS NULL`)
2. For each listing, calls eBay Browse API `getItem` endpoint
3. Raw enriched responses stored in `pipeline.raw_listings`
4. Extracted fields updated in `pipeline.listings`:
   - `description` - Full listing description
   - `additional_images` - Array of additional image URLs
   - `condition_description` - Detailed condition information
   - `category_path` - Full category hierarchy
   - `item_location` - Structured location data
   - `estimated_availabilities` - Stock/quantity information
   - `buying_options` - Array of buying options
5. Listing marked as enriched with `enriched_at` timestamp

**Rate Limiting**: Configurable delay between API calls (default: 200ms) to prevent API abuse

**Data Flow**:
```
listings (unenriched) → eBay Browse API getItem → raw_listings (enriched) → Extract Fields → listings (enriched)
```

**Key Tables**:
- `pipeline.raw_listings`: Raw JSON responses from APIs (both search and enrichment)
- `pipeline.listings`: Structured listing data with enrichment fields
- `pipeline.capture_jobs`: Log of capture operations

**API Endpoints**:
- `POST /api/capture/trigger` - Trigger initial capture
- `POST /api/capture/enrich` - Trigger enrichment process

## Stage 2: Analyze

**Purpose**: Extract key attributes from listings and evaluate value

**Process**:
1. Text extractor parses listing title and description
2. Extracts: piece count, minifig count, condition
3. Value evaluator calculates price per piece
4. Results stored in `pipeline.listing_analysis`

**Extraction Methods**:
- **Piece Count**: Regex patterns for "500 pieces", "~1000 pcs", etc.
- **Minifig Count**: Regex patterns for "5 minifigs", "10 figs", etc.
- **Condition**: Keyword matching for "new", "used", "sealed", etc.
- **Price Per Piece**: Calculated from listing price ÷ piece count

**Key Tables**:
- `pipeline.listing_analysis`: Extracted attributes and calculated values

**Data Flow**:
```
listings → Text Extraction → Value Evaluation → listing_analysis
```

## Stage 3: Discover

**Purpose**: Match listings to user search criteria and send email alerts

**Process**:
1. Matching service compares `pipeline.listings` + `pipeline.listing_analysis` against `public.searches`
2. Matches are stored in `public.search_results`
3. Email service sends alerts for new matches via Resend
4. `notified_at` timestamp tracks which matches have been emailed

**Matching Criteria** (POC):
- `max_price_per_piece`: Only listings with price per piece ≤ search criteria

**Key Tables**:
- `public.searches`: User-defined search criteria
- `public.search_results`: Matched listings for each search

**Data Flow**:
```
listings + listing_analysis + searches → Matching → search_results → Email Alerts
```

## Schema Organization

### `pipeline` Schema
All data related to the capture and analysis pipeline:
- `raw_listings`: Raw API responses (ground truth) - includes both search and enrichment responses
- `listings`: Structured listing data with enrichment fields (description, additional_images, condition_description, category_path, item_location, estimated_availabilities, buying_options)
- `listing_analysis`: Extracted attributes and calculated values
- `capture_jobs`: Capture operation logs

### `public` Schema
All data related to user-facing features:
- `profiles`: User profiles (linked to auth.users)
- `searches`: User search criteria
- `search_results`: Matched listings (references `pipeline.listings`)

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant User
    participant Capture as Capture Service
    participant SearchAPI as eBay Search API
    participant BrowseAPI as eBay Browse API
    participant DB as Database
    participant Enrich as Enrichment Service
    participant Analyze as Analysis Service
    participant Discover as Discover Service
    participant Email as Email Service
    
    User->>Capture: Trigger Capture
    Capture->>SearchAPI: Search Listings
    SearchAPI-->>Capture: Raw Search Responses
    Capture->>DB: Store in raw_listings
    Capture->>DB: Transform to listings
    Capture-->>User: Capture Complete
    
    User->>Enrich: Trigger Enrichment (Optional)
    Enrich->>DB: Query unenriched listings
    loop For each listing
        Enrich->>BrowseAPI: getItem(itemId)
        BrowseAPI-->>Enrich: Detailed Item Data
        Enrich->>DB: Store enriched response in raw_listings
        Enrich->>DB: Update listing with extracted fields
    end
    Enrich-->>User: Enrichment Complete
    
    User->>Analyze: Analyze Listings
    Analyze->>DB: Read listings (with description)
    Analyze->>Analyze: Extract Text
    Analyze->>Analyze: Calculate Value
    Analyze->>DB: Store in listing_analysis
    
    User->>Discover: Process Notifications
    Discover->>DB: Read searches
    Discover->>DB: Read listings + analysis
    Discover->>Discover: Match Criteria
    Discover->>DB: Store in search_results
    Discover->>Email: Send Alerts
    Email-->>User: Email Delivered
```

## Key Design Decisions

1. **Raw Listings as Ground Truth**: All raw API responses are preserved in `raw_listings` for auditability and reprocessing
2. **Two-Step Capture Process**: Initial capture uses Search API for discovery, enrichment uses Browse API for detailed data
3. **Optional Enrichment**: Enrichment is a separate, optional step that can be run independently
4. **Schema Separation**: Pipeline data is isolated from user data for better organization and security
5. **Modular Value Evaluation**: Value evaluators are pluggable, allowing different evaluation strategies
6. **Deduplication**: Prevents duplicate listings while tracking when listings are seen again
7. **Analysis Versioning**: Analysis records include version numbers for algorithm changes
8. **Rate Limiting**: Enrichment includes configurable delays to prevent API abuse

