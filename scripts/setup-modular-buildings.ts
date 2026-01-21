#!/usr/bin/env tsx
/**
 * Script to set up LEGO Modular Buildings theme for the consumer experience
 * 
 * This script:
 * 1. Publishes the Modular Buildings theme (ID 155)
 * 2. Refreshes the set_price_aggregates materialized view
 *
 * Usage: tsx scripts/setup-modular-buildings.ts
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

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/supabase/supabase.types';

const MODULAR_BUILDINGS_THEME_ID = 721;

async function main() {
  console.log('Setting up LEGO Modular Buildings for consumer experience...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Create Supabase client
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Step 1: Check if Modular Buildings theme exists
    console.log('Step 1: Verifying Modular Buildings theme exists...');
    const { data: theme, error: themeError } = await supabase
      .schema('catalog')
      .from('themes')
      .select('id, name')
      .eq('id', MODULAR_BUILDINGS_THEME_ID)
      .single();

    if (themeError || !theme) {
      console.error(`Error: Modular Buildings theme (ID ${MODULAR_BUILDINGS_THEME_ID}) not found.`);
      console.error('Please run the catalog refresh job first to import themes.');
      process.exit(1);
    }

    console.log(`  Found theme: "${theme.name}" (ID: ${theme.id})`);

    // Step 2: Count sets in the theme
    console.log('\nStep 2: Counting sets in Modular Buildings theme...');
    const { count: setCount, error: countError } = await supabase
      .schema('catalog')
      .from('lego_sets')
      .select('*', { count: 'exact', head: true })
      .eq('theme_id', MODULAR_BUILDINGS_THEME_ID);

    if (countError) {
      console.error('Error counting sets:', countError.message);
    } else {
      console.log(`  Found ${setCount || 0} sets in Modular Buildings theme`);
    }

    // Step 3: Publish the theme
    console.log('\nStep 3: Publishing Modular Buildings theme...');
    const now = new Date().toISOString();

    const { error: publishError } = await supabase
      .schema('catalog')
      .from('published_themes')
      .upsert(
        {
          theme_id: MODULAR_BUILDINGS_THEME_ID,
          is_published: true,
          published_at: now,
          updated_at: now,
        },
        {
          onConflict: 'theme_id',
        }
      );

    if (publishError) {
      console.error('Error publishing theme:', publishError.message);
      process.exit(1);
    }

    console.log('  Theme published successfully!');

    // Step 4: Refresh the materialized view
    console.log('\nStep 4: Refreshing set_price_aggregates materialized view...');
    const { error: refreshError } = await supabase
      .schema('analytics')
      .rpc('refresh_set_price_aggregates');

    if (refreshError) {
      console.error('Warning: Could not refresh materialized view:', refreshError.message);
      console.error('  This may happen if the view is empty. It will populate after listings are processed.');
    } else {
      console.log('  Materialized view refreshed successfully!');
    }

    // Step 5: Verify setup
    console.log('\nStep 5: Verifying setup...');
    
    // Check published themes
    const { data: publishedTheme } = await supabase
      .schema('catalog')
      .from('published_themes')
      .select('*')
      .eq('theme_id', MODULAR_BUILDINGS_THEME_ID)
      .single();

    if (publishedTheme?.is_published) {
      console.log('  ✓ Modular Buildings theme is published');
    } else {
      console.log('  ✗ Theme publishing failed');
    }

    // Check if any sets are now published
    const { data: publishedSets, error: setsError } = await supabase
      .schema('catalog')
      .rpc('get_published_sets');

    if (!setsError && publishedSets) {
      const modularSets = publishedSets.filter((s: any) => s.theme_id === MODULAR_BUILDINGS_THEME_ID);
      console.log(`  ✓ ${modularSets.length} Modular Building sets are now visible to consumers`);
    }

    console.log('\n✅ Setup complete!');
    console.log('\nNext steps:');
    console.log('1. Ensure listings have been captured and reconciled for Modular Buildings sets');
    console.log('2. Visit the consumer homepage to see the published sets');
    console.log('3. Use the backend Publishing page to manage theme/set visibility');

  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

main();
