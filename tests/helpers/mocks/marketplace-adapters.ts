// Shared mocks for marketplace adapters

import { vi } from 'vitest';
import type { MarketplaceAdapter } from '@/lib/capture/marketplace-adapters/base-adapter';

/**
 * Creates a mock marketplace adapter for testing
 */
export function createMockMarketplaceAdapter(): MarketplaceAdapter {
  return {
    getMarketplace: vi.fn().mockReturnValue('ebay'),
    search: vi.fn().mockResolvedValue([]),
    getItemDetails: vi.fn().mockResolvedValue(null),
  } as unknown as MarketplaceAdapter;
}

