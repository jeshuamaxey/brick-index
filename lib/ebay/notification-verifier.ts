import { createServiceLogger } from '@/lib/logging';

export type EbayEnvironment = 'PRODUCTION' | 'SANDBOX';

// Minimal shape used by our verifier; we only care that it's an object.
export type EbayNotificationConfig = Record<string, unknown>;

const log = createServiceLogger('EbayNotificationVerifier');

/**
 * Lightweight, swappable implementation of the eBay notification "process" logic.
 *
 * For now this only performs basic validation of the signature header and payload shape,
 * and returns SDK-compatible HTTP status codes:
 * - 204: treated as "success" (signature accepted)
 * - 412: treated as "Precondition Failed" (bad/missing signature)
 * - 500: internal error while attempting verification
 *
 * This is intentionally factored so we can replace or extend the verification logic
 * (e.g. calling the Notification API getPublicKey and performing ECC verification)
 * without touching the API route handler.
 *
 * See eBay docs for the full verification flow:
 * https://developer.ebay.com/develop/guides-v2/marketplace-user-account-deletion/marketplace-user-account-deletion#receiving
 */
export async function processEbayNotification(
  body: unknown,
  signature: string | undefined,
  _config: EbayNotificationConfig,
  environment: EbayEnvironment,
): Promise<number> {
  try {
    log.info({ hasBody: Boolean(body), hasSignature: Boolean(signature), environment }, 'Processing eBay notification');

    if (!signature) {
      log.warn('Missing X-EBAY-SIGNATURE header; returning 412');
      return 412;
    }

    if (!body || typeof body !== 'object') {
      log.error('Invalid or empty payload; returning 412');
      return 412;
    }

    // TODO: Implement full manual verification as per eBay docs:
    // 1. Decode the x-ebay-signature header (Base64)
    // 2. Use the decoded value to call the Notification API getPublicKey endpoint
    // 3. Cache the public key for a reasonable time
    // 4. Verify the ECC signature against the notification payload
    // 5. Return 204 on success, 412 on failure
    //
    // For now, we optimistically treat a well-formed payload with a present signature
    // as "verified" so we can test end-to-end behavior independently of the SDK.

    log.info('Basic checks passed; returning 204 (temporary optimistic verification)');
    return 204;
  } catch (error) {
    log.error({ err: error }, 'Unexpected error during notification processing');
    return 500;
  }
}


