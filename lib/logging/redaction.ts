// Sensitive data redaction configuration for Pino

/**
 * Paths to redact in log output
 * These patterns match sensitive data that should never appear in logs
 */
export const redactPaths = [
  // Authentication headers
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  'headers.authorization',
  'headers["x-api-key"]',
  
  // Common sensitive field names (with wildcard prefix)
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.apiKey',
  '*.secret',
  '*.clientSecret',
  '*.privateKey',
  
  // eBay-specific credentials
  '*.ebayAppId',
  '*.ebayClientSecret',
  '*.ebayAccessToken',
  'ebayAppId',
  'ebayClientSecret',
  'ebayAccessToken',
  
  // Supabase credentials
  '*.supabaseKey',
  '*.serviceRoleKey',
  '*.anonKey',
  
  // Environment variable references that might contain secrets
  'EBAY_APP_ID',
  'EBAY_CLIENT_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'INNGEST_SIGNING_KEY',
  'INNGEST_EVENT_KEY',
  'RESEND_API_KEY',
];

/**
 * Redaction censor string
 */
export const redactCensor = '[REDACTED]';

/**
 * Get redaction configuration for Pino
 */
export function getRedactionConfig() {
  return {
    paths: redactPaths,
    censor: redactCensor,
  };
}
