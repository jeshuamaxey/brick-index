#!/usr/bin/env tsx
/**
 * Helper script to assign a user to a group with a specific role
 * 
 * Usage:
 *   tsx scripts/assign-user-to-group.ts <user-email> <group-name> <role-name>
 * 
 * Example:
 *   tsx scripts/assign-user-to-group.ts user@example.com Administrators admin
 */

// Load environment variables from .env.local or .env
// Use synchronous require to ensure it runs before any ES module imports
{
  const nodePath = require('path');
  const nodeFs = require('fs');
  const nodeDotenv = require('dotenv');

  // Load .env.local first (takes precedence), then .env
  const envLocalPath = nodePath.resolve(process.cwd(), '.env.local');
  const envPath = nodePath.resolve(process.cwd(), '.env');

  // Load both files - dotenv will merge them, with later ones taking precedence
  // So we load .env first, then .env.local to give .env.local precedence
  if (nodeFs.existsSync(envPath)) {
    nodeDotenv.config({ path: envPath });
  }
  if (nodeFs.existsSync(envLocalPath)) {
    nodeDotenv.config({ path: envLocalPath, override: false });
  }

  // Verify required env vars are loaded
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing required environment variables.');
    console.error('Please ensure .env.local or .env file contains:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL');
    console.error('  SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
}

// Now dynamically import modules that depend on environment variables
// This ensures env vars are loaded before the module is evaluated
async function assignUserToGroup(
  userEmail: string,
  groupName: string,
  roleName: string
): Promise<void> {
  const { supabaseServer } = await import('../lib/supabase/server');
  
  try {
    // Get user by email
    const { data: users, error: userError } = await supabaseServer.auth.admin.listUsers();
    
    if (userError) {
      throw new Error(`Failed to list users: ${userError.message}`);
    }

    const user = users?.users.find((u) => u.email === userEmail);
    if (!user) {
      throw new Error(`User with email ${userEmail} not found`);
    }

    // Get group by name
    const { data: groups, error: groupError } = await supabaseServer
      .from('groups')
      .select('id, name')
      .eq('name', groupName)
      .single();

    if (groupError || !groups) {
      throw new Error(`Group "${groupName}" not found`);
    }

    // Get role by name
    const { data: roles, error: roleError } = await supabaseServer
      .from('roles')
      .select('id, name')
      .eq('name', roleName)
      .single();

    if (roleError || !roles) {
      throw new Error(`Role "${roleName}" not found`);
    }

    // Check if profile exists
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      // Create profile if it doesn't exist
      const { error: createProfileError } = await supabaseServer
        .from('profiles')
        .insert({ id: user.id });

      if (createProfileError) {
        throw new Error(`Failed to create profile: ${createProfileError.message}`);
      }
    }

    // Assign user to group with role
    const { data: member, error: memberError } = await supabaseServer
      .from('group_members')
      .insert({
        group_id: groups.id,
        user_id: user.id,
        role_id: roles.id,
      })
      .select()
      .single();

    if (memberError) {
      // Check if user is already in the group
      if (memberError.code === '23505') {
        // Update existing membership
        const { error: updateError } = await supabaseServer
          .from('group_members')
          .update({ role_id: roles.id })
          .eq('group_id', groups.id)
          .eq('user_id', user.id);

        if (updateError) {
          throw new Error(`Failed to update group membership: ${updateError.message}`);
        }

        console.log(`✓ Updated user ${userEmail} in group "${groupName}" with role "${roleName}"`);
        return;
      }
      throw new Error(`Failed to assign user to group: ${memberError.message}`);
    }

    console.log(`✓ Assigned user ${userEmail} to group "${groupName}" with role "${roleName}"`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Parse command line arguments
{
  const scriptArgs = process.argv.slice(2);
  if (scriptArgs.length !== 3) {
    console.error('Usage: tsx scripts/assign-user-to-group.ts <user-email> <group-name> <role-name>');
    process.exit(1);
  }

  const [userEmail, groupName, roleName] = scriptArgs;

  // Use async IIFE to allow dynamic import
  (async () => {
    await assignUserToGroup(userEmail, groupName, roleName);
  })();
}
