// Load environment variables from .env.local or .env
import { config } from 'dotenv';
import fs from 'node:fs/promises';
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

import {
  EbayAdapter,
  type EbaySearchParams,
} from '../lib/capture/marketplace-adapters/ebay-adapter';
import type { EbaySnapshotFile } from '../lib/capture/marketplace-adapters/ebay-snapshot-adapter';

type SnapshotMode = 'normal' | 'empty' | 'error';

interface SnapshotProfileConfig {
  name: string;
  keywords: string[];
  params?: EbaySearchParams;
  mode?: SnapshotMode;
}

interface SnapshotIndexEntry {
  file: string;
  profile: string;
  mode: SnapshotMode;
  createdAt: string;
  keywords: string[];
  itemCount: number;
}

interface SnapshotIndex {
  snapshots: SnapshotIndexEntry[];
}

const DEFAULT_SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'ebay-snapshots');
const SNAPSHOT_INDEX_FILE = '_index.json';

/**
 * Default profiles that try to capture a range of behaviours:
 * - high-volume results
 * - niche / filtered results
 * - a forced-empty successful response
 * - a synthetic error case
 *
 * You can edit these or add more as needed.
 */
const DEFAULT_PROFILES: SnapshotProfileConfig[] = [
  {
    name: 'broad-bulk-lots',
    keywords: ['lego bulk', 'lego job lot', 'lego lot'],
    params: {
      entriesPerPage: 200, // Maximum per page
      maxResults: 10000, // Maximum total results
      enablePagination: true, // Always enabled
      fieldgroups: 'EXTENDED', // Maximum data
      listingTypes: ['AuctionWithBIN', 'FixedPrice'],
      hideDuplicateItems: true,
    },
    mode: 'normal',
  },
  {
    name: 'niche-star-wars',
    keywords: ['lego star wars bulk lot'],
    params: {
      entriesPerPage: 200, // Maximum per page
      maxResults: 10000, // Maximum total results
      enablePagination: true, // Always enabled
      fieldgroups: 'EXTENDED', // Maximum data
      // Example category ID for LEGO; adjust to real IDs as desired.
      categoryId: '183447',
    },
    mode: 'normal',
  },
  {
    name: 'forced-empty',
    keywords: ['lego bulk asdfghjklqwerty'], // Intentionally odd to reduce chance of matches
    params: {
      entriesPerPage: 200, // Maximum per page
      maxResults: 10000, // Maximum total results
      enablePagination: true, // Always enabled
      fieldgroups: 'EXTENDED', // Maximum data
    },
    mode: 'empty',
  },
  {
    name: 'simulated-error',
    keywords: [],
    mode: 'error',
  },
];

async function ensureDirExists(dir: string) {
  await fs.mkdir(dir, { recursive: true });
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

function parseProfilesFromArgs(): SnapshotProfileConfig[] {
  // For now, we keep this simple:
  // - If `--profile=name` is passed, only run that profile (if it exists)
  // - Otherwise, run all DEFAULT_PROFILES
  const args = process.argv.slice(2);
  const profileArgPrefix = '--profile=';
  const profileArg = args.find((arg) => arg.startsWith(profileArgPrefix));

  if (!profileArg) {
    return DEFAULT_PROFILES;
  }

  const profileName = profileArg.slice(profileArgPrefix.length);
  const profile = DEFAULT_PROFILES.find((p) => p.name === profileName);
  if (!profile) {
    // eslint-disable-next-line no-console
    console.error(
      `Profile "${profileName}" not found. Available profiles: ${DEFAULT_PROFILES.map(
        (p) => p.name
      ).join(', ')}`
    );
    process.exitCode = 1;
    return [];
  }

  return [profile];
}

async function createSnapshotForProfile(
  adapter: EbayAdapter,
  profile: SnapshotProfileConfig,
  snapshotDir: string
): Promise<SnapshotIndexEntry | null> {
  const mode: SnapshotMode = profile.mode ?? 'normal';
  const createdAt = new Date().toISOString();

  let fileData: EbaySnapshotFile;

  if (mode === 'error') {
    // Synthetic error – do not call eBay at all
    fileData = {
      profile: profile.name,
      mode,
      keywords: profile.keywords,
      params: profile.params,
      createdAt,
      items: [],
      error: {
        code: 'SIMULATED_EBAY_ERROR',
        message:
          'This snapshot simulates an eBay API error response for testing.',
      },
    };
  } else {
    const items = await adapter.searchListings(
      profile.keywords,
      profile.params
    );

    if (mode === 'empty') {
      // Force an empty-success case, but record how many we actually saw.
      fileData = {
        profile: profile.name,
        mode,
        keywords: profile.keywords,
        params: profile.params,
        createdAt,
        items: [],
        originalItemCount: items.length,
      };
    } else {
      fileData = {
        profile: profile.name,
        mode,
        keywords: profile.keywords,
        params: profile.params,
        createdAt,
        items,
      };
    }
  }

  const safeProfileName = profile.name.replace(/[^a-zA-Z0-9-_]/g, '_');
  const timestamp = createdAt.replace(/[:.]/g, '-');
  const fileName = `${safeProfileName}-${timestamp}.json`;
  const filePath = path.join(snapshotDir, fileName);

  await fs.writeFile(filePath, JSON.stringify(fileData, null, 2), 'utf8');

  // Determine item count for the index
  const itemCount =
    mode === 'error'
      ? 0
      : mode === 'empty'
        ? fileData.originalItemCount ?? 0
        : fileData.items.length;

  return {
    file: fileName,
    profile: profile.name,
    mode,
    createdAt,
    keywords: profile.keywords,
    itemCount,
  };
}

async function main() {
  const ebayAppId = process.env.EBAY_APP_ID;
  if (!ebayAppId) {
    // eslint-disable-next-line no-console
    console.error(
      'EBAY_APP_ID is required to fetch live snapshot data. Set it in your environment before running this script.'
    );
    process.exitCode = 1;
    return;
  }

  const snapshotDir =
    process.env.EBAY_SNAPSHOT_DIR ?? DEFAULT_SNAPSHOT_DIR;

  await ensureDirExists(snapshotDir);

  // OAuth token will be fetched automatically by EbayAdapter
  const adapter = new EbayAdapter(ebayAppId);
  const profiles = parseProfilesFromArgs();

  if (profiles.length === 0) return;

  // eslint-disable-next-line no-console
  console.log(
    `Creating eBay snapshots in ${snapshotDir} for profiles: ${profiles
      .map((p) => p.name)
      .join(', ')}`
  );

  const index = await readSnapshotIndex(snapshotDir);

  for (const profile of profiles) {
    try {
      // eslint-disable-next-line no-console
      console.log(`Fetching snapshot for profile "${profile.name}"...`);
      const entry = await createSnapshotForProfile(
        adapter,
        profile,
        snapshotDir
      );
      if (entry) {
        index.snapshots.push(entry);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `Error creating snapshot for profile "${profile.name}":`,
        error
      );
      process.exitCode = 1;
    }
  }

  await writeSnapshotIndex(snapshotDir, index);

  // eslint-disable-next-line no-console
  console.log('Snapshot creation complete.');
}

// Execute only when run directly via node/ts-node
// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();


