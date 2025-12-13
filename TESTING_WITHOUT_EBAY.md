# Testing Without eBay API Access

This guide explains what parts of the application you can use/test while waiting for eBay API approval.

## What Works Without eBay API

### ✅ Fully Functional (No eBay API Needed)

1. **Analysis Component**
   - Text extraction (piece count, minifigs, condition)
   - Value evaluation (price per piece calculation)
   - All analysis API routes work on existing data

2. **Discover/Matching Component**
   - Matching listings to user searches
   - Email notification system (if Resend is configured)
   - All matching logic works on database data

3. **Dev Frontend Pages**
   - `/dev/listings` - View any listings in database
   - `/dev/analysis` - View analysis results
   - `/dev/seed` - Seed test data (NEW!)

4. **Database & Auth**
   - All Supabase functionality
   - User authentication
   - Search creation and management

5. **Tests**
   - All unit tests work (text extraction, value evaluation)
   - Integration tests can use mock data

### ⚠️ Limited Functionality (Needs eBay API or Mock Data)

1. **Capture Component**
   - Real eBay API calls won't work without App ID
   - **BUT**: Now automatically uses mock adapter if `EBAY_APP_ID` is not set!

## How to Test Without eBay API

### Option 1: Use the Mock Adapter (Automatic)

The capture endpoint now **automatically uses a mock adapter** if `EBAY_APP_ID` is not set in your environment variables.

**Steps:**
1. Simply **don't set** `EBAY_APP_ID` in your `.env.local`
2. Go to `/dev/capture` and click "Trigger Capture"
3. It will use the mock adapter and create 5 sample listings

### Option 2: Use the Seed Endpoint (Recommended)

The easiest way to populate test data:

1. Go to `/dev/seed` in your browser
2. Click "Seed Everything" button
3. This will:
   - Create 5 mock LEGO listings
   - Analyze them automatically
   - Extract piece counts, minifigs, and calculate price per piece

### Option 3: Manual API Call

You can also call the seed API directly:

```bash
curl -X POST http://localhost:3000/api/dev/seed \
  -H "Content-Type: application/json" \
  -d '{"action": "all"}'
```

## What You Can Test Right Now

### 1. Analysis Pipeline

```bash
# Seed some listings first
# Then test analysis on a specific listing
curl -X POST http://localhost:3000/api/analyze/{listingId}
```

### 2. Search & Matching

1. Create a user account (Supabase Auth)
2. Create a search with `max_price_per_piece` criteria
3. The matching service will find listings that match
4. Test email notifications (if Resend is configured)

### 3. View Data

- `/dev/listings` - See all captured listings
- `/dev/analysis` - See analysis results
- `/dev/capture` - Trigger captures (uses mock if no API key)

## Mock Data Details

The mock adapter creates 5 sample listings:

1. **2000+ Pieces, 10 Minifigs** - $150 (used)
2. **~1500 Pieces, 5 Minifigs** - $75 (used)
3. **5000 Pieces, 25 Minifigs** - $300 (used)
4. **800 Pieces, No Minifigs** - $45 (used)
5. **3000 Pieces, New** - $250 (new)

These cover various scenarios:
- Stated vs estimated piece counts
- With and without minifig counts
- Different price points
- Different conditions

## Testing Workflow

1. **Set up Supabase** (if not done):
   ```bash
   npx supabase db reset
   ```

2. **Seed test data**:
   - Visit `/dev/seed`
   - Click "Seed Everything"

3. **Test analysis**:
   - Visit `/dev/analysis` to see extracted data
   - Verify piece counts, minifigs are extracted correctly

4. **Test matching**:
   - Create a user account
   - Create a search (e.g., `max_price_per_piece: 0.10`)
   - Call `/api/discover/notify` to process matches

5. **Test value evaluation**:
   - Check that price per piece is calculated correctly
   - Verify confidence scores for estimated vs stated counts

## When You Get eBay API Access

Once you receive your eBay App ID:

1. Add it to `.env.local`:
   ```env
   EBAY_APP_ID=your_actual_app_id
   ```

2. The capture endpoint will automatically switch from mock to real eBay API

3. You can now capture real listings from eBay!

## Summary

**You can test and develop:**
- ✅ Analysis (text extraction, value evaluation)
- ✅ Matching and notifications
- ✅ Database operations
- ✅ User authentication
- ✅ All dev frontend pages
- ✅ All tests

**You cannot test (until eBay API access):**
- ❌ Real eBay API calls (but mock works!)

**Solution:**
- Use `/dev/seed` to populate test data
- Or trigger capture without `EBAY_APP_ID` (auto-uses mock)

