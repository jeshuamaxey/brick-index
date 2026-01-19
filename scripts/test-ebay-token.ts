#!/usr/bin/env tsx
// Script to test eBay OAuth token generation
// Verifies that environment variables are correctly configured

// Load environment variables from .env.local or .env
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

import { getEbayAccessToken, clearTokenCache } from '@/lib/ebay/oauth-token-service';

async function main() {
  console.log('🔍 Testing eBay OAuth token generation...\n');

  // Check required environment variables
  const requiredVars = {
    'EBAY_APP_ID': process.env.EBAY_APP_ID,
    'EBAY_CLIENT_SECRET': process.env.EBAY_CLIENT_SECRET,
  };

  const missingVars: string[] = [];
  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      missingVars.push(key);
    }
  }

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error('\n💡 Please set these variables in your .env file or environment.');
    process.exit(1);
  }

  // Display environment info (without exposing secrets)
  const environment = process.env.EBAY_ENVIRONMENT || 'PRODUCTION';
  const appId = process.env.EBAY_APP_ID;
  const appIdPreview = appId ? `${appId.substring(0, 8)}...` : 'not set';
  
  console.log('📋 Configuration:');
  console.log(`   Environment: ${environment}`);
  console.log(`   App ID: ${appIdPreview}`);
  console.log(`   Client Secret: ${process.env.EBAY_CLIENT_SECRET ? '***set***' : 'not set'}`);
  console.log('');

  // Clear any cached token to force a fresh fetch
  clearTokenCache();

  try {
    console.log('🔄 Attempting to generate OAuth token...');
    const token = await getEbayAccessToken();

    if (!token) {
      console.error('❌ Token generation failed: Received empty token');
      process.exit(1);
    }

    // Display success with token preview
    const tokenPreview = token.substring(0, 20) + '...';
    console.log('✅ Successfully generated OAuth token!');
    console.log(`   Token preview: ${tokenPreview}`);
    console.log(`   Token length: ${token.length} characters`);
    console.log('\n🎉 eBay API authentication is configured correctly!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to generate OAuth token:');
    
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      
      // Provide helpful error messages
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        console.error('\n💡 This usually means:');
        console.error('   - Invalid App ID or Client Secret');
        console.error('   - Credentials don\'t match the environment (SANDBOX vs PRODUCTION)');
      } else if (error.message.includes('Missing required')) {
        console.error('\n💡 Please check your .env file contains all required variables.');
      } else if (error.message.includes('fetch')) {
        console.error('\n💡 Network error - please check your internet connection.');
      }
    } else {
      console.error(`   ${String(error)}`);
    }
    
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
