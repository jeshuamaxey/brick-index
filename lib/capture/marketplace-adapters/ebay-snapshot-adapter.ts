import fs from 'node:fs/promises';
import path from 'node:path';

import type { Marketplace, Listing } from '@/lib/types';
import type { MarketplaceAdapter } from './base-adapter';
import {
  EbayAdapter,
  type EbaySearchParams,
} from './ebay-adapter';

type SnapshotMode = 'normal' | 'empty' | 'error';

/**
 * Snapshot file format for cached eBay API responses.
 * This type is shared between the fetch script and the adapter.
 */
export interface EbaySnapshotFile {
  profile: string;
  mode: SnapshotMode;
  keywords: string[];
  params?: EbaySearchParams;
  createdAt: string;
  items: Record<string, unknown>[];
  /**
   * Populated when mode === 'empty' and the live API actually returned items.
   * Useful for understanding how many results were discarded to force an empty case.
   */
  originalItemCount?: number;
  /**
   * Populated when mode === 'error' to simulate an API error without calling eBay.
   */
  error?: {
    code: string;
    message: string;
  };
}

interface SnapshotIndexEntry {
  file: string;
  profile: string;
  mode: SnapshotMode;
  createdAt: string;
  keywords: string[];
}

interface SnapshotIndex {
  snapshots: SnapshotIndexEntry[];
}

const DEFAULT_SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'ebay-snapshots');
const SNAPSHOT_INDEX_FILE = '_index.json';

interface EbaySnapshotAdapterConfig {
  snapshotDir?: string;
  /**
   * Optional profile name to prefer when selecting snapshots.
   * If not provided, the newest snapshot entry in the index will be used.
   */
  profile?: string;
  /**
   * Optional explicit snapshot file name to load.
   * Takes precedence over `profile` if provided.
   */
  file?: string;
}

export class EbaySnapshotAdapter implements MarketplaceAdapter {
  private snapshotDir: string;
  private preferredProfile?: string;
  private preferredFile?: string;
  private initialized = false;
  private items: Record<string, unknown>[] = [];
  private mode: SnapshotMode = 'normal';
  private errorInfo:
    | {
        code: string;
        message: string;
      }
    | null = null;

  private transformer: EbayAdapter;

  constructor(config: EbaySnapshotAdapterConfig = {}) {
    this.snapshotDir =
      config.snapshotDir ??
      process.env.EBAY_SNAPSHOT_DIR ??
      DEFAULT_SNAPSHOT_DIR;
    this.preferredProfile =
      config.profile ?? process.env.EBAY_SNAPSHOT_PROFILE;
    this.preferredFile = config.file ?? process.env.EBAY_SNAPSHOT_FILE;

    // We only use EbayAdapter for its pure transform methods; the app ID and OAuth token
    // are irrelevant since we never make API calls. Pass dummy values to satisfy constructor.
    this.transformer = new EbayAdapter('SNAPSHOT_MODE', 'dummy-token-not-used');
  }

  getMarketplace(): Marketplace {
    return 'ebay';
  }

  async searchListings(
    _keywords: string[]
  ): Promise<Record<string, unknown>[]> {
    await this.ensureInitialized();

    if (this.errorInfo) {
      throw new Error(
        `Simulated eBay API error from snapshot: ${this.errorInfo.code} - ${this.errorInfo.message}`
      );
    }

    // For now we ignore the incoming keywords and just return the cached items.
    // If you want to simulate keyword-dependent behaviour, you can extend the
    // snapshot format to include multiple keyword groups and filter here.
    return this.items;
  }

  transformToListing(
    rawResponse: Record<string, unknown>,
    rawListingId: string
  ): Listing {
    return this.transformer.transformToListing(rawResponse, rawListingId);
  }

  async isListingActive(_externalId: string): Promise<boolean> {
    // Snapshot data is static; treat listings as active for now.
    return true;
  }

  private async ensureInitialized() {
    if (this.initialized) return;

    const index = await this.readSnapshotIndex();
    const selected = await this.selectSnapshotEntry(index);

    if (!selected) {
      throw new Error(
        `No eBay snapshot files found in ${this.snapshotDir}. Run the fetch-ebay-snapshot script first.`
      );
    }

    const filePath = path.join(this.snapshotDir, selected.file);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as EbaySnapshotFile;

    this.mode = parsed.mode;
    this.items = parsed.items ?? [];
    this.errorInfo = parsed.error ?? null;

    this.initialized = true;
  }

  private async readSnapshotIndex(): Promise<SnapshotIndex> {
    const indexPath = path.join(this.snapshotDir, SNAPSHOT_INDEX_FILE);
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

  private async selectSnapshotEntry(
    index: SnapshotIndex
  ): Promise<SnapshotIndexEntry | null> {
    if (this.preferredFile) {
      const fromIndex = index.snapshots.find(
        (s) => s.file === this.preferredFile
      );
      if (fromIndex) return fromIndex;

      // If it's not registered in the index yet, fall back to the raw file.
      const explicitPath = path.join(this.snapshotDir, this.preferredFile);
      try {
        await fs.access(explicitPath);
        return {
          file: this.preferredFile,
          profile: 'unknown',
          mode: 'normal',
          createdAt: new Date().toISOString(),
          keywords: [],
        };
      } catch {
        return null;
      }
    }

    if (this.preferredProfile) {
      const matches = index.snapshots
        .filter((s) => s.profile === this.preferredProfile)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      if (matches.length > 0) {
        return matches[0];
      }
    }

    if (index.snapshots.length === 0) {
      return null;
    }

    // Default: newest snapshot overall.
    const sorted = [...index.snapshots].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return sorted[0];
  }
}


