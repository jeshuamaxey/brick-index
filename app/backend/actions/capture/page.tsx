// Backend page for capture action

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useTriggerCapture } from '@/hooks/use-capture';
import { useToast } from '@/hooks/use-toast';
import { ActionPageHeader } from '@/components/backend/action-page-header';
import { InngestPayloadCard } from '@/components/backend/inngest-payload-card';
import { LegoSetSearch } from '@/components/catalog/lego-set-search';
import type { LegoSetSearchResult } from '@/hooks/use-catalog-search';
import type { EbaySearchParams } from '@/lib/capture/marketplace-adapters/ebay-adapter';

export default function CapturePage() {
  const router = useRouter();
  const { toast } = useToast();
  
  // Selected LEGO set state
  const [selectedSet, setSelectedSet] = useState<LegoSetSearchResult | null>(null);
  
  // Form state
  const [datasetName, setDatasetName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState('200');
  const [useEntriesPerPage, setUseEntriesPerPage] = useState(true);
  const [enablePagination, setEnablePagination] = useState(true);
  const [maxResults, setMaxResults] = useState('500');
  const [listingTypeFixed, setListingTypeFixed] = useState(true);
  const [listingTypeAuction, setListingTypeAuction] = useState(true);
  const [useListingTypes, setUseListingTypes] = useState(true);
  const [hideDuplicates, setHideDuplicates] = useState(true);
  const [useHideDuplicates, setUseHideDuplicates] = useState(true);
  const [categoryId, setCategoryId] = useState('220');
  const [useCategoryId, setUseCategoryId] = useState(true);
  const [marketplaceId, setMarketplaceId] = useState('');
  const [useMarketplaceId, setUseMarketplaceId] = useState(false);

  // Collapsible state
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  // Validation errors
  const [keywordsError, setKeywordsError] = useState('');
  const [entriesPerPageError, setEntriesPerPageError] = useState('');
  const [maxResultsError, setMaxResultsError] = useState('');

  const triggerCapture = useTriggerCapture();

  // Handle LEGO set selection
  const handleSetSelect = (set: LegoSetSearchResult) => {
    setSelectedSet(set);
    // Auto-populate keywords: "{set name} Lego {set number prefix}"
    const setNumPrefix = set.set_num.split('-')[0];
    const autoKeywords = `${set.name} Lego ${setNumPrefix}`;
    setKeywords(autoKeywords);
    setKeywordsError('');
    
    // Auto-populate dataset name if empty
    if (!datasetName.trim()) {
      setDatasetName(set.name);
    }
  };

  const handleSetClear = () => {
    setSelectedSet(null);
    setKeywords('');
  };

  // Generate JSON payload for Inngest
  const inngestPayload = useMemo(() => {
    const keywordArray = keywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const ebayParams: EbaySearchParams = {};

    if (useEntriesPerPage && entriesPerPage) {
      const entries = parseInt(entriesPerPage, 10);
      if (!isNaN(entries) && entries > 0) {
        ebayParams.entriesPerPage = entries;
      }
    }

    if (useListingTypes) {
      const types: string[] = [];
      if (listingTypeAuction) types.push('AuctionWithBIN');
      if (listingTypeFixed) types.push('FixedPrice');
      if (types.length > 0) {
        ebayParams.listingTypes = types;
      }
    }

    if (useHideDuplicates) {
      ebayParams.hideDuplicateItems = hideDuplicates;
    }

    if (useCategoryId && categoryId) {
      ebayParams.categoryId = categoryId;
    }

    if (useMarketplaceId && marketplaceId) {
      ebayParams.marketplaceId = marketplaceId;
    }

    ebayParams.enablePagination = enablePagination;
    if (enablePagination && maxResults) {
      const max = parseInt(maxResults, 10);
      if (!isNaN(max) && max > 0 && max <= 10000) {
        ebayParams.maxResults = max;
      }
    }

    ebayParams.fieldgroups = 'EXTENDED';

    return {
      name: 'job/capture.triggered',
      data: {
        marketplace: 'ebay',
        keywords: keywordArray.length > 0 ? keywordArray : [],
        ...(Object.keys(ebayParams).length > 0 && { ebayParams }),
        ...(datasetName.trim() && { datasetName: datasetName.trim() }),
      },
    };
  }, [keywords, datasetName, entriesPerPage, useEntriesPerPage, enablePagination, maxResults, listingTypeFixed, listingTypeAuction, useListingTypes, hideDuplicates, useHideDuplicates, categoryId, useCategoryId, marketplaceId, useMarketplaceId]);

  const populateTestData = () => {
    setKeywords('stranger things Lego');
    setEntriesPerPage('100');
    setMaxResults('100');
    setSelectedSet(null);
  };

  const validateForm = (): boolean => {
    let isValid = true;
    setKeywordsError('');
    setEntriesPerPageError('');
    setMaxResultsError('');

    // Validate keywords
    const keywordArray = keywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    
    if (keywordArray.length === 0) {
      setKeywordsError('At least one keyword is required. Select a LEGO set or enter keywords manually.');
      isValid = false;
    }

    // Validate entries per page
    if (useEntriesPerPage && entriesPerPage) {
      const entries = parseInt(entriesPerPage, 10);
      if (isNaN(entries) || entries <= 0 || entries > 200) {
        setEntriesPerPageError('Entries per page must be between 1 and 200');
        isValid = false;
      }
    }

    // Validate max results
    if (enablePagination && maxResults) {
      const max = parseInt(maxResults, 10);
      if (isNaN(max) || max <= 0 || max > 10000) {
        setMaxResultsError('Max results must be between 1 and 10000');
        isValid = false;
      }
    }

    return isValid;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    // Parse keywords
    const keywordArray = keywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    // Build eBay params object
    const ebayParams: EbaySearchParams = {};

    if (useEntriesPerPage && entriesPerPage) {
      const entries = parseInt(entriesPerPage, 10);
      if (!isNaN(entries) && entries > 0) {
        ebayParams.entriesPerPage = entries;
      }
    }

    if (useListingTypes) {
      const types: string[] = [];
      if (listingTypeAuction) types.push('AuctionWithBIN');
      if (listingTypeFixed) types.push('FixedPrice');
      if (types.length > 0) {
        ebayParams.listingTypes = types;
      }
    }

    if (useHideDuplicates) {
      ebayParams.hideDuplicateItems = hideDuplicates;
    }

    if (useCategoryId && categoryId) {
      ebayParams.categoryId = categoryId;
    }

    if (useMarketplaceId && marketplaceId) {
      ebayParams.marketplaceId = marketplaceId;
    }

    ebayParams.enablePagination = enablePagination;
    if (enablePagination && maxResults) {
      const max = parseInt(maxResults, 10);
      if (!isNaN(max) && max > 0 && max <= 10000) {
        ebayParams.maxResults = max;
      }
    }

    ebayParams.fieldgroups = 'EXTENDED';

    triggerCapture.mutate(
      {
        marketplace: 'ebay',
        keywords: keywordArray,
        ebayParams: Object.keys(ebayParams).length > 0 ? ebayParams : undefined,
        datasetName: datasetName.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Capture job started',
            description: 'The capture job has been triggered successfully.',
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/backend/resources/jobs')}
              >
                Go to Jobs
              </Button>
            ),
          });
        },
        onError: (error: Error) => {
          toast({
            title: 'Failed to trigger capture job',
            description: error.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <div className="p-8 bg-background">
      <ActionPageHeader title="Capture" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Capture</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={populateTestData}
                type="button"
              >
                Populate Test Data
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Form - Simplified */}
            <div className="space-y-4">
              {/* Dataset Name */}
              <div className="space-y-2">
                <Label htmlFor="datasetName">Dataset Name</Label>
                <Input
                  id="datasetName"
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  placeholder="e.g., Harry Potter LEGO sets"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Listings will be associated with this dataset.
                </p>
              </div>

              {/* LEGO Set Search */}
              <div className="space-y-2">
                <Label>LEGO Set</Label>
                <LegoSetSearch
                  selectedSet={selectedSet}
                  onSelect={handleSetSelect}
                  onClear={handleSetClear}
                  placeholder="Search for a LEGO set by name..."
                />
                <p className="text-xs text-muted-foreground">
                  Search and select a LEGO set to auto-populate search keywords.
                </p>
                {keywordsError && !isCustomizeOpen && (
                  <p className="text-xs text-destructive">{keywordsError}</p>
                )}
              </div>
            </div>

            {/* Customize Job - Collapsible */}
            <Collapsible
              open={isCustomizeOpen}
              onOpenChange={setIsCustomizeOpen}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="w-full flex items-center justify-between p-0 h-auto font-medium hover:bg-transparent"
                >
                  <span className="text-sm">Customize Job</span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                      isCustomizeOpen ? 'rotate-180' : ''
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 space-y-6">
                {/* Keywords (manual override) */}
                <div className="space-y-2">
                  <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                  <Input
                    id="keywords"
                    type="text"
                    value={keywords}
                    onChange={(e) => {
                      setKeywords(e.target.value);
                      setKeywordsError('');
                    }}
                    placeholder="lego bulk, lego job lot, lego lot"
                    className={keywordsError ? 'border-destructive' : ''}
                  />
                  {keywordsError && (
                    <p className="text-xs text-destructive">{keywordsError}</p>
                  )}
                  {!keywordsError && (
                    <p className="text-xs text-muted-foreground">
                      Auto-populated from LEGO set selection, or enter manually.
                    </p>
                  )}
                </div>

                <Separator />

                {/* Pagination Settings */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enablePagination"
                        checked={enablePagination}
                        onCheckedChange={(checked) => setEnablePagination(checked === true)}
                      />
                      <Label htmlFor="enablePagination" className="font-medium">Enable Pagination</Label>
                    </div>
                    {enablePagination && (
                      <div className="ml-6 space-y-2">
                        <Label htmlFor="maxResults">Max Results (1-10000)</Label>
                        <Input
                          id="maxResults"
                          type="number"
                          value={maxResults}
                          onChange={(e) => {
                            setMaxResults(e.target.value);
                            setMaxResultsError('');
                          }}
                          min="1"
                          max="10000"
                          placeholder="10000"
                          className={maxResultsError ? 'border-destructive' : ''}
                        />
                        {maxResultsError && (
                          <p className="text-xs text-destructive">{maxResultsError}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="useEntriesPerPage"
                        checked={useEntriesPerPage}
                        onCheckedChange={(checked) => setUseEntriesPerPage(checked === true)}
                      />
                      <Label htmlFor="useEntriesPerPage">Entries Per Page</Label>
                    </div>
                    {useEntriesPerPage && (
                      <div className="ml-6 space-y-2">
                        <Input
                          type="number"
                          value={entriesPerPage}
                          onChange={(e) => {
                            setEntriesPerPage(e.target.value);
                            setEntriesPerPageError('');
                          }}
                          min="1"
                          max="200"
                          placeholder="200"
                          className={entriesPerPageError ? 'border-destructive' : ''}
                        />
                        {entriesPerPageError && (
                          <p className="text-xs text-destructive">{entriesPerPageError}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Listing Types */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="useListingTypes"
                        checked={useListingTypes}
                        onCheckedChange={(checked) => setUseListingTypes(checked === true)}
                      />
                      <Label htmlFor="useListingTypes" className="font-medium">Listing Types</Label>
                    </div>
                    {useListingTypes && (
                      <div className="ml-6 space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="listingTypeFixed"
                            checked={listingTypeFixed}
                            onCheckedChange={(checked) => setListingTypeFixed(checked === true)}
                          />
                          <Label htmlFor="listingTypeFixed">FixedPrice</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="listingTypeAuction"
                            checked={listingTypeAuction}
                            onCheckedChange={(checked) => setListingTypeAuction(checked === true)}
                          />
                          <Label htmlFor="listingTypeAuction">AuctionWithBIN</Label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Optional Settings */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="useHideDuplicates"
                        checked={useHideDuplicates}
                        onCheckedChange={(checked) => setUseHideDuplicates(checked === true)}
                      />
                      <Label htmlFor="useHideDuplicates" className="font-medium">Hide Duplicate Items</Label>
                    </div>
                    {useHideDuplicates && (
                      <div className="ml-6">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="hideDuplicates"
                            checked={hideDuplicates}
                            onCheckedChange={(checked) => setHideDuplicates(checked === true)}
                          />
                          <Label htmlFor="hideDuplicates">Enabled</Label>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="useCategoryId"
                        checked={useCategoryId}
                        onCheckedChange={(checked) => setUseCategoryId(checked === true)}
                      />
                      <Label htmlFor="useCategoryId">Category ID</Label>
                    </div>
                    {useCategoryId && (
                      <div className="ml-6">
                        <Input
                          type="text"
                          value={categoryId}
                          onChange={(e) => setCategoryId(e.target.value)}
                          placeholder="220 (LEGO category)"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="useMarketplaceId"
                        checked={useMarketplaceId}
                        onCheckedChange={(checked) => setUseMarketplaceId(checked === true)}
                      />
                      <Label htmlFor="useMarketplaceId">Marketplace ID</Label>
                    </div>
                    {useMarketplaceId && (
                      <div className="ml-6">
                        <Input
                          type="text"
                          value={marketplaceId}
                          onChange={(e) => setMarketplaceId(e.target.value)}
                          placeholder="EBAY_US, EBAY_GB, etc."
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSubmit}
              disabled={triggerCapture.isPending || !keywords.trim()}
              className="w-full"
            >
              {triggerCapture.isPending ? 'Capturing...' : 'Trigger Capture'}
            </Button>
          </CardFooter>
        </Card>

        <InngestPayloadCard payload={inngestPayload} />
      </div>
    </div>
  );
}
