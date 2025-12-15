// Load environment variables from .env.local or .env
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

// Override EBAY_ENVIRONMENT to ensure we always fetch from production
process.env.EBAY_ENVIRONMENT = 'production';
process.env.EBAY_APP_ID = process.env.PROD_EBAY_APP_ID;
// EBAY_CLIENT_SECRET should be set from PROD_EBAY_CLIENT_SECRET if needed
if (process.env.PROD_EBAY_CLIENT_SECRET) {
  process.env.EBAY_CLIENT_SECRET = process.env.PROD_EBAY_CLIENT_SECRET;
}

import fs from 'node:fs/promises';

import { EbayAdapter } from '../lib/capture/marketplace-adapters/ebay-adapter';
import type { EbaySnapshotFile } from '../lib/capture/marketplace-adapters/ebay-snapshot-adapter';

interface SnapshotIndexEntry {
  file: string;
  profile: string;
  mode: 'normal' | 'empty' | 'error';
  createdAt: string;
  keywords: string[];
  itemCount: number;
  enrichedItemCount?: number;
}

interface SnapshotIndex {
  snapshots: SnapshotIndexEntry[];
}

const DEFAULT_SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'ebay-snapshots');
const SNAPSHOT_INDEX_FILE = '_index.json';
const DEFAULT_DELAY_MS = 200;

function parseArgs() {
  const args = process.argv.slice(2);
  const result: {
    file?: string;
    profile?: string;
    dir?: string;
    delayMs?: number;
    force?: boolean;
  } = {};

  for (const arg of args) {
    if (arg.startsWith('--file=')) {
      result.file = arg.slice('--file='.length);
    } else if (arg.startsWith('--profile=')) {
      result.profile = arg.slice('--profile='.length);
    } else if (arg.startsWith('--dir=')) {
      result.dir = arg.slice('--dir='.length);
    } else if (arg.startsWith('--delay-ms=')) {
      result.delayMs = parseInt(arg.slice('--delay-ms='.length), 10);
    } else if (arg === '--force') {
      result.force = true;
    }
  }

  return result;
}

async function readSnapshotIndex(dir: string): Promise<SnapshotIndex> {
  const indexPath = path.join(dir, SNAPSHOT_INDEX_FILE);
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    const parsed = JSON.parse(raw) as SnapshotIndex;
    if (!parsed.snapshots) {
      return { snapshots: [] };
    }
    return parsed;
  } catch {
    return { snapshots: [] };
  }
}

async function writeSnapshotIndex(dir: string, index: SnapshotIndex) {
  const indexPath = path.join(dir, SNAPSHOT_INDEX_FILE);
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
}

