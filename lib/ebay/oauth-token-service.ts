// eBay OAuth Token Service
// Implements client credentials grant flow for Application access tokens

export interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

// In-memory cache for tokens
let tokenCache: CachedToken | null = null;
// Promise to prevent concurrent token refresh requests
let refreshPromise: Promise<string> | null = null;

// Refresh buffer: refresh token 5 minutes before expiration
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the OAuth token endpoint URL based on environment
 */
function getTokenEndpoint(): string {
  const environment = process.env.EBAY_ENVIRONMENT ?? 'PRODUCTION';
  const isSandbox = environment === 'SANDBOX';
  
  return isSandbox
    ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    : 'https://api.ebay.com/identity/v1/oauth2/token';
}

/**
 * Generate Base64-encoded credentials for OAuth
 */
function getBase64Credentials(): string {
  const clientId = process.env.EBAY_APP_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const missing = [];
    if (!clientId) missing.push('EBAY_APP_ID');
    if (!clientSecret) missing.push('EBAY_CLIENT_SECRET');
    throw new Error(
      `Missing required eBay OAuth credentials. Please set the following environment variables: ${missing.join(', ')}`
    );
  }

  const credentials = `${clientId}:${clientSecret}`;
  return Buffer.from(credentials).toString('base64');
}

/**
 * Fetch a new access token from eBay OAuth API
 */
async function fetchNewToken(): Promise<OAuthTokenResponse> {
  const endpoint = getTokenEndpoint();
  const credentials = getBase64Credentials();

  // Default scope for Browse API
  // Can be extended if needed for other APIs
  const scope = 'https://api.ebay.com/oauth/api_scope';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: scope,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch eBay OAuth token: ${response.status} ${response.statusText}. ${errorText}`
    );
  }

  const data = (await response.json()) as OAuthTokenResponse;

  // Validate response structure
  if (!data.access_token || !data.expires_in) {
    throw new Error(
      'Invalid OAuth token response: missing access_token or expires_in'
    );
  }

  return data;
}

/**
 * Get a valid eBay OAuth access token.
 * 
 * This function:
 * - Returns cached token if still valid
 * - Automatically refreshes expired tokens
 * - Prevents concurrent refresh requests
 * 
 * @returns Promise resolving to a valid access token
 */
export async function getEbayAccessToken(): Promise<string> {
  const now = Date.now();

  // Check if we have a valid cached token
  if (tokenCache && tokenCache.expiresAt > now + REFRESH_BUFFER_MS) {
    return tokenCache.token;
  }

  // If a refresh is already in progress, wait for it
  if (refreshPromise) {
    return refreshPromise;
  }

  // Start a new token fetch
  refreshPromise = (async () => {
    try {
      const tokenResponse = await fetchNewToken();
      
      // Calculate expiration timestamp
      const expiresAt = now + tokenResponse.expires_in * 1000; // expires_in is in seconds
      
      // Update cache
      tokenCache = {
        token: tokenResponse.access_token,
        expiresAt,
      };

      return tokenCache.token;
    } finally {
      // Clear the refresh promise so future calls can trigger a new refresh
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Clear the token cache (useful for testing or forced refresh)
 */
export function clearTokenCache(): void {
  tokenCache = null;
  refreshPromise = null;
}


