import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasPermission, getUserGroups, getUserPermissions } from '@/lib/auth/auth-helpers';
import { supabaseServer } from '@/lib/supabase/server';

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    rpc: vi.fn(),
  },
}));

describe('Auth Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Permission-based access', () => {
    it('should allow access when user has backend.access permission', async () => {
      vi.mocked(supabaseServer.rpc).mockResolvedValue({
        data: true,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      const hasAccess = await hasPermission('user-id', 'backend.access');
      expect(hasAccess).toBe(true);
    });

    it('should deny access when user does not have backend.access permission', async () => {
      vi.mocked(supabaseServer.rpc).mockResolvedValue({
        data: false,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      const hasAccess = await hasPermission('user-id', 'backend.access');
      expect(hasAccess).toBe(false);
    });
  });

  describe('Group membership and role assignment', () => {
    it('should return user groups with roles', async () => {
      const mockGroups = [
        {
          group_id: 'group-1',
          group_name: 'Administrators',
          role_id: 'role-1',
          role_name: 'admin',
        },
        {
          group_id: 'group-2',
          group_name: 'Engineering',
          role_id: 'role-2',
          role_name: 'viewer',
        },
      ];

      vi.mocked(supabaseServer.rpc).mockResolvedValue({
        data: mockGroups,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      const groups = await getUserGroups('user-id');
      expect(groups).toHaveLength(2);
      expect(groups[0].group_name).toBe('Administrators');
      expect(groups[0].role_name).toBe('admin');
    });
  });

  describe('Permission inheritance from roles', () => {
    it('should return all permissions from all user roles', async () => {
      const mockPermissions = [
        { permission_name: 'backend.access' as const },
        { permission_name: 'backend.manage' as const },
        { permission_name: 'users.read' as const },
      ];

      vi.mocked(supabaseServer.rpc).mockResolvedValue({
        data: mockPermissions,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      const permissions = await getUserPermissions('user-id');
      expect(permissions).toContain('backend.access');
      expect(permissions).toContain('backend.manage');
      expect(permissions).toContain('users.read');
    });
  });

  describe('Multiple groups with different roles', () => {
    it('should aggregate permissions from multiple groups', async () => {
      // User in group 1 with admin role (has all permissions)
      // User in group 2 with viewer role (has read-only permissions)
      const mockPermissions = [
        { permission_name: 'backend.access' as const },
        { permission_name: 'backend.manage' as const },
        { permission_name: 'users.read' as const },
      ];

      vi.mocked(supabaseServer.rpc).mockResolvedValue({
        data: mockPermissions,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      const permissions = await getUserPermissions('user-id');
      // Should have permissions from both groups
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions).toContain('backend.access');
    });
  });
});
