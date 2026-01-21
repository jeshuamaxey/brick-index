-- Create RBAC helper functions with SECURITY DEFINER
-- These functions allow efficient permission checking without exposing internal structure

-- Function to check if a user has a specific permission globally (across all groups)
CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id UUID,
  p_permission_name app_permission
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.role_permissions rp ON gm.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE gm.user_id = p_user_id
      AND p.name = p_permission_name
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to check if a user has a specific permission in a given group
CREATE OR REPLACE FUNCTION public.user_has_group_permission(
  p_group_id UUID,
  p_user_id UUID,
  p_permission_name app_permission
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.role_permissions rp ON gm.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE gm.group_id = p_group_id
      AND gm.user_id = p_user_id
      AND p.name = p_permission_name
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get all groups a user belongs to
CREATE OR REPLACE FUNCTION public.user_groups(p_user_id UUID)
RETURNS TABLE (
  group_id UUID,
  group_name TEXT,
  role_id UUID,
  role_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id AS group_id,
    g.name AS group_name,
    r.id AS role_id,
    r.name AS role_name
  FROM public.group_members gm
  JOIN public.groups g ON gm.group_id = g.id
  JOIN public.roles r ON gm.role_id = r.id
  WHERE gm.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get all permissions a user has (across all groups)
CREATE OR REPLACE FUNCTION public.user_permissions(p_user_id UUID)
RETURNS TABLE (
  permission_name app_permission
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.name
  FROM public.group_members gm
  JOIN public.role_permissions rp ON gm.role_id = rp.role_id
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE gm.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to check if a user belongs to a specific group
CREATE OR REPLACE FUNCTION public.is_user_in_group(
  p_user_id UUID,
  p_group_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = p_user_id
      AND group_id = p_group_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
