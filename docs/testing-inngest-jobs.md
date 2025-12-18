# Step-by-Step Guide: Testing Inngest Jobs

This guide walks you through testing all three job types (Capture, Enrich, Analyze) with the new Inngest implementation.

## Prerequisites

1. **Inngest Account Setup** (if not already done):
   - Go to https://www.inngest.com and sign up
   - Create an app (name it `bricks-pipeline`)
   - Get your API keys from Settings → API Keys:
     - Event Key (starts with `evt_`)
     - Signing Key (starts with `signkey_`)

2. **Environment Variables**:
   Make sure your `.env.local` has:
   ```env
   # Inngest Configuration
   INNGEST_EVENT_KEY=evt_your_event_key_here
   INNGEST_SIGNING_KEY=signkey_your_signing_key_here
   INNGEST_APP_ID=your_app_id_here  # Optional
   INNGEST_ENV=development

   # Supabase (required for jobs)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # eBay API (required for capture/enrich jobs)
   EBAY_APP_ID=your_ebay_app_id
   EBAY_CLIENT_SECRET=your_ebay_client_secret
   EBAY_ENVIRONMENT=PRODUCTION  # or 'SANDBOX' (must be uppercase)
   
   # Optional: Use cache mode for testing (no live API calls)
   EBAY_DATA_MODE=cache  # Set to 'cache' to use snapshot data instead of live API
   ```

## Step 1: Start Inngest Dev Server

Open a terminal and run:

```bash
npx inngest-cli@latest dev
```

You should see:
```
✓ Inngest dev server running
  → Dashboard: http://localhost:8288
  → API: http://localhost:8288/api/inngest
```

**Keep this terminal open** - the dev server needs to stay running.

## Step 2: Start Next.js App

Open a **second terminal** and run:

```bash
npm run dev
```

You should see:
```
✓ Ready on http://localhost:3000
```

## Step 3: Verify Setup

1. **Check Inngest Dashboard**: Open http://localhost:8288 in your browser
   - You should see your three functions registered:
     - `capture-job`
     - `enrich-job`
     - `analyze-job`

2. **Check Next.js is running**: Open http://localhost:3000

## Step 4: Test Capture Job

The capture job searches for listings and stores them in the database.

### Option A: Using curl

```bash
curl -X POST http://localhost:3000/api/capture/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "marketplace": "ebay",
    "keywords": ["lego bulk", "lego job lot"]
  }'
```

### Option B: Using the Frontend

If you have a frontend UI, navigate to the capture page and trigger a job.

### Expected Response:
```json
{
  "status": "running",
  "message": "Job started, check /api/jobs for status"
}
```

### Verify It's Working:

