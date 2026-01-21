import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    rpc: vi.fn(),
  },
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
  })),
}));

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('should allow public routes', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'));
    const response = await middleware(request);
    
    expect(response.status).toBe(200);
  });

  it('should redirect unauthenticated users from /backend', async () => {
    const { createServerClient } = await import('@supabase/ssr');
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' },
        }),
      },
    } as any);

    const request = new NextRequest(new URL('http://localhost:3000/backend'));
    const response = await middleware(request);
    
    expect(response.status).toBe(307); // Redirect
    expect(response.headers.get('location')).toContain('/auth/signin');
  });

  it('should redirect users without backend.access permission', async () => {
    const { createServerClient } = await import('@supabase/ssr');
    const { supabaseServer } = await import('@/lib/supabase/server');
    
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-id' } },
          error: null,
        }),
      },
    } as any);

    vi.mocked(supabaseServer.rpc).mockResolvedValue({
      data: false, // No permission
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as any);

    const request = new NextRequest(new URL('http://localhost:3000/backend'));
    const response = await middleware(request);
    
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/auth/signin');
    expect(response.headers.get('location')).toContain('error=permission_denied');
  });

  it('should allow users with backend.access permission', async () => {
    const { createServerClient } = await import('@supabase/ssr');
    const { supabaseServer } = await import('@/lib/supabase/server');
    
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-id' } },
          error: null,
        }),
      },
    } as any);

    vi.mocked(supabaseServer.rpc).mockResolvedValue({
      data: true, // Has permission
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as any);

    const request = new NextRequest(new URL('http://localhost:3000/backend'));
    const response = await middleware(request);
    
    expect(response.status).toBe(200);
  });
});
