#!/usr/bin/env tsx
/**
 * Helper script to create an admin user and assign them to the Administrators group
 * 
 * Usage:
 *   tsx scripts/create-admin-user.ts <email> <password>
 * 
 * Example:
 *   tsx scripts/create-admin-user.ts admin@example.com secure-password-123
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
async function createAdminUser(email: string, password: string): Promise<void> {
  const { supabaseServer } = await import('../lib/supabase/server');
  
  try {
    // Create user
    const { data: newUser, error: createError } = await supabaseServer.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    if (!newUser.user) {
      throw new Error('Failed to create user: No user returned');
    }

    console.log(`✓ Created user: ${email} (ID: ${newUser.user.id})`);

    // Ensure profile exists (should be created by trigger, but check anyway)
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id')
      .eq('id', newUser.user.id)
      .single();

    if (profileError || !profile) {
      // Create profile if it doesn't exist
      const { error: createProfileError } = await supabaseServer
        .from('profiles')
        .insert({ id: newUser.user.id });

      if (createProfileError) {
        throw new Error(`Failed to create profile: ${createProfileError.message}`);
      }
      console.log('✓ Created profile');
    }

    // Get Administrators group
    const { data: adminGroup, error: groupError } = await supabaseServer
      .from('groups')
      .select('id, name')
      .eq('name', 'Administrators')
      .single();

    if (groupError || !adminGroup) {
      throw new Error('Administrators group not found. Please run migrations first.');
    }

    // Get admin role
    const { data: adminRole, error: roleError } = await supabaseServer
      .from('roles')
      .select('id, name')
      .eq('name', 'admin')
      .single();

    if (roleError || !adminRole) {
      throw new Error('Admin role not found. Please run migrations first.');
    }

    // Assign user to Administrators group with admin role
    const { error: memberError } = await supabaseServer
      .from('group_members')
      .insert({
        group_id: adminGroup.id,
        user_id: newUser.user.id,
        role_id: adminRole.id,
      });

    if (memberError) {
      throw new Error(`Failed to assign user to group: ${memberError.message}`);
    }

    console.log(`✓ Assigned user to "${adminGroup.name}" group with "${adminRole.name}" role`);
    console.log(`\n✓ Admin user created successfully!`);
    console.log(`  Email: ${email}`);
    console.log(`  User ID: ${newUser.user.id}`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Parse command line arguments
{
  const scriptArgs = process.argv.slice(2);
  if (scriptArgs.length !== 2) {
    console.error('Usage: tsx scripts/create-admin-user.ts <email> <password>');
    console.error('\nExample:');
    console.error('  tsx scripts/create-admin-user.ts admin@example.com secure-password-123');
    process.exit(1);
  }

  const [email, password] = scriptArgs;

  if (password.length < 6) {
    console.error('Error: Password must be at least 6 characters long');
    process.exit(1);
  }

  // Use async IIFE to allow dynamic import
  (async () => {
    await createAdminUser(email, password);
  })();
}
