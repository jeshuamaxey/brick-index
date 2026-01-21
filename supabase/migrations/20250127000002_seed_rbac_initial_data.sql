-- Seed initial RBAC data
-- This migration creates default permissions, roles, and an administrators group

-- Insert default permissions
INSERT INTO public.permissions (name, description) VALUES
  ('backend.access', 'Access to backend pages and functionality'),
  ('backend.manage', 'Full management access to backend (create, update, delete)'),
  ('users.read', 'Read access to user information'),
  ('users.write', 'Write access to user information (create, update, delete)')
ON CONFLICT (name) DO NOTHING;

-- Insert default roles
INSERT INTO public.roles (name, description) VALUES
  ('admin', 'Administrator with full access'),
  ('manager', 'Manager with read and write access'),
  ('viewer', 'Viewer with read-only access')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to admin role (all permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to manager role (backend access and user read/write)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'manager'
  AND p.name IN ('backend.access', 'users.read', 'users.write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to viewer role (backend access and user read only)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'viewer'
  AND p.name IN ('backend.access', 'users.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Create default administrators group
INSERT INTO public.groups (name, description) VALUES
  ('Administrators', 'Default group for system administrators')
ON CONFLICT (name) DO NOTHING;
