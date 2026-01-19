// Registry of Inngest function IDs and their corresponding job types
// This centralizes the mapping between Inngest functions and database job types

export const INNGEST_FUNCTION_IDS = {
  CAPTURE_JOB: 'capture-job',
  MATERIALIZE_LISTINGS_JOB: 'materialize-listings-job',
  ENRICH_JOB: 'enrich-job',
  ANALYZE_JOB: 'analyze-job',
  CATALOG_REFRESH_JOB: 'catalog-refresh-job',
  RECONCILE_JOB: 'reconcile-job',
  HANDLE_JOB_CANCELLATION: 'handle-job-cancellation',
} as const;

// Map function IDs to job types
export const FUNCTION_TO_JOB_TYPE: Record<string, string> = {
  [INNGEST_FUNCTION_IDS.CAPTURE_JOB]: 'ebay_refresh_listings',
  [INNGEST_FUNCTION_IDS.MATERIALIZE_LISTINGS_JOB]: 'ebay_materialize_listings',
  [INNGEST_FUNCTION_IDS.ENRICH_JOB]: 'ebay_enrich_listings',
  [INNGEST_FUNCTION_IDS.ANALYZE_JOB]: 'analyze_listings',
  [INNGEST_FUNCTION_IDS.CATALOG_REFRESH_JOB]: 'lego_catalog_refresh',
  [INNGEST_FUNCTION_IDS.RECONCILE_JOB]: 'reconcile',
  // handle-job-cancellation doesn't have a job type (it's a system handler)
};

/**
 * Extract the function name suffix from a full function_id
 * e.g., "brick_index_local-capture-job" -> "capture-job"
 * 
 * Matches against known function IDs from the registry.
 */
export function extractFunctionName(functionId: string): string | null {
  // Get all known function IDs (values from the registry)
  const knownFunctionIds = Object.values(INNGEST_FUNCTION_IDS);

  // Check if function_id ends with any known function ID
  for (const functionName of knownFunctionIds) {
    if (functionId.endsWith(`-${functionName}`) || functionId === functionName) {
      return functionName;
    }
  }

  // Fallback: if no match, try extracting after last hyphen (for simple cases)
  const lastHyphenIndex = functionId.lastIndexOf('-');
  if (lastHyphenIndex !== -1) {
    return functionId.substring(lastHyphenIndex + 1);
  }

  return functionId;
}

