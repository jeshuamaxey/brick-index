## eBay Snapshot Cache Mode

This document explains how to capture real eBay responses once and reuse them locally without calling the live eBay API.

### Overview

- Snapshots are JSON files stored under `data/ebay-snapshots/`.
- They contain raw eBay Finding API `findItemsByKeywords` responses and some metadata.
- The `EbaySnapshotAdapter` implements `MarketplaceAdapter` and reads from these files when `EBAY_DATA_MODE=cache`.
- The rest of the system (capture, analyze, discover) continues to work against Supabase as usual.

### Snapshot data format

Each snapshot file looks like this (simplified):

```json
{
  "profile": "broad-bulk-lots",
  "mode": "normal",
  "keywords": ["lego bulk", "lego job lot", "lego lot"],
  "params": {
    "entriesPerPage": 100,
    "listingTypes": ["AuctionWithBIN", "FixedPrice"],
    "hideDuplicateItems": true
  },
  "createdAt": "2025-01-01T12:34:56.000Z",
  "items": [
    { "itemId": ["123"], "title": ["..."], "...": "..." }
  ],
  "originalItemCount": 42,
  "error": {
    "code": "SIMULATED_EBAY_ERROR",
    "message": "Simulated error for testing"
  }
}
```

- `mode` can be:
  - `"normal"`: items are real responses from eBay.
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

### Creating snapshots

Run the snapshot script in an environment that has a valid `EBAY_APP_ID`:

```bash
npx tsx scripts/fetch-ebay-snapshot.ts
# Or target a specific profile:
# npx tsx scripts/fetch-ebay-snapshot.ts --profile=broad-bulk-lots
```

The script:

- Uses `EbayAdapter` to call the live `findItemsByKeywords` API.
- Generates multiple **profiles** of queries:
  - Broad, high-volume searches.
  - Niche/filtered searches.
  - Forced-empty successful responses.
  - Synthetic error responses (no live API call).
- Writes one JSON file per profile plus an updated `_index.json` (which includes item counts for each snapshot).

### Using snapshots in local dev

1. Copy the `data/ebay-snapshots` directory into your local workspace.  
   - Do **not** commit it to git if it contains production data.
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

### Loading snapshots directly into Supabase

You can also load a snapshot file into Supabase without going through the HTTP API:

```bash
npx tsx scripts/load-ebay-snapshot-into-supabase.ts
# or with explicit file/dir:
# npx tsx scripts/load-ebay-snapshot-into-supabase.ts --dir=./data/ebay-snapshots --file=my-snapshot.json
```

This script:

- Uses `supabaseServer` and `CaptureService`.
- Wraps `EbaySnapshotAdapter` so that all snapshot items are treated like a regular capture job.

### Modes and error/empty testing

To test different behaviours:

- **Normal results**: use a `mode: "normal"` profile.
- **Successful but empty results**: use a `mode: "empty"` profile; the adapter returns `[]`.
- **Error responses**: use a `mode: "error"` profile; the adapter throws an error mimicking a failed eBay call.


