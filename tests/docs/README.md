# Test Suite Documentation

This document outlines how to maintain and extend the test suite for this repository.

## Test Organization Structure

The test suite is organized into clear categories that mirror the source code structure:

```
tests/
├── setup.ts                    # Global test setup (runs before all tests)
├── unit/                       # Unit tests for pure functions/classes
│   └── lib/                    # Mirrors lib/ directory structure
│       ├── analyze/
│       ├── capture/
│       ├── discover/
│       └── ebay/
│   └── fixtures/               # Test fixtures (gitignored)
├── integration/                # Integration tests for API routes
│   └── api/                    # Mirrors app/api/ directory structure
│       ├── analyze/
│       ├── capture/
│       ├── discover/
│       ├── ebay/
│       ├── listings/
│       └── dev/
├── e2e/                        # End-to-end tests (optional, for future)
│   └── workflows/
├── helpers/                    # Shared test utilities
│   ├── mocks/                  # Reusable mock implementations
│   └── test-utils.ts           # General test utilities
└── docs/                       # Test documentation (this directory)
```

## Test Categories

### Unit Tests (`tests/unit/`)

**Purpose**: Test individual functions, classes, and modules in isolation.

**When to use**: 
- Pure functions (text extraction, value evaluation)
- Service classes with mocked dependencies
- Adapter implementations
- Utility functions

**Example locations**:
- `tests/unit/lib/analyze/text-extractor.test.ts` - Tests text extraction logic
- `tests/unit/lib/analyze/value-evaluator.test.ts` - Tests value evaluation logic
- `tests/unit/lib/capture/capture-service.test.ts` - Tests capture service (with mocked Supabase)

**Best practices**:
- Mock all external dependencies (Supabase, APIs, etc.)
- Test one thing at a time
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert

### Integration Tests (`tests/integration/`)

**Purpose**: Test API routes end-to-end with mocked external dependencies.

**When to use**:
- API route handlers (`app/api/**/route.ts`)
- Request/response handling
- Error handling
- Authentication/authorization flows

**Example locations**:
- `tests/integration/api/ebay/marketplace-account-deletion-notification.test.ts` - Tests webhook endpoint
- `tests/integration/api/listings/[id].test.ts` - Tests listing detail endpoint
- `tests/integration/api/capture/trigger.test.ts` - Tests capture trigger endpoint

**Best practices**:
- Mock external services (eBay API, Resend) but use real Supabase client (mocked at DB level)
- Test happy paths and error cases
- Verify HTTP status codes and response shapes
- Test edge cases (missing params, invalid data, etc.)

### E2E Tests (`tests/e2e/`) - Optional

**Purpose**: Test complete user workflows (future enhancement).

**When to use**:
- Full pipeline workflows
- Cross-service interactions
- Real database interactions (test database)

**Note**: E2E tests are not yet implemented but the structure is in place for future use.

## Adding New Tests

### Adding a Unit Test

1. **Identify the location**: Match the source file structure
   - Source: `lib/analyze/analysis-service.ts`
   - Test: `tests/unit/lib/analyze/analysis-service.test.ts`

2. **Create the test file**:
   ```typescript
   import { describe, it, expect, vi } from 'vitest';
   import { AnalysisService } from '@/lib/analyze/analysis-service';

   describe('AnalysisService', () => {
     // Your tests here
   });
   ```

