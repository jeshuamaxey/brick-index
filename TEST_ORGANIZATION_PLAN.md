# Test Organization Plan

## Current State

- **`__tests__/`**: Contains actual test implementations
  - `analyze/text-extractor.test.ts`
  - `analyze/value-evaluator.test.ts`
  - `ebay/marketplace-account-deletion-notification.test.ts`
  
- **`tests/`**: Contains only `setup.ts` (Vitest configuration references this)

## Proposed Structure

Following Next.js and Vitest best practices, we'll consolidate to a single `tests/` directory with clear organization by test type and mirroring the source structure.

### Directory Structure

```
tests/
├── setup.ts                    # Global test setup (already exists)
├── unit/                       # Unit tests for pure functions/classes
│   ├── lib/
│   │   ├── analyze/
│   │   │   ├── text-extractor.test.ts
│   │   │   ├── value-evaluator.test.ts  # Tests SimplePricePerPieceEvaluator (and future evaluators)
│   │   │   └── analysis-service.test.ts
│   │   ├── capture/
│   │   │   ├── capture-service.test.ts
│   │   │   ├── deduplication-service.test.ts
│   │   │   └── marketplace-adapters/
│   │   │       ├── base-adapter.test.ts
│   │   │       ├── ebay-adapter.test.ts
│   │   │       └── mock-adapter.test.ts
│   │   ├── discover/
│   │   │   ├── email-service.test.ts
│   │   │   ├── matching-service.test.ts
│   │   │   └── notification-service.test.ts
│   │   └── ebay/
│   │       └── notification-verifier.test.ts
│   └── fixtures/               # Test fixtures and mock data
│       ├── listings.ts
│       ├── analysis.ts
│       └── supabase.ts
│
├── integration/                # Integration tests for API routes
│   └── api/
│       ├── analyze/
│       │   └── [listingId].test.ts
│       ├── capture/
│       │   ├── trigger.test.ts
│       │   ├── enrich.test.ts
│       │   └── status/
│       │       └── [jobId].test.ts
│       ├── discover/
│       │   └── notify.test.ts
│       ├── ebay/
│       │   └── marketplace-account-deletion-notification.test.ts
│       ├── listings/
│       │   ├── [id].test.ts
│       │   └── search.test.ts
│       └── dev/
│           ├── aggregate.test.ts
│           └── seed.test.ts
│
├── e2e/                        # End-to-end tests (optional, for future)
│   └── workflows/
│       ├── capture-workflow.test.ts
│       └── discover-workflow.test.ts
│
└── helpers/                    # Shared test utilities
    ├── mocks/
    │   ├── supabase.ts
    │   ├── next-request.ts
    │   └── marketplace-adapters.ts
    └── test-utils.ts
```

## Test Categories

### 1. Unit Tests (`tests/unit/`)
**Purpose**: Test individual functions, classes, and modules in isolation.

**Scope**:
- Pure functions (text extraction, value evaluation)
- Service classes with mocked dependencies
- Adapter implementations
- Utility functions

**Examples**:
- `TextExtractor.extractPieceCount()` - already exists
- `ValueEvaluator.calculateValue()` - already exists
- `CaptureService` methods (with mocked Supabase)
- `MatchingService.findMatches()`

### 2. Integration Tests (`tests/integration/`)
**Purpose**: Test API routes end-to-end with mocked external dependencies.

**Scope**:
- All API route handlers (`app/api/**/route.ts`)
- Request/response handling
- Error handling
- Authentication/authorization (if applicable)

**API Endpoints to Test**:
- ✅ `POST /api/analyze/[listingId]` - Analyze a listing
- ✅ `POST /api/capture/trigger` - Trigger capture job
- ✅ `POST /api/capture/enrich` - Trigger listing enrichment
- ✅ `GET /api/capture/status/[jobId]` - Get capture status
- ✅ `POST /api/discover/notify` - Process notifications
- ✅ `GET /api/ebay/marketplace-account-deletion-notification` - Webhook verification
- ✅ `POST /api/ebay/marketplace-account-deletion-notification` - Webhook handler (already tested)
- ✅ `GET /api/listings/[id]` - Get listing details
- ✅ `GET /api/listings/search` - Search listings
- ✅ `GET /api/dev/aggregate` - Dev aggregation endpoint
- ✅ `POST /api/dev/seed` - Dev seed endpoint

### 3. Frontend Tests (`tests/unit/app/` or `tests/integration/app/`)
**Purpose**: Test React components and pages.

**Scope**:
- Page components (`app/**/page.tsx`)
- Shared components (`app/**/components/*.tsx`)
- Client-side logic
- User interactions

**Frontend Pages/Components to Test**:
- `app/page.tsx` - Home page
- `app/dev/components/DevNav.tsx` - Navigation component
- `app/dev/listings/page.tsx` - Listings page
- `app/dev/analysis/page.tsx` - Analysis page
- `app/dev/capture/page.tsx` - Capture page
- `app/dev/aggregate/page.tsx` - Aggregate page
- `app/dev/seed/page.tsx` - Seed page

**Note**: Frontend tests can be organized under `tests/unit/app/` for component tests or `tests/integration/app/` if testing with Next.js routing.

### 4. E2E Tests (`tests/e2e/`) - Optional
**Purpose**: Test complete user workflows (future enhancement).

**Scope**:
- Full pipeline workflows
- Cross-service interactions
- Real database interactions (test database)

## Best Practices

### 1. Test File Naming
- Use `.test.ts` or `.test.tsx` suffix
- Mirror source file structure for easy navigation
- Example: `app/api/listings/[id]/route.ts` → `tests/integration/api/listings/[id].test.ts`

