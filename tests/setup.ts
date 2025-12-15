// Vitest setup file
// This file runs before all tests

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.test file for test environment variables
config({ path: resolve(__dirname, '../.env.test') });

// Set default eBay SDK environment variables for tests
// These are required by the eBay notification endpoint handler
// Individual tests can override these if needed (e.g., testing missing config)
if (!process.env.EBAY_APP_ID) {
  process.env.EBAY_APP_ID = 'test-app-id';
}
if (!process.env.EBAY_CLIENT_SECRET) {
  process.env.EBAY_CLIENT_SECRET = 'test-client-secret';
}
if (!process.env.EBAY_MARKETPLACE_DELETION_CALLBACK_URL) {
  process.env.EBAY_MARKETPLACE_DELETION_CALLBACK_URL = 'https://test.example.com/callback';
}
if (!process.env.EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN) {
  process.env.EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN = 'test-verification-token';
}
