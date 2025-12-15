import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseServer } from '@/lib/supabase/server';
import { EventNotificationSDK } from 'event-notification-nodejs-sdk';

// Environment variables:
// - EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN: verification token configured in eBay Dev Portal
// - EBAY_MARKETPLACE_DELETION_CALLBACK_URL: full HTTPS callback URL as configured in eBay Dev Portal
// - EBAY_CLIENT_ID: eBay OAuth client ID
// - EBAY_CLIENT_SECRET: eBay OAuth client secret
// - EBAY_DEV_ID: (optional) eBay developer ID
// - EBAY_REDIRECT_URI: (optional) eBay redirect URI for the app
// - EBAY_ENVIRONMENT: 'production' (default) or 'sandbox'

const VERIFICATION_TOKEN = process.env.EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN;
const CALLBACK_URL = process.env.EBAY_MARKETPLACE_DELETION_CALLBACK_URL;
const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const EBAY_DEV_ID = process.env.EBAY_DEV_ID;
const EBAY_REDIRECT_URI = process.env.EBAY_REDIRECT_URI;
const EBAY_ENVIRONMENT = process.env.EBAY_ENVIRONMENT ?? 'production';

type EbayNotificationSdk = {
  verifyNotification: (req: unknown) => Promise<boolean>;
};

let ebayNotificationSdk: EbayNotificationSdk | null = null;

function getEbayNotificationSdk(): EbayNotificationSdk | null {
  if (ebayNotificationSdk) return ebayNotificationSdk;

  if (!EBAY_APP_ID || !EBAY_CLIENT_SECRET || !CALLBACK_URL || !VERIFICATION_TOKEN) {
    const missingVars = [
      !EBAY_APP_ID && 'EBAY_CLIENT_ID',
      !EBAY_CLIENT_SECRET && 'EBAY_CLIENT_SECRET',
      !CALLBACK_URL && 'EBAY_MARKETPLACE_DELETION_CALLBACK_URL',
      !VERIFICATION_TOKEN && 'EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN',
    ].filter(Boolean);

    console.error(
      `Missing required eBay notification configuration. The following environment variables are not set: ${missingVars.join(', ')}`
    );
    return null;
  }

  const baseUrl =
    EBAY_ENVIRONMENT === 'sandbox' ? 'api.sandbox.ebay.com' : 'api.ebay.com';

  ebayNotificationSdk = new EventNotificationSDK({
    PRODUCTION: {
      clientId: EBAY_APP_ID,
      clientSecret: EBAY_CLIENT_SECRET,
      devId: EBAY_DEV_ID ?? '',
      redirectUri: EBAY_REDIRECT_URI ?? '',
      baseUrl,
    },
    endpoint: CALLBACK_URL,
    verificationToken: VERIFICATION_TOKEN,
  } as unknown);

  return ebayNotificationSdk;
}

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
    const sdk = getEbayNotificationSdk();
    const signature = request.headers.get('x-ebay-signature') ?? undefined;

    // Read raw body once so we can both verify the signature and parse JSON from it.
    const rawBody = await request.text();

    let body: unknown = null;
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        // Leave body as null; we'll handle below.
      }
    }

    if (!body || typeof body !== 'object') {
      // Still acknowledge per eBay requirements, but note the issue server-side
      console.error('Received invalid or empty eBay marketplace account deletion payload');
      return new Response(null, { status: 202 });
    }

    // Verify signature before processing or persisting anything.
    if (!signature) {
      console.warn('Missing X-EBAY-SIGNATURE header on marketplace account deletion notification');
      return new Response(null, { status: 412 });
    }

    if (!sdk) {
      // If SDK is not configured correctly, do not accept the notification as valid.
      // Respond with 500 so that eBay can retry while configuration is fixed.
      return new Response(null, { status: 500 });
    }

    const fakeReq: { headers: Record<string, string>; body: unknown } = {
      headers: Object.fromEntries(request.headers),
      body,
    };

    let isValid = false;
    try {
      // SDK handles:
      // 1. Decoding signature header
      // 2. Retrieving public key via Notification API (with caching)
      // 3. Verifying signature against payload
      isValid = await sdk.verifyNotification(fakeReq);
    } catch (err) {
      console.error('Error during eBay notification signature verification:', err);
      return new Response(null, { status: 412 });
    }

    if (!isValid) {
      console.warn('eBay marketplace account deletion notification failed signature verification');
      return new Response(null, { status: 412 });
    }

    // Minimal shape from AsyncAPI spec in docs
    const metadata = (body as { metadata?: unknown; notification?: unknown }).metadata as {
      topic?: string;
    } | undefined;
    const notification = (body as {
      notification?: {
        notificationId?: string;
        eventDate?: string;
        publishDate?: string;
        publishAttemptCount?: number;
        data?: {
          username?: string;
          userId?: string;
          eiasToken?: string;
        };
      };
    }).notification;
    const data = notification?.data;

    const notificationId = notification?.notificationId;
    const topic = metadata?.topic;

    const eventDate = notification?.eventDate ?? null;
    const publishDate = notification?.publishDate ?? null;
    const publishAttemptCount = notification?.publishAttemptCount ?? null;

    const username = data?.username;
    const userId = data?.userId;
    const eiasToken = data?.eiasToken;

    if (!notificationId) {
      // According to the eBay schema, notificationId should always be present.
      // If it's missing, don't attempt to persist (PK would fail) but still acknowledge.
      console.error(
        'Verified eBay marketplace account deletion notification is missing notificationId; skipping persistence.',
      );
      return new Response(null, { status: 202 });
    }

    // Persist the verified notification to Supabase.
    try {
      const { error } = await supabaseServer
        .from('ebay_marketplace_account_deletion_notifications')
        .insert({
          topic,
          notification_id: notificationId ?? null,
          event_date: eventDate ? new Date(eventDate) : null,
          publish_date: publishDate ? new Date(publishDate) : null,
          publish_attempt_count: publishAttemptCount,
          username: username ?? null,
          user_id: userId ?? null,
          eias_token: eiasToken ?? null,
          signature,
          verified: true,
          raw_payload: body,
        });

      if (error) {
        console.error(
          'Failed to insert eBay marketplace account deletion notification into Supabase:',
          error,
        );
      }
    } catch (dbError) {
      console.error(
        'Unexpected error while inserting eBay marketplace account deletion notification into Supabase:',
        dbError,
      );
    }

    // Log for operational visibility
    console.info('eBay marketplace account deletion notification stored', {
      topic,
      notificationId,
      username,
      userId,
      eiasToken,
    });

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


