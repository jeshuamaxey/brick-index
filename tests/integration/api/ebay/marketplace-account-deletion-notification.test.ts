import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Supabase server client to avoid real DB calls
// Use vi.hoisted() to define mocks that are referenced in vi.mock() factories
const { mockInsert } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  return { mockInsert };
});

vi.mock('@/lib/supabase/server', () => {
  const mockFrom = vi.fn(() => ({
    insert: mockInsert,
  }));
  return {
    supabaseServer: {
      from: mockFrom,
    },
  };
});

// Mock custom verifier to simulate successful verification (204)
vi.mock('@/lib/ebay/notification-verifier', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/ebay/notification-verifier')
  >('@/lib/ebay/notification-verifier');

  return {
    ...actual,
    processEbayNotification: vi.fn().mockResolvedValue(204),
  };
});

// Import route handler AFTER env vars and mocks are set up
import { POST } from '@/app/api/ebay/marketplace-account-deletion-notification/route';

describe('POST /api/ebay/marketplace-account-deletion-notification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default successful insert
    mockInsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 202 and persists notification on happy path', async () => {
    const body = {
      metadata: {
        topic: 'MARKETPLACE_ACCOUNT_DELETION',
        schemaVersion: '1.0',
      },
      notification: {
        notificationId: 'test-notification-id',
        eventDate: '2025-01-01T00:00:00Z',
        publishDate: '2025-01-01T00:00:01Z',
        publishAttemptCount: 1,
        data: {
          username: 'test_user',
          userId: 'user123',
          eiasToken: 'token123',
        },
      },
    };

    const request = new NextRequest('https://example.com/api/ebay/marketplace-account-deletion-notification', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ebay-signature': 'test-signature',
      },
      body: JSON.stringify(body),
    });

    const response = await POST(request);

    expect(response.status).toBe(202);

    const json = await response.text();
    expect(json).toBe('');
  });

  it('handles duplicate notification ID gracefully', async () => {
    // First call succeeds, second call fails with duplicate key error
    mockInsert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "ebay_marketplace_account_deletion_notifications_pkey"',
          details: 'Key (notification_id)=(duplicate-notification-id) already exists.',
          hint: null,
        },
      });

    const body = {
      metadata: {
        topic: 'MARKETPLACE_ACCOUNT_DELETION',
        schemaVersion: '1.0',
      },
      notification: {
        notificationId: 'duplicate-notification-id',
        eventDate: '2025-01-01T00:00:00Z',
        publishDate: '2025-01-01T00:00:01Z',
        publishAttemptCount: 1,
        data: {
          username: 'test_user',
          userId: 'user123',
          eiasToken: 'token123',
        },
      },
    };

    const request1 = new NextRequest('https://example.com/api/ebay/marketplace-account-deletion-notification', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ebay-signature': 'test-signature',
      },
      body: JSON.stringify(body),
    });

    const request2 = new NextRequest('https://example.com/api/ebay/marketplace-account-deletion-notification', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ebay-signature': 'test-signature',
      },
      body: JSON.stringify(body),
    });

    // First request should succeed
    const response1 = await POST(request1);
    expect(response1.status).toBe(202);

    // Second request should also return 202 (acknowledged) but log error
    const response2 = await POST(request2);
    expect(response2.status).toBe(202);

    // Verify both requests were attempted
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('returns 412 when signature header is missing', async () => {
    const body = {
      metadata: {
        topic: 'MARKETPLACE_ACCOUNT_DELETION',
        schemaVersion: '1.0',
      },
      notification: {
        notificationId: 'test-notification-id',
        eventDate: '2025-01-01T00:00:00Z',
        publishDate: '2025-01-01T00:00:01Z',
        publishAttemptCount: 1,
        data: {
          username: 'test_user',
          userId: 'user123',
          eiasToken: 'token123',
        },
      },
    };

    const request = new NextRequest('https://example.com/api/ebay/marketplace-account-deletion-notification', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // No x-ebay-signature header
      },
      body: JSON.stringify(body),
    });

    const response = await POST(request);

    expect(response.status).toBe(412);
    // Should not attempt to insert into Supabase
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 412 when signature header is empty', async () => {
    const body = {
      metadata: {
        topic: 'MARKETPLACE_ACCOUNT_DELETION',
        schemaVersion: '1.0',
      },
      notification: {
        notificationId: 'test-notification-id',
        eventDate: '2025-01-01T00:00:00Z',
        publishDate: '2025-01-01T00:00:01Z',
        publishAttemptCount: 1,
        data: {
          username: 'test_user',
          userId: 'user123',
          eiasToken: 'token123',
        },
      },
    };

    const request = new NextRequest('https://example.com/api/ebay/marketplace-account-deletion-notification', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ebay-signature': '', // Empty signature
      },
      body: JSON.stringify(body),
    });

    const response = await POST(request);

    expect(response.status).toBe(412);
    // Should not attempt to insert into Supabase
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 202 when payload is empty', async () => {
    const request = new NextRequest('https://example.com/api/ebay/marketplace-account-deletion-notification', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ebay-signature': 'test-signature',
      },
      body: '', // Empty body
    });

    const response = await POST(request);

    expect(response.status).toBe(202);
    // Should not attempt to insert into Supabase
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 202 when payload is invalid JSON', async () => {
    const request = new NextRequest('https://example.com/api/ebay/marketplace-account-deletion-notification', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ebay-signature': 'test-signature',
      },
      body: 'invalid json {', // Invalid JSON
    });

    const response = await POST(request);

    expect(response.status).toBe(202);
    // Should not attempt to insert into Supabase
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 202 when notificationId is missing', async () => {
    const body = {
      metadata: {
        topic: 'MARKETPLACE_ACCOUNT_DELETION',
        schemaVersion: '1.0',
      },
      notification: {
        // Missing notificationId
        eventDate: '2025-01-01T00:00:00Z',
        publishDate: '2025-01-01T00:00:01Z',
        publishAttemptCount: 1,
        data: {
          username: 'test_user',
          userId: 'user123',
          eiasToken: 'token123',
        },
      },
    };

    const request = new NextRequest('https://example.com/api/ebay/marketplace-account-deletion-notification', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ebay-signature': 'test-signature',
      },
      body: JSON.stringify(body),
    });

    const response = await POST(request);

    expect(response.status).toBe(202);
    // Should not attempt to insert into Supabase (PK would fail)
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 500 when SDK configuration is missing', async () => {
    // Temporarily remove required env vars
    const originalAppId = process.env.EBAY_APP_ID;
    const originalClientSecret = process.env.EBAY_CLIENT_SECRET;
    const originalCallbackUrl = process.env.EBAY_MARKETPLACE_DELETION_CALLBACK_URL;
    const originalVerificationToken = process.env.EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN;

    delete process.env.EBAY_APP_ID;
    delete process.env.EBAY_CLIENT_SECRET;
    delete process.env.EBAY_MARKETPLACE_DELETION_CALLBACK_URL;
    delete process.env.EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN;

    // Reset modules to force re-reading env vars
    vi.resetModules();
    const { POST: POSTHandler } = await import('@/app/api/ebay/marketplace-account-deletion-notification/route');

    const body = {
      metadata: {
        topic: 'MARKETPLACE_ACCOUNT_DELETION',
        schemaVersion: '1.0',
      },
      notification: {
        notificationId: 'test-notification-id',
        eventDate: '2025-01-01T00:00:00Z',
        publishDate: '2025-01-01T00:00:01Z',
        publishAttemptCount: 1,
        data: {
          username: 'test_user',
          userId: 'user123',
          eiasToken: 'token123',
        },
      },
    };

    const request = new NextRequest('https://example.com/api/ebay/marketplace-account-deletion-notification', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ebay-signature': 'test-signature',
      },
      body: JSON.stringify(body),
    });

    const response = await POSTHandler(request);

    expect(response.status).toBe(500);
    // Should not attempt to insert into Supabase
    expect(mockInsert).not.toHaveBeenCalled();

    // Restore env vars
    process.env.EBAY_APP_ID = originalAppId;
    process.env.EBAY_CLIENT_SECRET = originalClientSecret;
    process.env.EBAY_MARKETPLACE_DELETION_CALLBACK_URL = originalCallbackUrl;
    process.env.EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN = originalVerificationToken;
  });

  it('returns 500 when verifier throws unexpected error', async () => {
    const { processEbayNotification } = await import('@/lib/ebay/notification-verifier');
    vi.mocked(processEbayNotification).mockRejectedValueOnce(new Error('Unexpected verifier error'));

    // Reset modules to get fresh handler with mocked verifier
    vi.resetModules();
    const { POST: POSTHandler } = await import('@/app/api/ebay/marketplace-account-deletion-notification/route');

    const body = {
      metadata: {
        topic: 'MARKETPLACE_ACCOUNT_DELETION',
        schemaVersion: '1.0',
      },
      notification: {
        notificationId: 'test-notification-id',
        eventDate: '2025-01-01T00:00:00Z',
        publishDate: '2025-01-01T00:00:01Z',
        publishAttemptCount: 1,
        data: {
          username: 'test_user',
          userId: 'user123',
          eiasToken: 'token123',
        },
      },
    };

    const request = new NextRequest('https://example.com/api/ebay/marketplace-account-deletion-notification', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ebay-signature': 'test-signature',
      },
      body: JSON.stringify(body),
    });

    const response = await POSTHandler(request);

    expect(response.status).toBe(500);
    // Should not attempt to insert into Supabase
    expect(mockInsert).not.toHaveBeenCalled();
  });
});