async function selectSnapshots(
  dir: string,
  options: {
    file?: string;
    profile?: string;
    force?: boolean;
  }
): Promise<SnapshotIndexEntry[]> {
  const index = await readSnapshotIndex(dir);

  if (options.file) {
    // Explicit file specified
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

  let selected = [...index.snapshots];

  // Filter by profile if specified
  if (options.profile) {
    selected = selected.filter((s) => s.profile === options.profile);
  }

  // Filter out empty/error snapshots (they don't have items to enrich)
  selected = selected.filter((s) => s.mode === 'normal');

  // Filter out already enriched snapshots unless --force is used
  if (!options.force) {
    selected = selected.filter((s) => !s.enrichedItemCount);
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

async function enrichSnapshot(
  adapter: EbayAdapter,
  snapshotPath: string,
  delayMs: number
): Promise<{ enrichedCount: number; failedCount: number }> {
  const raw = await fs.readFile(snapshotPath, 'utf8');
  const snapshot = JSON.parse(raw) as EbaySnapshotFile;

  // Skip if already enriched (unless we're forcing)
  if (
    snapshot.enrichmentMetadata &&
    snapshot.enrichmentMetadata.enrichedCount > 0
  ) {
    // eslint-disable-next-line no-console
    console.log(
      `  Snapshot already enriched (${snapshot.enrichmentMetadata.enrichedCount} items). Use --force to re-enrich.`
    );
    return {
      enrichedCount: snapshot.enrichmentMetadata.enrichedCount,
      failedCount: snapshot.enrichmentMetadata.failedCount,
    };
  }

  // Skip error/empty snapshots
  if (snapshot.mode !== 'normal' || snapshot.items.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`  Skipping ${snapshot.mode} snapshot (no items to enrich)`);
    return { enrichedCount: 0, failedCount: 0 };
  }

  // Initialize enrichedItems if not present
  if (!snapshot.enrichedItems) {
    snapshot.enrichedItems = {};
  }

  let enrichedCount = 0;
  let failedCount = 0;

  // Enrich each item
  for (let i = 0; i < snapshot.items.length; i++) {
    const item = snapshot.items[i];
    const itemId = (item.itemId as string) || (item.itemId as string[])?.[0];

    if (!itemId) {
      // eslint-disable-next-line no-console
      console.warn(`  Item ${i + 1} has no itemId, skipping`);
      failedCount++;
      continue;
    }

    // Skip if already enriched
    if (snapshot.enrichedItems[itemId]) {
      enrichedCount++;
      continue;
    }

    try {
      // Add delay between API calls (except for the first one)
      if (i > 0 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      // Call getItemDetails API
      const enrichedResponse = await adapter.getItemDetails(itemId);
      snapshot.enrichedItems[itemId] = enrichedResponse;
      enrichedCount++;

      // eslint-disable-next-line no-console
      console.log(
        `  Enriched item ${i + 1}/${snapshot.items.length}: ${itemId}`
      );
    } catch (error) {
      failedCount++;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      // eslint-disable-next-line no-console
      console.error(
        `  Failed to enrich item ${i + 1}/${snapshot.items.length} (${itemId}): ${errorMessage}`
      );
    }
  }

  // Update enrichment metadata
  snapshot.enrichmentMetadata = {
    enrichedAt: new Date().toISOString(),
    enrichedCount,
    failedCount,
  };

  // Write updated snapshot back to file
  await fs.writeFile(
    snapshotPath,
    JSON.stringify(snapshot, null, 2),
    'utf8'
  );

  return { enrichedCount, failedCount };
}

async function main() {
  const ebayAppId = process.env.EBAY_APP_ID;
  const ebayClientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!ebayAppId || !ebayClientSecret) {
    // eslint-disable-next-line no-console
    console.error(
      'EBAY_APP_ID and EBAY_CLIENT_SECRET are required to enrich snapshots. Set them in your environment before running this script.'
    );
    process.exitCode = 1;
    return;
  }

  const options = parseArgs();
  const snapshotDir =
    options.dir ?? process.env.EBAY_SNAPSHOT_DIR ?? DEFAULT_SNAPSHOT_DIR;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;

  // Check if snapshot directory exists
  try {
    await fs.access(snapshotDir);
  } catch {
    // eslint-disable-next-line no-console
    console.error(
      `Snapshot directory does not exist: ${snapshotDir}. Run fetch-ebay-snapshot first.`
    );
    process.exitCode = 1;
    return;
  }

  const selectedSnapshots = await selectSnapshots(snapshotDir, options);

  if (selectedSnapshots.length === 0) {
    // eslint-disable-next-line no-console
    console.error('No snapshots found matching the criteria.');
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    `Enriching ${selectedSnapshots.length} snapshot(s): ${selectedSnapshots
      .map((s) => `${s.profile} (${s.file})`)
      .join(', ')}`
  );
  // eslint-disable-next-line no-console
  console.log(`Delay between API calls: ${delayMs}ms\n`);

  // OAuth token will be fetched automatically by EbayAdapter
  const adapter = new EbayAdapter(ebayAppId);
  const index = await readSnapshotIndex(snapshotDir);
  const results = [];

  for (const snapshotEntry of selectedSnapshots) {
    const snapshotPath = path.join(snapshotDir, snapshotEntry.file);
    // eslint-disable-next-line no-console
    console.log(`Enriching snapshot: ${snapshotEntry.file}`);

    try {
      const { enrichedCount, failedCount } = await enrichSnapshot(
        adapter,
        snapshotPath,
        delayMs
      );

      // Update index entry
      const indexEntry = index.snapshots.find(
        (s) => s.file === snapshotEntry.file
      );
      if (indexEntry) {
        indexEntry.enrichedItemCount = enrichedCount;
      }

      results.push({
        file: snapshotEntry.file,
        profile: snapshotEntry.profile,
        enrichedCount,
        failedCount,
      });

      // eslint-disable-next-line no-console
      console.log(
        `  ✓ ${snapshotEntry.profile}: ${enrichedCount} enriched, ${failedCount} failed\n`
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `  ✗ Error enriching ${snapshotEntry.file}:`,
        error instanceof Error ? error.message : error
      );
      results.push({
        file: snapshotEntry.file,
        profile: snapshotEntry.profile,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Update index file
  await writeSnapshotIndex(snapshotDir, index);

  // eslint-disable-next-line no-console
  console.log('=== Summary ===');
  const successful = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  // eslint-disable-next-line no-console
  console.log(`Successfully enriched: ${successful.length}`);
  if (successful.length > 0) {
    for (const result of successful) {
      // eslint-disable-next-line no-console
      console.log(
        `  - ${result.file}: ${result.enrichedCount} enriched, ${result.failedCount} failed`
      );
    }
  }
  if (failed.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Failed: ${failed.length}`);
    for (const fail of failed) {
      // eslint-disable-next-line no-console
      console.log(`  - ${fail.file}: ${fail.error}`);
    }
  }
}

// Execute only when run directly via node/ts-node
// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();

