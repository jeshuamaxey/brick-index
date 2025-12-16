// Load environment variables from .env.local or .env FIRST
// This must happen before any imports that depend on env vars
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

import fs from 'node:fs/promises';

// Type-only import (doesn't execute module code)
import type { EbaySnapshotFile } from '../lib/capture/marketplace-adapters/ebay-snapshot-adapter';
import type { Json } from '../lib/supabase/supabase.types';

// Use dynamic imports for modules that depend on environment variables
// This ensures dotenv config runs before they're evaluated

const DEFAULT_SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'ebay-snapshots');

interface SnapshotIndexEntry {
  file: string;
  profile: string;
  mode: 'normal' | 'empty' | 'error';
  createdAt: string;
  keywords: string[];
  itemCount: number;
}

interface SnapshotIndex {
  snapshots: SnapshotIndexEntry[];
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result: {
    file?: string;
    dir?: string;
    profile?: string;
    includeEmpty?: boolean;
    includeError?: boolean;
  } = {};

  for (const arg of args) {
    if (arg.startsWith('--file=')) {
      result.file = arg.slice('--file='.length);
    } else if (arg.startsWith('--dir=')) {
      result.dir = arg.slice('--dir='.length);
    } else if (arg.startsWith('--profile=')) {
      result.profile = arg.slice('--profile='.length);
    } else if (arg === '--include-empty') {
      result.includeEmpty = true;
    } else if (arg === '--include-error') {
      result.includeError = true;
    }
  }

  return result;
}

async function readSnapshotIndex(dir: string): Promise<SnapshotIndex> {
  const indexPath = path.join(dir, '_index.json');
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    return JSON.parse(raw) as SnapshotIndex;
  } catch {
    return { snapshots: [] };
  }
}

async function selectSnapshots(
  dir: string,
  options: {
    file?: string;
    profile?: string;
    includeEmpty?: boolean;
    includeError?: boolean;
  }
): Promise<SnapshotIndexEntry[]> {
  if (options.file) {
    // Explicit file specified - use it directly
    const index = await readSnapshotIndex(dir);
    const entry = index.snapshots.find((s) => s.file === options.file);
    if (entry) {
      return [entry];
    }
    // If not in index, create a synthetic entry
    return [
      {
        file: options.file,
        profile: 'unknown',
        mode: 'normal',
        createdAt: new Date().toISOString(),
        keywords: [],
        itemCount: 0,
      },
    ];
  }

  const index = await readSnapshotIndex(dir);
  let selected = [...index.snapshots];

  // Filter by profile if specified
  if (options.profile) {
    selected = selected.filter((s) => s.profile === options.profile);
  }

  // Filter by mode - exclude empty/error by default unless flags are set
  if (!options.includeEmpty) {
    selected = selected.filter((s) => s.mode !== 'empty');
  }
  if (!options.includeError) {
    selected = selected.filter((s) => s.mode !== 'error');
  }

  // If filtering by profile, get the most recent one for that profile
  if (options.profile && selected.length > 0) {
    selected.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return [selected[0]];
  }

  // Otherwise, get the most recent of each profile
  const byProfile = new Map<string, SnapshotIndexEntry>();
  for (const entry of selected) {
    const existing = byProfile.get(entry.profile);
    if (
      !existing ||
      new Date(entry.createdAt).getTime() >
        new Date(existing.createdAt).getTime()
    ) {
      byProfile.set(entry.profile, entry);
    }
  }

  return Array.from(byProfile.values());
}

/**
 * Extract enrichment fields from eBay getItem API response
 */
function extractEnrichmentFields(
  response: Record<string, unknown>
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  // Description
  if (response.description !== undefined) {
    fields.description = response.description;
  }

  // Additional images
  if (
    response.additionalImages &&
    Array.isArray(response.additionalImages)
  ) {
    fields.additional_images = (response.additionalImages as Array<{ imageUrl?: string }>)
      .map((img) => img.imageUrl)
      .filter((url): url is string => typeof url === 'string');
  } else {
    fields.additional_images = [];
  }

  // Condition description
  if (response.conditionDescription !== undefined) {
    fields.condition_description = response.conditionDescription;
  }

  // Category path
  if (response.categoryPath !== undefined) {
    fields.category_path = response.categoryPath;
  }

  // Item location
  if (response.itemLocation) {
    const location = response.itemLocation as {
      city?: string;
      stateOrProvince?: string;
      postalCode?: string;
      country?: string;
    };
    fields.item_location = {
      city: location.city,
      stateOrProvince: location.stateOrProvince,
      postalCode: location.postalCode,
      country: location.country,
    };
  }

  // Estimated availabilities
  if (
    response.estimatedAvailabilities &&
    Array.isArray(response.estimatedAvailabilities)
  ) {
    fields.estimated_availabilities = (
      response.estimatedAvailabilities as Array<{
        estimatedAvailabilityStatus?: string;
        estimatedAvailableQuantity?: number;
        estimatedSoldQuantity?: number;
        estimatedRemainingQuantity?: number;
      }>
    ).map((avail) => ({
      estimatedAvailabilityStatus: avail.estimatedAvailabilityStatus,
      estimatedAvailableQuantity: avail.estimatedAvailableQuantity,
      estimatedSoldQuantity: avail.estimatedSoldQuantity,
      estimatedRemainingQuantity: avail.estimatedRemainingQuantity,
    }));
  }

  // Buying options
  if (response.buyingOptions && Array.isArray(response.buyingOptions)) {
    fields.buying_options = response.buyingOptions;
  } else {
    fields.buying_options = [];
  }

  return fields;
}