### 2. Test Organization
- Group related tests using `describe` blocks
- Use descriptive test names: `it('should return 404 when listing does not exist')`
- Follow AAA pattern: Arrange, Act, Assert

### 3. Mocking Strategy
- **Unit tests**: Mock all external dependencies (Supabase, APIs, etc.)
- **Integration tests**: Mock external services (eBay API, Resend) but use real Supabase client (mocked at DB level)
- **E2E tests**: Use test database, mock only external APIs

### 4. Shared Utilities
- Create reusable mocks in `tests/helpers/mocks/`
- Create test fixtures in `tests/unit/fixtures/`
- Create helper functions in `tests/helpers/test-utils.ts`

### 5. Vitest Configuration
- Update `vitest.config.ts` to:
  - Point to `tests/setup.ts` (already done)
  - Configure test environments (node for API, jsdom for React)
  - Set up path aliases matching `tsconfig.json`

## Migration Steps

### Step 1: Create New Directory Structure
1. Create all directories in `tests/` as outlined above
2. Keep `tests/setup.ts` in place (already correct)

### Step 2: Move Existing Tests
1. **Unit tests** from `__tests__/`:
   - `__tests__/analyze/text-extractor.test.ts` → `tests/unit/lib/analyze/text-extractor.test.ts`
   - `__tests__/analyze/value-evaluator.test.ts` → `tests/unit/lib/analyze/value-evaluator.test.ts`

2. **Integration test** from `__tests__/`:
   - `__tests__/ebay/marketplace-account-deletion-notification.test.ts` → `tests/integration/api/ebay/marketplace-account-deletion-notification.test.ts`

### Step 3: Update Imports
1. Update import paths in moved test files to reflect new locations
2. Update any relative imports that may have broken

### Step 4: Update Vitest Config
1. Ensure `vitest.config.ts` correctly references `tests/setup.ts`
2. Add environment configurations for different test types if needed
3. Configure test file patterns if necessary

### Step 5: Create Test Helpers
1. Create `tests/helpers/mocks/supabase.ts` for reusable Supabase mocks
2. Create `tests/helpers/mocks/next-request.ts` for NextRequest helpers
3. Create `tests/unit/fixtures/` with sample data

### Step 6: Clean Up Test Fixtures in Git
1. Add test fixtures to `.gitignore`:
   - Open `.gitignore` and add `tests/**/fixtures/` to the testing section (under `# testing`)
   - This allows fixtures to be created, modified, and destroyed without git tracking them
   - Example addition to `.gitignore`:
     ```
     # testing
     /coverage
     tests/**/fixtures/
     ```
2. Remove any existing test fixture files from git tracking (if they exist):
   ```bash
   git rm -r --cached tests/**/fixtures/ 2>/dev/null || true
   ```
3. Commit the `.gitignore` update (fixtures will be ignored going forward)

### Step 7: Remove Old Directory
1. Delete `__tests__/` directory after confirming all tests pass

### Step 8: Create Missing Tests
1. Create integration tests for all API endpoints (see list above)
2. Create unit tests for remaining service classes
3. Create frontend component/page tests

## Testing Checklist

### API Endpoints (Integration Tests)
- [ ] `POST /api/analyze/[listingId]`
- [ ] `POST /api/capture/trigger`
- [ ] `POST /api/capture/enrich`
- [ ] `GET /api/capture/status/[jobId]`
- [ ] `POST /api/discover/notify`
- [ ] `GET /api/ebay/marketplace-account-deletion-notification`
- [x] `POST /api/ebay/marketplace-account-deletion-notification` (already exists)
- [ ] `GET /api/listings/[id]`
- [ ] `GET /api/listings/search`
- [ ] `GET /api/dev/aggregate`
- [ ] `POST /api/dev/seed`

### Library Functions (Unit Tests)
- [x] `TextExtractor` (already exists)
- [x] `ValueEvaluator` (already exists)
- [ ] `AnalysisService`
- [ ] `CaptureService`
- [ ] `DeduplicationService`
- [ ] `EbayAdapter`
- [ ] `MockAdapter`
- [ ] `MatchingService`
- [ ] `EmailService`
- [ ] `NotificationService`
- [ ] `NotificationVerifier`

### Frontend Components (Component Tests)
- [ ] `app/page.tsx`
- [ ] `app/dev/components/DevNav.tsx`
- [ ] `app/dev/listings/page.tsx`
- [ ] `app/dev/analysis/page.tsx`
- [ ] `app/dev/capture/page.tsx`
- [ ] `app/dev/aggregate/page.tsx`
- [ ] `app/dev/seed/page.tsx`

## Benefits of This Structure

1. **Single Source of Truth**: One `tests/` directory eliminates confusion
2. **Clear Separation**: Unit vs. integration vs. e2e tests are clearly separated
3. **Easy Navigation**: Test structure mirrors source structure
4. **Scalability**: Easy to add new tests in the right place
5. **Maintainability**: Shared utilities and fixtures are organized
6. **Best Practices**: Follows Next.js and Vitest conventions

## Current CI/CD Status

- ✅ **GitHub Actions workflow exists**: `.github/workflows/test.yml` is already configured to run tests on push and pull requests
- ✅ **Test script configured**: `npm test` runs Vitest
- ✅ **Test UI available**: `npm run test:ui` for interactive test interface
- ✅ **Coverage script available**: `npm run test:coverage` for coverage reports

## Next Steps After Migration

1. Set up test coverage reporting (script already exists, needs configuration)
2. Add pre-commit hooks to run tests
3. ✅ CI/CD already configured (tests run automatically on push/PR)
4. Add E2E tests for critical workflows
5. Set up visual regression testing for frontend (optional)

