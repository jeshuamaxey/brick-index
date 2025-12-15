// Load environment variables from .env.local or .env FIRST
// This must happen before any imports that depend on env vars
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

import fs from 'node:fs/promises';

// Type-only import (doesn't execute module code)
import type { EbaySnapshotFile } from '../lib/capture/marketplace-adapters/ebay-snapshot-adapter';

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

      results.push({
        file: snapshotEntry.file,
        profile: snapshotEntry.profile,
        result,
      });

      // eslint-disable-next-line no-console
      console.log(
        `  ✓ ${snapshotEntry.profile}: ${result.listings_new} new, ${result.listings_updated} updated, ${result.listings_found} total`
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