1. **Check Inngest Dashboard** (http://localhost:8288):
   - Go to "Events" tab - you should see `job/capture.triggered` event
   - Go to "Runs" tab - you should see `capture-job` function executing
   - Click on a run to see step-by-step progress

2. **Check Job Status**:
   ```bash
   curl http://localhost:3000/api/jobs?type=ebay_refresh_listings&limit=1
   ```
   - Should return a job with `status: "running"` or `status: "completed"`

3. **Check Database**:
   - Query `pipeline.jobs` table for the latest job
   - Query `pipeline.listings` table to see if new listings were added

## Step 5: Test Enrichment Job

The enrichment job enriches existing listings with detailed information.

**Note**: This requires listings to exist in the database. If you just ran the capture job, you should have some listings. Otherwise, you may need to run capture first.

### Option A: Using curl

```bash
curl -X POST http://localhost:3000/api/capture/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "marketplace": "ebay",
    "limit": 5,
    "delayMs": 200
  }'
```

### Option B: Using the Frontend

Navigate to the enrichment page and trigger a job.

### Expected Response:
```json
{
  "status": "running",
  "message": "Job started, check /api/jobs for status"
}
```

### Verify It's Working:

1. **Check Inngest Dashboard**:
   - Events tab: `job/enrich.triggered` event
   - Runs tab: `enrich-job` function executing
   - Watch the step-by-step progress

2. **Check Job Status**:
   ```bash
   curl http://localhost:3000/api/jobs?type=ebay_enrich_listings&limit=1
   ```

3. **Check Database**:
   - Query `pipeline.jobs` for the enrichment job
   - Query `pipeline.listings` - enriched listings should have `enriched_at` set
   - Check `pipeline.raw_listings` for enriched API responses

## Step 6: Test Analysis Job

The analysis job analyzes listings to extract attributes (piece count, minifigures, etc.).

**Note**: This requires listings to exist. Ideally, run capture first, then optionally enrich, then analyze.

### Option A: Analyze All Unanalyzed Listings

```bash
curl -X POST http://localhost:3000/api/analyze/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 10
  }'
```

### Option B: Analyze Specific Listings

```bash
curl -X POST http://localhost:3000/api/analyze/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "listingIds": ["listing-id-1", "listing-id-2"]
  }'
```

### Expected Response:
```json
{
  "status": "running",
  "message": "Job started, check /api/jobs for status"
}
```

### Verify It's Working:

1. **Check Inngest Dashboard**:
   - Events tab: `job/analyze.triggered` event
   - Runs tab: `analyze-job` function executing
   - Watch the step-by-step progress

2. **Check Job Status**:
   ```bash
   curl http://localhost:3000/api/jobs?type=analyze_listings&limit=1
   ```

3. **Check Database**:
   - Query `pipeline.jobs` for the analysis job
   - Query `pipeline.listing_analysis` - should have new analysis records
   - Check for extracted attributes like `piece_count`, `minifig_count`, `price_per_piece`

## Troubleshooting

### Issue: "INNGEST_EVENT_KEY environment variable is required"

**Solution**: Make sure you've added the Inngest environment variables to `.env.local` and restarted your Next.js dev server.

### Issue: Functions don't appear in Inngest dashboard

**Solution**: 
1. Make sure Inngest dev server is running
2. Make sure Next.js app is running and can reach `http://localhost:8288`
3. Check the Inngest dev server logs for errors
4. Try restarting both servers

### Issue: Jobs don't execute

**Solution**:
1. Check Inngest dashboard → Events tab - do you see events being received?
2. Check Inngest dashboard → Runs tab - are functions being triggered?
3. Check Next.js console for errors
4. Check Inngest dev server logs for errors

### Issue: Jobs fail immediately

**Solution**:
1. Check the Inngest dashboard → Runs tab → Click on failed run → Check error details
2. Verify your Supabase credentials are correct
3. Verify your eBay API credentials (if using live mode)
4. Check Next.js console for detailed error messages

### Issue: Jobs timeout

**Solution**:
- This shouldn't happen with Inngest step functions, but if it does:
  1. Check the Inngest dashboard to see which step failed
  2. The step functions break work into chunks, so timeouts should be rare
  3. If a step times out, Inngest will retry it automatically

## Quick Test Script

Here's a quick script to test all three jobs in sequence:

```bash
#!/bin/bash

echo "1. Testing Capture Job..."
curl -X POST http://localhost:3000/api/capture/trigger \
  -H "Content-Type: application/json" \
  -d '{"marketplace": "ebay", "keywords": ["lego bulk"]}'

echo -e "\n\n2. Waiting 10 seconds for capture to start..."
sleep 10

echo -e "\n3. Testing Enrichment Job..."
curl -X POST http://localhost:3000/api/capture/enrich \
  -H "Content-Type: application/json" \
  -d '{"marketplace": "ebay", "limit": 5}'

echo -e "\n\n4. Waiting 10 seconds for enrich to start..."
sleep 10

echo -e "\n5. Testing Analysis Job..."
curl -X POST http://localhost:3000/api/analyze/trigger \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

echo -e "\n\nDone! Check http://localhost:8288 for job execution details."
```

## Monitoring Jobs

### Inngest Dashboard
- **Events**: See all events being sent
- **Runs**: See function executions with step-by-step progress
- **Functions**: See registered functions and their configurations

### Job Status API
```bash
# Get all jobs
curl http://localhost:3000/api/jobs

# Get jobs by type
curl http://localhost:3000/api/jobs?type=ebay_refresh_listings

# Get jobs by status
curl http://localhost:3000/api/jobs?status=running

# Get specific job
curl http://localhost:3000/api/jobs/[job-id]
```

### Database Queries

```sql
-- Check latest jobs
SELECT * FROM pipeline.jobs 
ORDER BY started_at DESC 
LIMIT 10;

-- Check job progress
SELECT id, type, status, last_update, listings_found, listings_new, listings_updated
FROM pipeline.jobs
WHERE status = 'running'
ORDER BY started_at DESC;

-- Check completed jobs
SELECT id, type, status, completed_at, listings_found, listings_new, listings_updated
FROM pipeline.jobs
WHERE status = 'completed'
ORDER BY completed_at DESC
LIMIT 10;
```

## Success Indicators

✅ **Capture Job Success**:
- Job status changes to `completed`
- `listings_found` > 0
- New records in `pipeline.listings` table
- New records in `pipeline.raw_listings` table

✅ **Enrichment Job Success**:
- Job status changes to `completed`
- `listings_updated` > 0 (or matches `listings_found`)
- Listings have `enriched_at` timestamp set
- Enriched data in `pipeline.listings` (description, additional_images, etc.)

✅ **Analysis Job Success**:
- Job status changes to `completed`
- `listings_new` > 0 (new analyses created)
- New records in `pipeline.listing_analysis` table
- Analysis records have extracted data (piece_count, minifig_count, etc.)

## Next Steps

Once you've verified all three jobs work:
1. Test with larger datasets
2. Test error scenarios (invalid credentials, network failures, etc.)
3. Monitor the Inngest dashboard for performance
4. Check that step functions are properly chunking long-running jobs

