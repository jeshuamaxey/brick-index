# eBay Snapshot Cache Mode

This document explains how to capture real eBay responses once and reuse them locally without calling the live eBay API.

## Quick Start

Run these npm scripts to manage eBay snapshots:

- **`npm run seed:fetch-ebay-snapshot`** - Fetch live data from eBay Browse API and save as snapshot files
- **`npm run seed:load-ebay-snapshot-into-supabase`** - Load snapshot files into Supabase database
- **`npm run seed:delete-ebay-snapshots`** - Delete all snapshot files (use `--confirm` flag)

## Overview

- Snapshots are JSON files stored under `data/ebay-snapshots/`.
- They contain raw eBay Browse API responses and some metadata.
- The `EbaySnapshotAdapter` implements `MarketplaceAdapter` and reads from these files when `EBAY_DATA_MODE=cache`.
- The rest of the system (capture, analyze, discover) continues to work against Supabase as usual.
- **Note**: The `data/ebay-snapshots/` directory is git-ignored to prevent committing production data.

## Snapshot data format

Each snapshot file looks like this (simplified):

```json
{
  "profile": "broad-bulk-lots",
  "mode": "normal",
  "keywords": ["lego bulk", "lego job lot", "lego lot"],
  "params": {
    "entriesPerPage": 100,
    "listingTypes": ["FIXED_PRICE", "AUCTION"]
  },
  "createdAt": "2025-01-01T12:34:56.000Z",
  "items": [
    {
      "itemId": "123456789",
      "title": "Large LEGO Bulk Lot",
      "itemWebUrl": "https://www.ebay.com/itm/123456789",
      "price": { "value": "150.00", "currency": "USD" },
      "image": { "imageUrl": "https://..." },
      "seller": { "username": "seller123", "feedbackScore": 500 }
    }
  ],
  "originalItemCount": 42,
  "error": {
    "code": "SIMULATED_EBAY_ERROR",
    "message": "Simulated error for testing"
  }
}
```

- `mode` can be:
  - `"normal"`: items are real responses from eBay Browse API.
  - `"empty"`: `items` is forced to an empty array; `originalItemCount` records how many items eBay actually returned.
  - `"error"`: `items` is empty and `error` is populated so the adapter can throw a simulated error.
- An `_index.json` file in the same directory tracks available snapshots (underscore prefix keeps it at the top when sorted):

```json
{
  "snapshots": [
    {
      "file": "broad-bulk-lots-2025-01-01T12-34-56-000Z.json",
      "profile": "broad-bulk-lots",
      "mode": "normal",
      "createdAt": "2025-01-01T12:34:56.000Z",
      "keywords": ["lego bulk", "lego job lot", "lego lot"],
      "itemCount": 100
    }
  ]
}
```

## Creating snapshots

Run the snapshot script in an environment that has valid eBay credentials:

```bash
npm run seed:fetch-ebay-snapshot
# Or target a specific profile:
# npm run seed:fetch-ebay-snapshot -- --profile=broad-bulk-lots
```

**Required environment variables:**
- `EBAY_APP_ID` - Your eBay production App ID
- `EBAY_OAUTH_APP_TOKEN` - Your eBay OAuth access token (required for Browse API)

The script:
- Uses `EbayAdapter` to call the live eBay Browse API (`/buy/browse/v1/item_summary/search`).
- Generates multiple **profiles** of queries:
  - Broad, high-volume searches.
  - Niche/filtered searches.
  - Forced-empty successful responses.
  - Synthetic error responses (no live API call).
- Writes one JSON file per profile plus an updated `_index.json` (which includes item counts for each snapshot).
- **Note**: The script automatically sets `EBAY_ENVIRONMENT=production` to ensure snapshots are always fetched from production.

## Using snapshots in local dev

1. Copy the `data/ebay-snapshots` directory into your local workspace.  
   - The directory is git-ignored, so you'll need to copy it manually or generate snapshots locally.
2. Set environment variables in `.env.local`:

```env
EBAY_DATA_MODE=cache
# Optional selectors:
EBAY_SNAPSHOT_PROFILE=broad-bulk-lots
# or
EBAY_SNAPSHOT_FILE=broad-bulk-lots-2025-01-01T12-34-56-000Z.json
```

3. Trigger capture from `/dev/capture` or `/api/capture/trigger`.  
   - `EbaySnapshotAdapter` will read from the chosen snapshot and feed items into `CaptureService`.
   - `CaptureService` writes into `pipeline.raw_listings` and `pipeline.listings` so analysis and discover work unchanged.
   - **No OAuth credentials are required** when using cache mode - the snapshot adapter doesn't make any API calls.

## Loading snapshots directly into Supabase

You can also load a snapshot file into Supabase without going through the HTTP API:

```bash
npm run seed:load-ebay-snapshot-into-supabase
# or with explicit file/dir:
# npm run seed:load-ebay-snapshot-into-supabase -- --dir=./data/ebay-snapshots --file=my-snapshot.json
# or load a specific profile:
# npm run seed:load-ebay-snapshot-into-supabase -- --profile=broad-bulk-lots
```

This script:
- Uses `supabaseServer` and `CaptureService`.
- Wraps `EbaySnapshotAdapter` so that all snapshot items are treated like a regular capture job.
- By default, loads all normal snapshots (excludes empty/error snapshots unless you use `--include-empty` or `--include-error` flags).
- **No OAuth credentials are required** - the snapshot adapter uses dummy credentials internally.

## Deleting snapshots

To delete all snapshot files:

```bash
# Preview what would be deleted (safe, no deletion)
npm run seed:delete-ebay-snapshots

# Actually delete all snapshots
npm run seed:delete-ebay-snapshots -- --confirm
```

## Modes and error/empty testing

To test different behaviours:

- **Normal results**: use a `mode: "normal"` profile.
- **Successful but empty results**: use a `mode: "empty"` profile; the adapter returns `[]`.
- **Error responses**: use a `mode: "error"` profile; the adapter throws an error mimicking a failed eBay call.

## API Details

The snapshot system uses the **eBay Browse API** (not the legacy Finding API):
- Endpoint: `https://api.ebay.com/buy/browse/v1/item_summary/search`
- Authentication: OAuth Bearer token (required for fetching snapshots)
- Response format: RESTful JSON with `itemSummaries` array

The Browse API provides more modern, structured responses compared to the legacy Finding API.
