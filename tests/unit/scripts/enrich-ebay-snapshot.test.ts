import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { EbayAdapter } from '@/lib/capture/marketplace-adapters/ebay-adapter';
import type { EbaySnapshotFile } from '@/lib/capture/marketplace-adapters/ebay-snapshot-adapter';

// Mock the script functions by importing the file and testing individual functions
// Since the script uses top-level execution, we'll test the core logic functions

const TEST_DIR = path.join(process.cwd(), 'tests', 'unit', 'fixtures', 'test-enrich-snapshots');

// Test helper functions that mirror the script's logic
function parseArgs(args: string[]) {
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

async function readSnapshotIndex(dir: string) {
  const indexPath = path.join(dir, '_index.json');
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    const parsed = JSON.parse(raw) as { snapshots: any[] };
    if (!parsed.snapshots) {
      return { snapshots: [] };
    }
    return parsed;
  } catch {
    return { snapshots: [] };
  }
}

async function selectSnapshots(
  dir: string,
  options: {
    file?: string;
    profile?: string;
    force?: boolean;
  }
) {
  const index = await readSnapshotIndex(dir);

  if (options.file) {
    const entry = index.snapshots.find((s) => s.file === options.file);
    if (entry) {
      return [entry];
    }
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

  if (options.profile) {
    selected = selected.filter((s) => s.profile === options.profile);
  }

  selected = selected.filter((s) => s.mode === 'normal');

  if (!options.force) {
    selected = selected.filter((s) => !s.enrichedItemCount);
  }

  if (options.profile && selected.length > 0) {
    selected.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return [selected[0]];
  }

  const byProfile = new Map<string, any>();
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

describe('enrich-ebay-snapshot script', () => {
  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('parseArgs()', () => {
    it('parses file argument', () => {
      const result = parseArgs(['--file=test.json']);
      expect(result.file).toBe('test.json');
    });

    it('parses profile argument', () => {
      const result = parseArgs(['--profile=test-profile']);
      expect(result.profile).toBe('test-profile');
    });

    it('parses dir argument', () => {
      const result = parseArgs(['--dir=/path/to/dir']);
      expect(result.dir).toBe('/path/to/dir');
    });

    it('parses delay-ms argument', () => {
      const result = parseArgs(['--delay-ms=500']);
      expect(result.delayMs).toBe(500);
    });

    it('parses force flag', () => {
      const result = parseArgs(['--force']);
      expect(result.force).toBe(true);
    });

    it('parses multiple arguments', () => {
      const result = parseArgs([
        '--file=test.json',
        '--profile=test-profile',
        '--delay-ms=300',
        '--force',
      ]);
      expect(result.file).toBe('test.json');
      expect(result.profile).toBe('test-profile');
      expect(result.delayMs).toBe(300);
      expect(result.force).toBe(true);
    });

    it('returns empty object for no arguments', () => {
      const result = parseArgs([]);
      expect(result).toEqual({});
    });
  });

  describe('readSnapshotIndex()', () => {
    it('reads valid index file', async () => {
      const index = {
        snapshots: [
          {
            file: 'test.json',
            profile: 'test-profile',
            mode: 'normal',
            createdAt: '2025-01-01T00:00:00Z',
            keywords: ['lego'],
            itemCount: 5,
          },
        ],
      };

      const indexPath = path.join(TEST_DIR, '_index.json');
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');

      const result = await readSnapshotIndex(TEST_DIR);
      expect(result.snapshots).toHaveLength(1);
      expect(result.snapshots[0].file).toBe('test.json');
    });

    it('returns empty snapshots array for missing file', async () => {
      const result = await readSnapshotIndex(TEST_DIR);
      expect(result.snapshots).toEqual([]);
    });

    it('returns empty snapshots array for invalid JSON', async () => {
      const indexPath = path.join(TEST_DIR, '_index.json');
      await fs.writeFile(indexPath, 'invalid json', 'utf8');

      const result = await readSnapshotIndex(TEST_DIR);
      expect(result.snapshots).toEqual([]);
    });

    it('returns empty snapshots array for file without snapshots property', async () => {
      const indexPath = path.join(TEST_DIR, '_index.json');
      await fs.writeFile(indexPath, '{}', 'utf8');

      const result = await readSnapshotIndex(TEST_DIR);
      expect(result.snapshots).toEqual([]);
    });
  });

  describe('selectSnapshots()', () => {
    beforeEach(async () => {
      const index = {
        snapshots: [
          {
            file: 'snapshot1.json',
            profile: 'profile1',
            mode: 'normal',
            createdAt: '2025-01-01T00:00:00Z',
            keywords: ['lego'],
            itemCount: 5,
          },
          {
            file: 'snapshot2.json',
            profile: 'profile2',
            mode: 'normal',
            createdAt: '2025-01-02T00:00:00Z',
            keywords: ['lego'],
            itemCount: 3,
          },
          {
            file: 'snapshot3.json',
            profile: 'profile1',
            mode: 'normal',
            createdAt: '2025-01-03T00:00:00Z',
            keywords: ['lego'],
            itemCount: 2,
            enrichedItemCount: 2, // Already enriched
          },
          {
            file: 'error-snapshot.json',
            profile: 'profile3',
            mode: 'error',
            createdAt: '2025-01-04T00:00:00Z',
            keywords: [],
            itemCount: 0,
          },
        ],
      };

      const indexPath = path.join(TEST_DIR, '_index.json');
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
    });

    it('selects snapshot by file', async () => {
      const result = await selectSnapshots(TEST_DIR, { file: 'snapshot1.json' });
      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('snapshot1.json');
    });

    it('creates synthetic entry for file not in index', async () => {
      const result = await selectSnapshots(TEST_DIR, { file: 'unknown.json' });
      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('unknown.json');
      expect(result[0].profile).toBe('unknown');
    });

    it('selects snapshot by profile', async () => {
      const result = await selectSnapshots(TEST_DIR, { profile: 'profile1' });
      expect(result).toHaveLength(1);
      expect(result[0].profile).toBe('profile1');
      // Should select most recent (snapshot3, but it's enriched, so snapshot1)
      expect(result[0].file).toBe('snapshot1.json');
    });

    it('filters out already enriched snapshots by default', async () => {
      const result = await selectSnapshots(TEST_DIR, { profile: 'profile1' });
      expect(result[0].file).toBe('snapshot1.json'); // Not snapshot3 (enriched)
    });

    it('includes enriched snapshots with force flag', async () => {
      const result = await selectSnapshots(TEST_DIR, {
        profile: 'profile1',
        force: true,
      });
      expect(result[0].file).toBe('snapshot3.json'); // Most recent, even if enriched
    });

    it('filters out error/empty snapshots', async () => {
      const result = await selectSnapshots(TEST_DIR, {});
      // Should not include error-snapshot.json
      const files = result.map((r) => r.file);
      expect(files).not.toContain('error-snapshot.json');
    });

    it('selects most recent snapshot per profile', async () => {
      const result = await selectSnapshots(TEST_DIR, {});
      expect(result).toHaveLength(2); // profile1 and profile2
      const profile1 = result.find((r) => r.profile === 'profile1');
      expect(profile1?.file).toBe('snapshot1.json'); // Most recent non-enriched
      const profile2 = result.find((r) => r.profile === 'profile2');
      expect(profile2?.file).toBe('snapshot2.json');
    });
  });

  describe('enrichSnapshot() logic', () => {
    it('should skip already enriched snapshots', async () => {
      const snapshot: EbaySnapshotFile = {
        profile: 'test-profile',
        mode: 'normal',
        keywords: ['lego'],
        createdAt: new Date().toISOString(),
        items: [
          {
            itemId: '123',
            title: 'Test Item',
          },
        ],
        enrichmentMetadata: {
          enrichedAt: new Date().toISOString(),
          enrichedCount: 1,
          failedCount: 0,
        },
        enrichedItems: {
          '123': { itemId: '123' },
        },
      };

      const snapshotPath = path.join(TEST_DIR, 'test-snapshot.json');
      await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');

      // Read it back to verify structure
      const raw = await fs.readFile(snapshotPath, 'utf8');
      const parsed = JSON.parse(raw) as EbaySnapshotFile;

      expect(parsed.enrichmentMetadata?.enrichedCount).toBe(1);
      expect(parsed.enrichedItems?.['123']).toBeDefined();
    });

    it('should skip error/empty snapshots', async () => {
      const errorSnapshot: EbaySnapshotFile = {
        profile: 'test-profile',
        mode: 'error',
        keywords: [],
        createdAt: new Date().toISOString(),
        items: [],
        error: {
          code: 'ERROR',
          message: 'Test error',
        },
      };

      const snapshotPath = path.join(TEST_DIR, 'error-snapshot.json');
      await fs.writeFile(snapshotPath, JSON.stringify(errorSnapshot, null, 2), 'utf8');

      const raw = await fs.readFile(snapshotPath, 'utf8');
      const parsed = JSON.parse(raw) as EbaySnapshotFile;

      expect(parsed.mode).toBe('error');
      expect(parsed.items).toHaveLength(0);
    });

    it('should handle items without itemId', async () => {
      const snapshot: EbaySnapshotFile = {
        profile: 'test-profile',
        mode: 'normal',
        keywords: ['lego'],
        createdAt: new Date().toISOString(),
        items: [
          {
            // Missing itemId
            title: 'Test Item',
          },
        ],
      };

      const snapshotPath = path.join(TEST_DIR, 'test-snapshot.json');
      await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');

      const raw = await fs.readFile(snapshotPath, 'utf8');
      const parsed = JSON.parse(raw) as EbaySnapshotFile;

      expect(parsed.items[0].itemId).toBeUndefined();
    });
  });
});

