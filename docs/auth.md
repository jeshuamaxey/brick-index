# Authentication and RBAC Documentation

This document describes the authentication and role-based access control (RBAC) implementation in the application.

## Overview

The application uses Supabase for authentication with a comprehensive RBAC system that supports:
- User authentication via email/password
- Groups (organizational units)
- Roles (named roles within groups)
- Permissions (granular actions)
- User-group-role assignments

## Architecture

### Database Schema

The RBAC system consists of the following tables:

- **`groups`**: Organizational groups/teams
- **`roles`**: Role definitions (e.g., admin, manager, viewer)
- **`permissions`**: Permission definitions (e.g., backend.access, backend.manage)
- **`role_permissions`**: Many-to-many relationship between roles and permissions
- **`group_members`**: Users belong to groups with assigned roles

### Permission Flow

1. User signs in with email/password
2. Middleware checks authentication for `/backend/*` routes
3. If authenticated, middleware checks for `backend.access` permission
4. Permission check queries user's groups → roles → permissions
5. Access granted if user has required permission

## Authentication

### Sign In

Users can sign in at `/auth/signin` with their email and password.

### Sign Up

New users can create accounts at `/auth/signup`. After signup, they need to be assigned to groups with roles to access protected resources.

### Sign Out

Users can sign out via the user menu in the backend interface or by calling the `/api/auth/signout` endpoint.

## RBAC System

### Permissions

Available permissions:
- `backend.access`: Access to backend pages and functionality
- `backend.manage`: Full management access to backend (create, update, delete)
- `users.read`: Read access to user information
- `users.write`: Write access to user information

### Roles

Default roles:
- **admin**: Administrator with full access (all permissions)
- **manager**: Manager with read and write access (backend.access, users.read, users.write)
- **viewer**: Viewer with read-only access (backend.access, users.read)

### Groups

Default group:
- **Administrators**: Default group for system administrators

## Route Protection

### Backend Routes

All routes under `/backend/*` require:
1. User authentication
2. `backend.access` permission

The middleware automatically redirects unauthenticated or unauthorized users to `/auth/signin`.

### Server-Side Checks

Backend layouts and API routes use server-side permission checks:

```typescript
import { requirePermission } from '@/lib/auth/auth-helpers';

// In a server component or API route
await requirePermission('backend.access');
```

## Helper Functions

### Server-Side Auth Helpers

Located in `lib/auth/auth-helpers.ts`:

- `getServerSession()`: Get authenticated user from server
- `requireAuth()`: Require authentication, throw if not
- `hasPermission(userId, permission)`: Check if user has a specific permission
- `requirePermission(permission)`: Require specific permission, throw if not
- `getUserGroups(userId)`: Get all groups user belongs to
- `getUserPermissions(userId)`: Get all permissions user has
- `isUserInGroup(userId, groupId)`: Check if user belongs to a group

### Database Helper Functions

Located in database migrations, these functions use SECURITY DEFINER for efficient permission checking:

- `user_has_permission(user_id, permission_name)`: Check global permission
- `user_has_group_permission(group_id, user_id, permission_name)`: Check group-specific permission
- `user_groups(user_id)`: Get user's groups with roles
- `user_permissions(user_id)`: Get all user permissions

## Managing Users and Permissions

### Creating an Admin User

Use the helper script:

```bash
tsx scripts/create-admin-user.ts admin@example.com secure-password-123
```

This script:
1. Creates a user account
2. Creates a profile
3. Assigns the user to the "Administrators" group with the "admin" role

### Assigning Users to Groups

Use the helper script:

```bash
tsx scripts/assign-user-to-group.ts user@example.com Administrators admin
```

Or manually via SQL:

```sql
INSERT INTO group_members (group_id, user_id, role_id)
VALUES (
  (SELECT id FROM groups WHERE name = 'Administrators'),
  '<user-id>',
  (SELECT id FROM roles WHERE name = 'admin')
);
```

### Adding New Permissions

1. Add permission to the `app_permission` enum in a migration
2. Insert the permission into the `permissions` table
3. Assign permissions to roles via `role_permissions` table

### Adding New Roles

1. Insert role into the `roles` table
2. Assign permissions to the role via `role_permissions` table

## Email Templates

Email templates are located in `supabase/templates/` and configured in `supabase/config.toml`:

- `confirmation.html`: Email confirmation for new signups
- `recovery.html`: Password reset email
- `invite.html`: User invitation email
- `email_change.html`: Email change confirmation
- `magic_link.html`: Magic link authentication

Templates use Go template syntax with variables like `{{ .SiteURL }}`, `{{ .ConfirmationURL }}`, `{{ .Email }}`, etc.

## API Endpoints

### GET /api/auth/status

Returns authentication status and user information:

```json
{
  "authenticated": true,
  "user": {
    "id": "user-id",
    "email": "user@example.com"
  },
  "groups": [
    {
      "group_id": "group-id",
      "group_name": "Administrators",
      "role_id": "role-id",
      "role_name": "admin"
    }
  ],
  "permissions": ["backend.access", "backend.manage"],
  "canAccessBackend": true
}
```

### POST /api/auth/signout

Signs out the current user and clears session cookies.

## Security Considerations

1. **Server-Side Only**: All permission checks happen server-side. Never trust client-side checks.
2. **RLS Policies**: All RBAC tables have Row Level Security enabled
3. **Helper Functions**: Use SECURITY DEFINER for efficient permission checking
4. **Session Security**: HTTP-only cookies, secure in production
5. **Password Requirements**: Enforced by Supabase (minimum 6 characters)

## Testing

Comprehensive test suite located in `tests/auth/`:

- `auth-helpers.test.ts`: Tests for auth helper functions
- `middleware.test.ts`: Tests for middleware protection
- `api-routes.test.ts`: Tests for API endpoints
- `integration/auth-flow.test.ts`: End-to-end auth flow tests

## Migration Path

1. Run migrations to create RBAC schema
2. Seed initial data (permissions, roles, default group)
3. Create admin user using helper script
4. Assign users to groups as needed

## Troubleshooting

### User can't access backend

1. Check if user is authenticated: `GET /api/auth/status`
2. Check if user has `backend.access` permission
3. Verify user is assigned to a group with a role that has the permission

### Permission check fails

1. Verify user is in a group: Check `group_members` table
2. Verify role has permission: Check `role_permissions` table
3. Verify permission exists: Check `permissions` table

### Email templates not working

1. Ensure templates are in `supabase/templates/` directory
2. Check `supabase/config.toml` has correct template paths
3. Restart Supabase local instance after template changes

### oauth_client_id errors

If you encounter "missing destination name oauth_client_id" errors:

1. **In Supabase Cloud**: This is typically handled automatically by Supabase's infrastructure
2. **In local Supabase**: Update to the latest Supabase version or restart your local instance
3. **Note**: The migration to fix this was removed as it requires owner privileges not available in CI/production environments. Authentication works correctly with server-side sign-in even without this migration.
