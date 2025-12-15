import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Environment variables:
// - EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN: verification token configured in eBay Dev Portal
// - EBAY_MARKETPLACE_DELETION_CALLBACK_URL: full HTTPS callback URL as configured in eBay Dev Portal

const VERIFICATION_TOKEN = process.env.EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN;
const CALLBACK_URL = process.env.EBAY_MARKETPLACE_DELETION_CALLBACK_URL;

/**
 * Handle eBay challenge request to validate the callback URL.
 *
 * eBay will call:
 *   GET https://<callback_url>?challenge_code=123
 *
 * We must respond with:
 *   { "challengeResponse": "<sha256(challengeCode + verificationToken + endpoint)>" }
 */
export async function GET(request: NextRequest) {
  try {
    const challengeCode = request.nextUrl.searchParams.get('challenge_code');

    if (!challengeCode) {
      return NextResponse.json(
        { error: 'Missing challenge_code query parameter' },
        { status: 400 },
      );
    }

    if (!VERIFICATION_TOKEN || !CALLBACK_URL) {
      console.error(
        'EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN or EBAY_MARKETPLACE_DELETION_CALLBACK_URL is not set',
      );
      return NextResponse.json(
        { error: 'Server not configured for eBay marketplace account deletion verification' },
        { status: 500 },
      );
    }

    const hash = crypto.createHash('sha256');
    hash.update(challengeCode);
    hash.update(VERIFICATION_TOKEN);
    hash.update(CALLBACK_URL);

    const challengeResponse = hash.digest('hex');

    return NextResponse.json(
      { challengeResponse },
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Error handling eBay challenge request:', error);
    return NextResponse.json(
      { error: 'Failed to process challenge request' },
      { status: 500 },
    );
  }
}

/**
 * Handle marketplace account deletion/closure notifications from eBay.
 *
 * Requirements from eBay docs:
 * - Endpoint must accept POST with JSON payload and `X-EBAY-SIGNATURE` header.
 * - Must immediately acknowledge with a success HTTP status code:
 *   200 OK, 201 Created, 202 Accepted, or 204 No Content.
 *
 * This implementation:
 * - Parses the notification body.
 * - Logs minimal details for now (username/userId/eiasToken & notificationId).
 * - Returns 202 Accepted quickly; additional processing can be added behind this.
 *
 * For full compliance, signature verification using the eBay Event Notification SDK
 * or equivalent manual verification logic should be added; this is left as a TODO.
 */
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-ebay-signature') ?? undefined;

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      // Still acknowledge per eBay requirements, but note the issue server-side
      console.error('Received invalid or empty eBay marketplace account deletion payload');
      return new Response(null, { status: 202 });
    }

    // Minimal shape from AsyncAPI spec in docs
    const metadata = (body as any).metadata;
    const notification = (body as any).notification;
    const data = notification?.data;

    const notificationId = notification?.notificationId;
    const topic = metadata?.topic;

    const username = data?.username;
    const userId = data?.userId;
    const eiasToken = data?.eiasToken;

    // For now, log the deletion event; in production, this should:
    // - Locate all records tied to this eBay user (by username/userId/eiasToken)
    // - Delete or irreversibly anonymize data as per your data retention policies
    // - Ensure deletions are not reversible even with highest privileges
    console.info('eBay marketplace account deletion notification received', {
      topic,
      notificationId,
      username,
      userId,
      eiasToken,
      hasSignature: Boolean(signature),
    });

    // TODO: Implement signature verification according to eBay docs:
    // https://developer.ebay.com/develop/guides-v2/marketplace-user-account-deletion/marketplace-user-account-deletion#overview
    // - Decode x-ebay-signature
    // - Fetch and cache public key using Notification API getPublicKey
    // - Verify signature against payload, respond 412 if verification fails

    // Acknowledge receipt as required by eBay
    return new Response(null, { status: 202 });
  } catch (error) {
    // Per eBay docs, they will retry if callback URL is not acknowledged.
    // We still try to acknowledge the notification with a success code to avoid
    // repeated retries if the error is due to internal processing.
    console.error('Error processing eBay marketplace account deletion notification:', error);
    return new Response(null, { status: 202 });
  }
}


