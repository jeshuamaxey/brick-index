// Service to track eBay Browse API usage for rate limit monitoring

import type { SupabaseClient } from '@supabase/supabase-js';

export type EbayEndpointType = 'item_summary_search' | 'get_item';

export interface ApiUsageRecord {
  app_id: string;
  endpoint_type: EbayEndpointType;
  called_at?: Date;
  rate_limit_limit?: number;
  rate_limit_remaining?: number;
  rate_limit_reset?: Date;
  response_status?: number;
  response_headers?: Record<string, string>;
  error_message?: string;
}

export interface UsageStats {
  endpoint_type: EbayEndpointType;
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  calls_in_last_24h: number;
  limit_per_day: number;
  percentage_used: number;
}

/**
 * Service to track eBay Browse API usage
 * 
 * Tracks API calls per application ID and endpoint type to monitor
 * rate limits:
 * - item_summary_search: 5,000 calls/day
 * - get_item: 5,000 calls/day
 */
export class EbayApiUsageTracker {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Record an API call
   */
  async recordApiCall(record: ApiUsageRecord): Promise<void> {
    try {
      // Extract rate limit headers from response_headers if provided
      const headers = record.response_headers || {};
      const rateLimitLimit = this.extractRateLimitHeader(headers, 'limit');
      const rateLimitRemaining = this.extractRateLimitHeader(headers, 'remaining');
      const rateLimitReset = this.extractRateLimitReset(headers);

      const { error } = await this.supabase
        .schema('pipeline')
        .from('ebay_api_usage')
        .insert({
          app_id: record.app_id,
          endpoint_type: record.endpoint_type,
          called_at: record.called_at?.toISOString() || new Date().toISOString(),
          rate_limit_limit: rateLimitLimit,
          rate_limit_remaining: rateLimitRemaining,
          rate_limit_reset: rateLimitReset?.toISOString(),
          response_status: record.response_status,
          response_headers: headers,
          error_message: record.error_message,
        });

      if (error) {
        console.error('Failed to record API usage:', error);
        // Don't throw - we don't want API tracking failures to break API calls
      }
    } catch (error) {
      console.error('Error recording API usage:', error);
      // Don't throw - we don't want API tracking failures to break API calls
    }
  }

  /**
   * Get usage statistics for an application ID
   * @param appId - eBay Application ID
   * @param hours - Number of hours to look back (default: 24)
   */
  async getUsageStats(
    appId: string,
    hours: number = 24
  ): Promise<UsageStats[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_ebay_api_usage_stats', {
        p_app_id: appId,
        p_hours: hours,
      });

      if (error) {
        console.error('Failed to get usage stats:', error);
        return this.getEmptyStats();
      }

      return (data || []).map((row: any) => ({
        endpoint_type: row.endpoint_type as EbayEndpointType,
        total_calls: Number(row.total_calls) || 0,
        successful_calls: Number(row.successful_calls) || 0,
        failed_calls: Number(row.failed_calls) || 0,
        calls_in_last_24h: Number(row.calls_in_last_24h) || 0,
        limit_per_day: Number(row.limit_per_day) || 5000,
        percentage_used: Number(row.percentage_used) || 0,
      }));
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Get current usage for last 24 hours
   */
  async getCurrentUsage(appId: string): Promise<UsageStats[]> {
    return this.getUsageStats(appId, 24);
  }

  /**
   * Check if we're approaching rate limits
   * @param threshold - Percentage threshold to warn at (default: 80%)
   */
  async checkRateLimitStatus(
    appId: string,
    threshold: number = 80
  ): Promise<{
    isNearLimit: boolean;
    stats: UsageStats[];
  }> {
    const stats = await this.getCurrentUsage(appId);
    const isNearLimit = stats.some(
      (stat) => stat.percentage_used >= threshold
    );

    return {
      isNearLimit,
      stats,
    };
  }

  /**
   * Extract rate limit header value
   * Checks common header name variations
   */
  private extractRateLimitHeader(
    headers: Record<string, string>,
    type: 'limit' | 'remaining'
  ): number | undefined {
    const headerNames = [
      `X-RateLimit-${type === 'limit' ? 'Limit' : 'Remaining'}`,
      `X-Rate-Limit-${type === 'limit' ? 'Limit' : 'Remaining'}`,
      `RateLimit-${type === 'limit' ? 'Limit' : 'Remaining'}`,
      `X-eBay-RateLimit-${type === 'limit' ? 'Limit' : 'Remaining'}`,
    ];

    for (const headerName of headerNames) {
      const value = headers[headerName] || headers[headerName.toLowerCase()];
      if (value) {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract rate limit reset timestamp
   */
  private extractRateLimitReset(
    headers: Record<string, string>
  ): Date | undefined {
    const headerNames = [
      'X-RateLimit-Reset',
      'X-Rate-Limit-Reset',
      'RateLimit-Reset',
      'X-eBay-RateLimit-Reset',
    ];

    for (const headerName of headerNames) {
      const value = headers[headerName] || headers[headerName.toLowerCase()];
      if (value) {
        // Could be Unix timestamp (seconds or milliseconds) or ISO string
        const timestamp = parseInt(value, 10);
        if (!isNaN(timestamp)) {
          // Assume seconds if < year 2000 in seconds, otherwise milliseconds
          const date =
            timestamp < 946684800
              ? new Date(timestamp * 1000)
              : new Date(timestamp);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
        // Try parsing as ISO string
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return undefined;
  }

  /**
   * Convert Headers object to plain object
   */
  static headersToObject(headers: Headers): Record<string, string> {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  /**
   * Get appropriate Supabase client based on environment
   * - In API routes: uses regular client (anon key)
   * - In scripts: uses server client (service role key)
   */
  static async getSupabaseClient(): Promise<SupabaseClient> {
    // Try to use regular client first (for API routes)
    // If that fails or env vars aren't set, fall back to server client (for scripts)
    try {
      const { supabase } = await import('@/lib/supabase/client');
      // Verify the client is actually usable by checking if URL is set
      if (supabase && typeof supabase === 'object') {
        return supabase;
      }
    } catch (error) {
      // Regular client not available, fall through to server client
    }

    // Use server client (for scripts or when regular client unavailable)
    const { supabaseServer } = await import('@/lib/supabase/server');
    return supabaseServer;
  }

  /**
   * Return empty stats for both endpoint types
   */
  private getEmptyStats(): UsageStats[] {
    return [
      {
        endpoint_type: 'item_summary_search',
        total_calls: 0,
        successful_calls: 0,
        failed_calls: 0,
        calls_in_last_24h: 0,
        limit_per_day: 5000,
        percentage_used: 0,
      },
      {
        endpoint_type: 'get_item',
        total_calls: 0,
        successful_calls: 0,
        failed_calls: 0,
        calls_in_last_24h: 0,
        limit_per_day: 5000,
        percentage_used: 0,
      },
    ];
  }
}
