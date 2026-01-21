-- Create RBAC (Role-Based Access Control) schema
-- This migration creates tables for groups, roles, permissions, and their relationships

-- Create enum for permissions (type-safe permission names)
CREATE TYPE app_permission AS ENUM (
  'backend.access',
  'backend.manage',
  'users.read',
  'users.write'
);

-- Create groups table (organizational units)
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create roles table (role definitions)
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create permissions table (permission definitions)
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name app_permission NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create role_permissions table (many-to-many: roles have permissions)
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Create group_members table (users belong to groups with assigned roles)
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_group_members_user_group ON public.group_members(user_id, group_id);
CREATE INDEX idx_group_members_group_role ON public.group_members(group_id, role_id);
CREATE INDEX idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX idx_role_permissions_role_permission ON public.role_permissions(role_id, permission_id);

-- Enable Row Level Security
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groups (users can read all groups, only service role can modify)
CREATE POLICY "Users can read all groups"
  ON public.groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only service role can modify groups"
  ON public.groups FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for roles (users can read all roles, only service role can modify)
CREATE POLICY "Users can read all roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only service role can modify roles"
  ON public.roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for permissions (users can read all permissions, only service role can modify)
CREATE POLICY "Users can read all permissions"
  ON public.permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only service role can modify permissions"
  ON public.permissions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for role_permissions (users can read all, only service role can modify)
CREATE POLICY "Users can read all role_permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only service role can modify role_permissions"
  ON public.role_permissions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for group_members (users can read their own memberships, only service role can modify)
CREATE POLICY "Users can read their own group memberships"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Only service role can modify group_members"
  ON public.group_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp for groups
CREATE OR REPLACE FUNCTION public.update_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_groups_updated_at();