async function main() {
  // Dynamic imports after env vars are loaded
  const { supabaseServer } = await import('../lib/supabase/server.js');
  const { CaptureService } = await import('../lib/capture/capture-service.js');
  const { EbaySnapshotAdapter } = await import('../lib/capture/marketplace-adapters/ebay-snapshot-adapter.js');

  const options = parseArgs();
  const snapshotDir =
    options.dir ?? process.env.EBAY_SNAPSHOT_DIR ?? DEFAULT_SNAPSHOT_DIR;

  const selectedSnapshots = await selectSnapshots(snapshotDir, options);

  if (selectedSnapshots.length === 0) {
    // eslint-disable-next-line no-console
    console.error('No snapshots found matching the criteria.');
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    `Loading ${selectedSnapshots.length} snapshot(s): ${selectedSnapshots
      .map((s) => `${s.profile} (${s.mode})`)
      .join(', ')}`
  );

  const captureService = new CaptureService(supabaseServer);
  const results = [];

  for (const snapshotEntry of selectedSnapshots) {
    const snapshotPath = path.join(snapshotDir, snapshotEntry.file);
    // eslint-disable-next-line no-console
    console.log(`\nLoading snapshot: ${snapshotEntry.file}`);

    try {
      const adapter = new EbaySnapshotAdapter({
        snapshotDir,
        file: snapshotEntry.file,
      });

      // We ignore the keywords here; the snapshot adapter will return the cached items.
      const result = await captureService.captureFromMarketplace(adapter, []);

      // Load enriched data if available
      let enrichedCount = 0;
      const snapshotRaw = await fs.readFile(snapshotPath, 'utf8');
      const snapshot = JSON.parse(snapshotRaw) as EbaySnapshotFile;

      if (snapshot.enrichedItems && Object.keys(snapshot.enrichedItems).length > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `  Loading enriched data for ${Object.keys(snapshot.enrichedItems).length} items...`
        );

        // Get all listings that were just created/updated
        const { data: listings, error: listingsError } = await supabaseServer
          .schema('pipeline')
          .from('listings')
          .select('id, external_id')
          .eq('marketplace', 'ebay')
          .in('external_id', Object.keys(snapshot.enrichedItems));

        if (listingsError) {
          // eslint-disable-next-line no-console
          console.warn(`  Warning: Failed to query listings: ${listingsError.message}`);
        } else if (listings) {
          // Create a map of external_id -> listing_id
          const externalIdToListingId = new Map<string, string>();
          for (const listing of listings) {
            externalIdToListingId.set(listing.external_id, listing.id);
          }

          // Process each enriched item
          for (const [itemId, enrichedResponse] of Object.entries(
            snapshot.enrichedItems
          )) {
            const listingId = externalIdToListingId.get(itemId);
            if (!listingId) {
              // Listing not found, skip
              continue;
            }

            try {
              // Store raw enriched response
              const { data: rawListing, error: rawError } = await supabaseServer
                .schema('pipeline')
                .from('raw_listings')
                .insert({
                  marketplace: 'ebay',
                  api_response: enrichedResponse as Json,
                })
                .select('id')
                .single();

              if (rawError || !rawListing) {
                // eslint-disable-next-line no-console
                console.warn(
                  `  Warning: Failed to store enriched raw listing for ${itemId}: ${rawError?.message || 'No ID returned'}`
                );
                continue;
              }

              // Extract enrichment fields
              const extractedFields = extractEnrichmentFields(
                enrichedResponse as Record<string, unknown>
              );

              // Update listing with enriched data
              const { error: updateError } = await supabaseServer
                .schema('pipeline')
                .from('listings')
                .update({
                  ...extractedFields,
                  enriched_at: new Date().toISOString(),
                  enriched_raw_listing_id: rawListing.id,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', listingId);

              if (updateError) {
                // eslint-disable-next-line no-console
                console.warn(
                  `  Warning: Failed to update listing ${listingId}: ${updateError.message}`
                );
              } else {
                enrichedCount++;
              }
            } catch (error) {
              // eslint-disable-next-line no-console
              console.warn(
                `  Warning: Error processing enriched item ${itemId}:`,
                error instanceof Error ? error.message : error
              );
            }
          }
        }
      }

      results.push({
        file: snapshotEntry.file,
        profile: snapshotEntry.profile,
        result,
        enrichedCount,
      });

      // eslint-disable-next-line no-console
      console.log(
        `  ✓ ${snapshotEntry.profile}: ${result.listings_new} new, ${result.listings_updated} updated, ${result.listings_found} total${enrichedCount > 0 ? `, ${enrichedCount} enriched` : ''}`
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `  ✗ Error loading ${snapshotEntry.file}:`,
        error instanceof Error ? error.message : error
      );
      results.push({
        file: snapshotEntry.file,
        profile: snapshotEntry.profile,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log('\n=== Summary ===');
  const successful = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  // eslint-disable-next-line no-console
  console.log(`Successfully loaded: ${successful.length}`);
  if (failed.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Failed: ${failed.length}`);
    for (const fail of failed) {
      // eslint-disable-next-line no-console
      console.log(`  - ${fail.file}: ${fail.error}`);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();


