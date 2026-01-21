import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getStatus } from '@/app/api/auth/status/route';
import { POST as postSignOut } from '@/app/api/auth/signout/route';

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    rpc: vi.fn(),
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    getAll: vi.fn(() => []),
  })),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
  })),
}));

describe('API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  describe('GET /api/auth/status', () => {
    it('should return unauthenticated status when user is not logged in', async () => {
      const { createServerClient } = await import('@supabase/ssr');
      vi.mocked(createServerClient).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Not authenticated' },
          }),
        },
      } as any);

      const request = new NextRequest(new URL('http://localhost:3000/api/auth/status'));
      const response = await getStatus(request);
      const data = await response.json();

      expect(data.authenticated).toBe(false);
      expect(data.user).toBeNull();
      expect(data.groups).toEqual([]);
      expect(data.permissions).toEqual([]);
      expect(data.canAccessBackend).toBe(false);
    });

    it('should return authenticated status with groups and permissions', async () => {
      const { createServerClient } = await import('@supabase/ssr');
      const { supabaseServer } = await import('@/lib/supabase/server');

      vi.mocked(createServerClient).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-id', email: 'test@example.com' } },
            error: null,
          }),
        },
      } as any);

      (supabaseServer.rpc as any).mockImplementation((fnName: any, ...args: any[]) => {
        if (fnName === 'user_groups') {
          return Promise.resolve({
            data: [
              { group_id: 'group-1', group_name: 'Administrators', role_id: 'role-1', role_name: 'admin' },
            ],
            error: null,
            count: null,
            status: 200,
            statusText: 'OK',
          } as any);
        }
        if (fnName === 'user_permissions') {
          return Promise.resolve({
            data: [
              { permission_name: 'backend.access' as const },
              { permission_name: 'backend.manage' as const },
            ],
            error: null,
            count: null,
            status: 200,
            statusText: 'OK',
          } as any);
        }
        return Promise.resolve({ 
          data: null, 
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        } as any);
      });

      const request = new NextRequest(new URL('http://localhost:3000/api/auth/status'));
      const response = await getStatus(request);
      const data = await response.json();

      expect(data.authenticated).toBe(true);
      expect(data.user).toEqual({ id: 'user-id', email: 'test@example.com' });
      expect(data.groups).toHaveLength(1);
      expect(data.permissions).toContain('backend.access');
      expect(data.canAccessBackend).toBe(true);
    });
  });

  describe('POST /api/auth/signout', () => {
    it('should sign out successfully', async () => {
      const { createServerClient } = await import('@supabase/ssr');
      const mockSignOut = vi.fn().mockResolvedValue({ error: null });
      
      vi.mocked(createServerClient).mockReturnValue({
        auth: {
          signOut: mockSignOut,
        },
      } as any);

      const request = new NextRequest(new URL('http://localhost:3000/api/auth/signout'), {
        method: 'POST',
      });
      const response = await postSignOut(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
