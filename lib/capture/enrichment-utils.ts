// Shared utilities for enrichment field extraction
// Used by both enrich-job and materialize-listings-job

interface EbayGetItemResponse {
  itemId?: string;
  description?: string;
  additionalImages?: Array<{ imageUrl?: string }>;
  conditionDescription?: string;
  categoryPath?: string;
  itemLocation?: {
    city?: string;
    stateOrProvince?: string;
    postalCode?: string;
    country?: string;
  };
  estimatedAvailabilities?: Array<{
    estimatedAvailabilityStatus?: string;
    estimatedAvailableQuantity?: number;
    estimatedSoldQuantity?: number;
    estimatedRemainingQuantity?: number;
  }>;
  buyingOptions?: string[];
  [key: string]: unknown;
}

/**
 * Extract enrichment fields from eBay getItem API response
 * This function extracts fields that should be populated in the listings table
 * during materialisation when enrichment data is available.
 */
export function extractEnrichmentFields(
  response: EbayGetItemResponse | Record<string, unknown>
): Record<string, unknown> {
  const ebayResponse = response as EbayGetItemResponse;
  const fields: Record<string, unknown> = {};

  // Description
  if (ebayResponse.description !== undefined) {
    fields.description = ebayResponse.description;
  }

  // Additional images
  if (ebayResponse.additionalImages && Array.isArray(ebayResponse.additionalImages)) {
    fields.additional_images = ebayResponse.additionalImages
      .map((img) => img.imageUrl)
      .filter((url): url is string => typeof url === 'string');
  } else {
    fields.additional_images = [];
  }

  // Condition description
  if (ebayResponse.conditionDescription !== undefined) {
    fields.condition_description = ebayResponse.conditionDescription;
  }

  // Category path
  if (ebayResponse.categoryPath !== undefined) {
    fields.category_path = ebayResponse.categoryPath;
  }

  // Item location
  if (ebayResponse.itemLocation) {
    fields.item_location = {
      city: ebayResponse.itemLocation.city,
      stateOrProvince: ebayResponse.itemLocation.stateOrProvince,
      postalCode: ebayResponse.itemLocation.postalCode,
      country: ebayResponse.itemLocation.country,
    };
  }

  // Estimated availabilities
  if (
    ebayResponse.estimatedAvailabilities &&
    Array.isArray(ebayResponse.estimatedAvailabilities)
  ) {
    fields.estimated_availabilities = ebayResponse.estimatedAvailabilities.map(
      (avail) => ({
        estimatedAvailabilityStatus: avail.estimatedAvailabilityStatus,
        estimatedAvailableQuantity: avail.estimatedAvailableQuantity,
        estimatedSoldQuantity: avail.estimatedSoldQuantity,
        estimatedRemainingQuantity: avail.estimatedRemainingQuantity,
      })
    );
  }

  // Buying options
  if (ebayResponse.buyingOptions && Array.isArray(ebayResponse.buyingOptions)) {
    fields.buying_options = ebayResponse.buyingOptions;
  } else {
    fields.buying_options = [];
  }

  return fields;
}
