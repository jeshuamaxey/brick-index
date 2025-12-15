import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import * as EventNotificationSDK from 'event-notification-nodejs-sdk';
import {
  processEbayNotification,
  type EbayNotificationConfig,
} from '@/lib/ebay/notification-verifier';

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
type EbayNotificationEnvironment = 'PRODUCTION' | 'SANDBOX';

function getEnvironmentKey(): EbayNotificationEnvironment {
  const raw = (process.env.EBAY_ENVIRONMENT ?? '').toUpperCase();
  if (raw === 'SANDBOX') return 'SANDBOX';
  // Default to PRODUCTION for any other value (including empty / 'production')
  return 'PRODUCTION';
}

function getSdkConfig(): EbayNotificationConfig | null {
  if (!EBAY_APP_ID || !EBAY_CLIENT_SECRET || !CALLBACK_URL || !VERIFICATION_TOKEN) {
    const missingVars = [
      !EBAY_APP_ID && 'EBAY_APP_ID',
      !EBAY_CLIENT_SECRET && 'EBAY_CLIENT_SECRET',
      !CALLBACK_URL && 'EBAY_MARKETPLACE_DELETION_CALLBACK_URL',
      !VERIFICATION_TOKEN && 'EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN',
    ].filter(Boolean);

    console.error(
      `Missing required eBay notification configuration. The following environment variables are not set: ${missingVars.join(', ')}`
    );
    return null;
  }

  const envKey = getEnvironmentKey();

  const baseUrl = envKey === 'SANDBOX' ? 'api.sandbox.ebay.com' : 'api.ebay.com';

  return {
    [envKey]: {
      clientId: EBAY_APP_ID,
      clientSecret: EBAY_CLIENT_SECRET,
      devId: EBAY_DEV_ID ?? '',
      redirectUri: EBAY_REDIRECT_URI ?? '',
      baseUrl,
    },
    endpoint: CALLBACK_URL,
    verificationToken: VERIFICATION_TOKEN,
  };
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

    const config = getSdkConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'Server not configured for eBay marketplace account deletion verification' },
        { status: 500 },
      );
    }

    const challengeResponse = EventNotificationSDK.validateEndpoint(
      challengeCode,
      config,
    );

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
    console.info('[eBay Deletion] POST handler invoked');

    const signature = request.headers.get('x-ebay-signature') ?? undefined;
    console.info('[eBay Deletion] Signature header present:', Boolean(signature));

    // Read raw body once so we can both verify the signature and parse JSON from it.
    const rawBody = await request.text();
    console.info(
      '[eBay Deletion] Raw body length:',
      typeof rawBody === 'string' ? rawBody.length : 0,
    );

    let body: unknown = null;
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        // Leave body as null; we'll handle below.
      }
      console.info('[eBay Deletion] JSON body parsed successfully');
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

    const config = getSdkConfig();
    if (!config) {
      // If SDK config is not available, do not accept the notification as valid.
      // Respond with 500 so that eBay can retry while configuration is fixed.
      console.error('[eBay Deletion] SDK configuration missing; returning 500');
      return new Response(null, { status: 500 });
    }

    console.info('[eBay Deletion] Using custom notification verifier');
    const responseCode = await processEbayNotification(
      body,
      signature,
      config,
      getEnvironmentKey(),
    );
    console.info(
      '[eBay Deletion] Custom verifier processEbayNotification responseCode:',
      responseCode,
    );
    // Per SDK example, NO_CONTENT (204) == success, PRECONDITION_FAILED (412) == bad signature.
    if (responseCode !== 204) {
      if (responseCode === 412) {
        console.warn(
          'eBay marketplace account deletion notification failed signature verification (412)',
        );
      } else {
        console.error(
          '[eBay Deletion] EventNotificationSDK.process returned non-success status; not persisting notification',
        );
      }
      // Return the SDK's HTTP status code back to eBay unchanged.
      return new Response(null, { status: responseCode });
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

    console.info('[eBay Deletion] Parsed notification payload', {
      topic,
      notificationId,
      hasData: Boolean(data),
      hasUsername: Boolean(username),
      hasUserId: Boolean(userId),
      hasEiasToken: Boolean(eiasToken),
    });

    if (!notificationId) {
      // According to the eBay schema, notificationId should always be present.
      // If it's missing, don't attempt to persist (PK would fail) but still acknowledge.
      console.error(
        'Verified eBay marketplace account deletion notification is missing notificationId; skipping persistence.',
      );
      return new Response(null, { status: 202 });
    }

    // Persist the verified notification to Supabase.
    // Note: supabaseServer uses service role key which bypasses RLS,
    // allowing writes to the protected ebay_marketplace_account_deletion_notifications table
    try {
      console.info(
        '[eBay Deletion] Inserting notification into Supabase',
        notificationId,
      );
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
        // Do not log as stored if persistence failed.
      } else {
        console.info(
          '[eBay Deletion] Successfully inserted notification into Supabase',
          notificationId,
        );
        // Log for operational visibility only when persistence succeeded.
        console.info('eBay marketplace account deletion notification stored', {
          topic,
          notificationId,
          username,
          userId,
          eiasToken,
        });
      }
    } catch (dbError) {
      console.error(
        'Unexpected error while inserting eBay marketplace account deletion notification into Supabase:',
        dbError,
      );
    }

    // Acknowledge receipt as required by eBay
    return new Response(null, { status: 202 });
  } catch (error) {
    // Per eBay docs, eBay will retry if the callback URL is not acknowledged with a success code.
    // Since this is an unexpected top-level failure, return 500 so that eBay will retry later.
    console.error(
      'Error processing eBay marketplace account deletion notification (top-level handler error):',
      error,
    );
    return new Response(null, { status: 500 });
  }
}


