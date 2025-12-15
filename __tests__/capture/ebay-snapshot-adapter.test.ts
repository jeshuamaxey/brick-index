import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

import { EbaySnapshotAdapter } from '@/lib/capture/marketplace-adapters/ebay-snapshot-adapter';
import type { EbaySnapshotFile } from '@/lib/capture/marketplace-adapters/ebay-snapshot-adapter';

const TEST_SNAPSHOT_DIR = path.join(process.cwd(), 'tests', 'unit', 'fixtures', 'ebay-snapshots');

describe('EbaySnapshotAdapter', () => {
  beforeAll(async () => {
    const dir = TEST_SNAPSHOT_DIR;
    await fs.mkdir(dir, { recursive: true });

    const snapshot: EbaySnapshotFile = {
      profile: 'test-profile',
      mode: 'normal',
      keywords: ['lego bulk'],
      createdAt: new Date().toISOString(),
      items: [
        {
          itemId: ['123'],
          title: ['Test LEGO Bulk Lot'],
          viewItemURL: ['https://www.ebay.com/itm/123'],
          galleryURL: ['https://example.com/image1.jpg'],
          sellingStatus: [
            {
              currentPrice: [
                {
                  '@currencyId': 'USD',
                  __value__: '100.00',
                },
              ],
            },
          ],
          sellerInfo: [
            {
              sellerUserName: ['seller123'],
              feedbackScore: ['100'],
              positiveFeedbackPercent: ['99.0'],
            },
          ],
        },
      ],
    };

    const fileName = 'test-snapshot.json';
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8');

    const index = {
      snapshots: [
        {
          file: fileName,
          profile: 'test-profile',
          mode: 'normal' as const,
          createdAt: snapshot.createdAt,
          keywords: snapshot.keywords,
          itemCount: snapshot.items.length,
        },
      ],
    };
    await fs.writeFile(
      path.join(dir, '_index.json'),
      JSON.stringify(index, null, 2),
      'utf8'
    );
  });

  it('loads items from snapshot and transforms to Listing', async () => {
    const adapter = new EbaySnapshotAdapter({
      snapshotDir: TEST_SNAPSHOT_DIR,
      profile: 'test-profile',
    });

    const rawItems = await adapter.searchListings(['lego bulk']);
    expect(rawItems.length).toBe(1);

    const listing = adapter.transformToListing(rawItems[0], 'raw-id-1');
    expect(listing.marketplace).toBe('ebay');
    expect(listing.external_id).toBe('123');
    expect(listing.title).toBe('Test LEGO Bulk Lot');
    expect(listing.url).toContain('https://www.ebay.com/itm/123');
    expect(listing.price).toBe(100);
    expect(listing.currency).toBe('USD');
  });

  it('throws a simulated error for error-mode snapshots', async () => {
    const dir = TEST_SNAPSHOT_DIR;
    const errorSnapshot: EbaySnapshotFile = {
      profile: 'error-profile',
      mode: 'error',
      keywords: [],
      createdAt: new Date().toISOString(),
      items: [],
      error: {
        code: 'SIMULATED_EBAY_ERROR',
        message: 'Simulated error for testing',
      },
    };

    const fileName = 'error-snapshot.json';
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, JSON.stringify(errorSnapshot, null, 2), 'utf8');

    const indexPath = path.join(dir, '_index.json');
    const indexRaw = await fs.readFile(indexPath, 'utf8');
    const index = JSON.parse(indexRaw) as {
      snapshots: Array<{
        file: string;
        profile: string;
        mode: 'normal' | 'empty' | 'error';
        createdAt: string;
        keywords: string[];
        itemCount: number;
      }>;
    };

    index.snapshots.push({
      file: fileName,
      profile: 'error-profile',
      mode: 'error',
      createdAt: errorSnapshot.createdAt,
      keywords: [],
      itemCount: 0,
    });

    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');

    const adapter = new EbaySnapshotAdapter({
      snapshotDir: TEST_SNAPSHOT_DIR,
      profile: 'error-profile',
    });

    await expect(adapter.searchListings(['anything'])).rejects.toThrow(
      /Simulated eBay API error from snapshot/
    );
  });
});


