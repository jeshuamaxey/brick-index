import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServerSession, requireAuth, hasPermission, requirePermission, getUserGroups, getUserPermissions } from '@/lib/auth/auth-helpers';
import { supabaseServer } from '@/lib/supabase/server';

// Mock the supabase server
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    rpc: vi.fn(),
  },
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    getAll: vi.fn(() => []),
  })),
}));

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
  })),
}));

describe('auth-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variables for tests
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  describe('getServerSession', () => {
    it('should return null when Supabase is not configured', async () => {
      const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      const session = await getServerSession();
      expect(session).toBeNull();

      process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
    });

    it('should return null when user is not authenticated', async () => {
      const { createServerClient } = await import('@supabase/ssr');
      vi.mocked(createServerClient).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Not authenticated' },
          }),
        },
      } as any);

      const session = await getServerSession();
      expect(session).toBeNull();
    });
  });

  describe('requireAuth', () => {
    it('should throw error when not authenticated', async () => {
      vi.spyOn(await import('@/lib/auth/auth-helpers'), 'getServerSession').mockResolvedValue(null);

      await expect(requireAuth()).rejects.toThrow('Authentication required');
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has permission', async () => {
      vi.mocked(supabaseServer.rpc).mockResolvedValue({ 
        data: true, 
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      const result = await hasPermission('user-id', 'backend.access');
      expect(result).toBe(true);
      expect(supabaseServer.rpc).toHaveBeenCalledWith('user_has_permission', {
        p_user_id: 'user-id',
        p_permission_name: 'backend.access',
      });
    });

    it('should return false when user does not have permission', async () => {
      vi.mocked(supabaseServer.rpc).mockResolvedValue({ 
        data: false, 
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      const result = await hasPermission('user-id', 'backend.access');
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      vi.mocked(supabaseServer.rpc).mockResolvedValue({
        data: null,
        error: { 
          message: 'Database error',
          details: '',
          hint: '',
          code: 'P0001',
          name: 'PostgrestError',
        } as any,
        count: null,
        status: 500,
        statusText: 'Internal Server Error',
      } as any);

      const result = await hasPermission('user-id', 'backend.access');
      expect(result).toBe(false);
    });
  });

  describe('requirePermission', () => {
    it('should throw error when user does not have permission', async () => {
      // Mock getServerSession to return a valid session
      const { createServerClient } = await import('@supabase/ssr');
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { 
              user: { 
                id: 'user-id',
                email: 'test@example.com',
                app_metadata: {},
                user_metadata: {},
                aud: 'authenticated',
                created_at: new Date().toISOString(),
              } 
            },
            error: null,
          }),
        },
      };
      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);
      
      // Mock hasPermission to return false
      vi.mocked(supabaseServer.rpc).mockResolvedValue({
        data: false,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      await expect(requirePermission('backend.access')).rejects.toThrow(
        'Permission required: backend.access'
      );
    });
  });

  describe('getUserGroups', () => {
    it('should return user groups', async () => {
      const mockGroups = [
        { group_id: 'group-1', group_name: 'Administrators', role_id: 'role-1', role_name: 'admin' },
      ];
      vi.mocked(supabaseServer.rpc).mockResolvedValue({ 
        data: mockGroups, 
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      const groups = await getUserGroups('user-id');
      expect(groups).toEqual(mockGroups);
      expect(supabaseServer.rpc).toHaveBeenCalledWith('user_groups', {
        p_user_id: 'user-id',
      });
    });

    it('should return empty array on error', async () => {
      vi.mocked(supabaseServer.rpc).mockResolvedValue({
        data: null,
        error: { 
          message: 'Database error',
          details: '',
          hint: '',
          code: 'P0001',
          name: 'PostgrestError',
        } as any,
        count: null,
        status: 500,
        statusText: 'Internal Server Error',
      } as any);

      const groups = await getUserGroups('user-id');
      expect(groups).toEqual([]);
    });
  });

  describe('getUserPermissions', () => {
    it('should return user permissions', async () => {
      const mockPermissions = [
        { permission_name: 'backend.access' },
        { permission_name: 'backend.manage' },
      ];
      vi.mocked(supabaseServer.rpc).mockResolvedValue({ 
        data: mockPermissions, 
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      const permissions = await getUserPermissions('user-id');
      expect(permissions).toEqual(['backend.access', 'backend.manage']);
      expect(supabaseServer.rpc).toHaveBeenCalledWith('user_permissions', {
        p_user_id: 'user-id',
      });
    });

    it('should return empty array on error', async () => {
      vi.mocked(supabaseServer.rpc).mockResolvedValue({
        data: null,
        error: { 
          message: 'Database error',
          details: '',
          hint: '',
          code: 'P0001',
          name: 'PostgrestError',
        } as any,
        count: null,
        status: 500,
        statusText: 'Internal Server Error',
      } as any);

      const permissions = await getUserPermissions('user-id');
      expect(permissions).toEqual([]);
    });
  });
});
