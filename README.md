# LEGO Marketplace Scraper Backend

A backend system to capture, analyze, and discover bulk LEGO job-lot listings from public marketplaces (eBay, etc.).

## Features

- **Capture**: Daily API-based collection of LEGO bulk/job-lot listings
- **Analyze**: Extract key attributes (piece count, minifigures, condition) from listings
- **Discover**: Match listings to user search criteria and send email alerts

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Language**: TypeScript
- **Email**: Resend
- **Testing**: Vitest

## Setup

### Prerequisites

1. Node.js 20+
2. Supabase account and project
3. eBay Developer account and App ID
4. Resend account and API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (create `.env.local`):
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # eBay API
   EBAY_APP_ID=your_ebay_app_id

   # Resend
   RESEND_API_KEY=your_resend_api_key
   RESEND_FROM_EMAIL=noreply@yourdomain.com

   # App
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. Initialize Supabase locally:
   ```bash
   npx supabase init
   ```

5. Run database migrations:
   ```bash
   npx supabase db reset
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## Database Schema

The database is organized into two schemas:

### `pipeline` Schema (Analysis Pipeline Data)
All data related to the capture and analysis pipeline:
- `raw_listings`: Raw API responses (ground truth)
- `listings`: Structured listing data
- `listing_analysis`: Extracted attributes (piece count, minifigs, etc.)
- `capture_jobs`: Capture job logs

### `public` Schema (End User Application Data)
All data related to user-facing features:
- `profiles`: User profiles (linked to auth.users)
- `searches`: User search criteria
- `search_results`: Matched listings for searches (references `pipeline.listings`)

## API Routes

### Capture

- `POST /api/capture/trigger` - Trigger a capture job
- `GET /api/capture/status/[jobId]` - Get capture job status

### Analysis

- `POST /api/analyze/[listingId]` - Analyze a specific listing

### Listings

- `GET /api/listings/search` - Search listings
- `GET /api/listings/[id]` - Get listing details

### Discover

- `POST /api/discover/notify` - Process notifications (matching and email)

## Dev Frontend

Access dev pages at:

- `/dev/listings` - View captured listings
- `/dev/analysis` - View analysis results
- `/dev/capture` - Trigger capture jobs

## Testing

Run tests:
```bash
npm test
```

Run tests with UI:
```bash
npm run test:ui
```

## Architecture

The system is organized into three main components:

1. **Capture** (`lib/capture/`): Marketplace adapters and capture service
2. **Analyze** (`lib/analyze/`): Text extraction and value evaluation
3. **Discover** (`lib/discover/`): Matching service and email notifications

### Data Pipeline

See [Pipeline Documentation](./docs/pipeline.md) for a detailed description of how data flows through the system.

The pipeline flows as follows:

1. **Capture**: Marketplace APIs (eBay) → Raw API responses stored in `pipeline.raw_listings` → Transformed into structured `pipeline.listings`
2. **Analyze**: `pipeline.listings` → Text extraction (piece count, minifigs, condition) → Value evaluation (price per piece) → Stored in `pipeline.listing_analysis`
3. **Discover**: `pipeline.listings` + `pipeline.listing_analysis` + `public.searches` → Matching service finds relevant listings → Results stored in `public.search_results` → Email alerts sent via Resend

## Value Evaluation

The system uses a modular value evaluation system. Currently implemented:

- **Simple Price Per Piece**: Calculates $/piece from listing price and piece count

The evaluator system is pluggable - you can swap evaluators without changing the rest of the system.

## Development

### Adding a New Marketplace

1. Create a new adapter in `lib/capture/marketplace-adapters/`
2. Implement the `MarketplaceAdapter` interface
3. Add the adapter to the capture service

### Adding a New Value Evaluator

1. Create a new evaluator in `lib/analyze/value-evaluator/`
2. Implement the `ValueEvaluator` interface
3. Use it in the analysis service

## License

Private project