3. **Use test helpers** (see [Test Helpers](#test-helpers) section):
   ```typescript
   import { createMockSupabaseClient } from '@/tests/helpers/mocks/supabase';
   ```

### Adding an Integration Test

1. **Identify the location**: Match the API route structure
   - Source: `app/api/listings/[id]/route.ts`
   - Test: `tests/integration/api/listings/[id].test.ts`

2. **Create the test file**:
   ```typescript
   import { describe, it, expect, vi } from 'vitest';
   import { NextRequest } from 'next/server';
   import { GET } from '@/app/api/listings/[id]/route';
   import { createTestRequest } from '@/tests/helpers/mocks/next-request';

   describe('GET /api/listings/[id]', () => {
     it('should return listing details', async () => {
       const request = createTestRequest('https://example.com/api/listings/123');
       const response = await GET(request, { params: Promise.resolve({ id: '123' }) });
       expect(response.status).toBe(200);
     });
   });
   ```

3. **Mock external dependencies**:
   ```typescript
   vi.mock('@/lib/supabase/client', () => ({
     supabase: createMockSupabaseClient(),
   }));
   ```

## Test Helpers

### Mock Utilities (`tests/helpers/mocks/`)

#### `supabase.ts`
Provides reusable Supabase client mocks:
```typescript
import { createMockSupabaseClient } from '@/tests/helpers/mocks/supabase';

const mockSupabase = createMockSupabaseClient();
// Override methods as needed in your test
```

#### `next-request.ts`
Helper for creating NextRequest objects:
```typescript
import { createTestRequest } from '@/tests/helpers/mocks/next-request';

const request = createTestRequest('https://example.com/api/endpoint', {
  method: 'POST',
  headers: { 'authorization': 'Bearer token' },
  body: { key: 'value' },
});
```

#### `marketplace-adapters.ts`
Mock marketplace adapters:
```typescript
import { createMockMarketplaceAdapter } from '@/tests/helpers/mocks/marketplace-adapters';

const mockAdapter = createMockMarketplaceAdapter();
```

### General Utilities (`tests/helpers/test-utils.ts`)

```typescript
import { sleep, createTestDate } from '@/tests/helpers/test-utils';

// Wait for async operations
await sleep(100);

// Create consistent test dates
const testDate = createTestDate(0); // 2025-01-01
const futureDate = createTestDate(7); // 2025-01-08
```

## Test Fixtures

Test fixtures are stored in `tests/unit/fixtures/` and are **gitignored**. This allows you to:
- Create sample data files
- Store mock API responses
- Generate test data dynamically

**Important**: Fixtures are not tracked in git, so they can be created, modified, and destroyed without affecting version control.

Example fixture structure:
```
tests/unit/fixtures/
├── listings.ts          # Sample listing data
├── analysis.ts          # Sample analysis data
└── supabase.ts          # Sample Supabase responses
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test
# (vitest runs in watch mode by default)
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test files
```bash
npm test tests/unit/lib/analyze/text-extractor.test.ts
```

### Run tests matching a pattern
```bash
npm test -- --grep "text extractor"
```

## Test File Naming Conventions

- Use `.test.ts` suffix for test files
- Mirror source file structure for easy navigation
- Example: `app/api/listings/[id]/route.ts` → `tests/integration/api/listings/[id].test.ts`

## Writing Good Tests

### Structure
```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = component.method(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Test Names
- Use descriptive names that explain what is being tested
- Start with "should" when possible
- Example: `it('should return 404 when listing does not exist')`

### Mocking Strategy
- **Unit tests**: Mock all external dependencies
- **Integration tests**: Mock external services (APIs, email) but use real Supabase client (mocked at DB level)
- **E2E tests**: Use test database, mock only external APIs

### Best Practices
1. **One assertion per test** (when possible)
2. **Test edge cases**: null, undefined, empty strings, invalid input
3. **Test error handling**: What happens when things go wrong?
4. **Keep tests independent**: Each test should be able to run in isolation
5. **Use descriptive variable names**: `const expectedListingId = '123'` not `const x = '123'`

## Common Patterns

### Testing API Routes
```typescript
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/endpoint/route';
import { createTestRequest } from '@/tests/helpers/mocks/next-request';

describe('POST /api/endpoint', () => {
  it('should handle valid request', async () => {
    const request = createTestRequest('https://example.com/api/endpoint', {
      method: 'POST',
      body: { key: 'value' },
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toMatchObject({ success: true });
  });
  
  it('should return 400 for invalid request', async () => {
    const request = createTestRequest('https://example.com/api/endpoint', {
      method: 'POST',
      body: {}, // Missing required fields
    });
    
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

### Testing Services with Supabase
```typescript
import { vi } from 'vitest';
import { CaptureService } from '@/lib/capture/capture-service';

vi.mock('@/lib/supabase/client', () => {
  const mockInsert = vi.fn().mockResolvedValue({ data: [], error: null });
  return {
    supabase: {
      from: vi.fn(() => ({
        insert: mockInsert,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      })),
    },
  };
});

describe('CaptureService', () => {
  it('should capture listings', async () => {
    const service = new CaptureService(supabase);
    // Test implementation
  });
});
```

### Testing with Dynamic Route Parameters
```typescript
describe('GET /api/listings/[id]', () => {
  it('should return listing by id', async () => {
    const request = new NextRequest('https://example.com/api/listings/123');
    const context = {
      params: Promise.resolve({ id: '123' }),
    };
    
    const response = await GET(request, context);
    expect(response.status).toBe(200);
  });
});
```

## Checklist for New Tests

When adding a new test file, ensure:

- [ ] Test file is in the correct location (unit vs integration)
- [ ] Test file name follows convention (`*.test.ts`)
- [ ] Test file mirrors source structure
- [ ] Imports use `@/` alias (configured in `vitest.config.ts`)
- [ ] External dependencies are properly mocked
- [ ] Test covers happy path and error cases
- [ ] Test names are descriptive
- [ ] Test follows AAA pattern (Arrange, Act, Assert)
- [ ] Test is independent (can run in isolation)

## Troubleshooting

### Tests not found
- Check that test file has `.test.ts` extension
- Verify file is not in `__tests__/` (old location, now excluded)
- Check `vitest.config.ts` exclude patterns

### Import errors
- Ensure imports use `@/` alias
- Check `vitest.config.ts` has correct alias configuration
- Verify path aliases match `tsconfig.json`

### Mock not working
- Ensure mocks are set up before imports
- Use `vi.hoisted()` for mocks referenced in `vi.mock()` factories
- Check mock is properly typed

### Environment variables
- Test environment variables are loaded from `.env.test` (see `tests/setup.ts`)
- Ensure required env vars are set for integration tests

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Documentation](https://testing-library.com/)
- [Next.js Testing Guide](https://nextjs.org/docs/app/building-your-application/testing)

## Questions?

If you're unsure where to place a test or how to structure it:
1. Look at existing tests in the same category (unit/integration)
2. Follow the pattern of similar tests
3. Refer to this documentation
4. Ask the team for guidance

