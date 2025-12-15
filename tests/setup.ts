// Vitest setup file
// This file runs before all tests

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.test file for test environment variables
config({ path: resolve(__dirname, '../.env.test') });
