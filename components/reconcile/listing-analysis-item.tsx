'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RegexHighlightedText } from './regex-highlighted-text';
import { Copy } from 'lucide-react';

interface ExtractedId {
  extractedId: string;
  validated: boolean;
}

interface ValidatedSet {
  legoSetId: string;
  setNum: string;
  name: string;
}

interface ListingAnalysisItemProps {
  listingId: string;
  title: string;
  description: string | null;
  sanitisedTitle?: string | null;
  sanitisedDescription?: string | null;
  extractedIds: ExtractedId[];
  regexPattern: RegExp;
  onCopyListingId: (listingId: string) => void;
  validatedSets?: ValidatedSet[];
}

/**
 * Component that displays a single listing with its extracted IDs
 * and highlighted regex matches
 */
export function ListingAnalysisItem({
  listingId,
  title,
  description,
  sanitisedTitle,
  sanitisedDescription,
  extractedIds,
  regexPattern,
  onCopyListingId,
  validatedSets = [],
}: ListingAnalysisItemProps) {
  // Count occurrences of each extracted ID in the text
  // Use sanitized text if available, otherwise fall back to original
  const getOccurrenceCount = (id: string): number => {
    const titleText = sanitisedTitle || title;
    const descText = sanitisedDescription || description;
    const combinedText = [titleText, descText].filter(Boolean).join(' ');
    const regex = new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    const matches = combinedText.match(regex);
    return matches ? matches.length : 0;
  };

  // Get list of extracted ID strings for highlighting
  const extractedIdStrings = extractedIds.map((e) => e.extractedId);

  // Use sanitized fields if available, otherwise fall back to original
  const displayTitle = sanitisedTitle || title;
  const displayDescription = sanitisedDescription || description;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Listing Analysis</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              ID: {listingId.substring(0, 8)}...
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopyListingId(listingId)}
              className="h-6 px-2 text-xs"
              title="Copy listing ID to notes"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy ID
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sanitized Title */}
        {sanitisedTitle ? (
          <div>
            <Label className="text-sm font-medium mb-2 block">Sanitized Title</Label>
            <div className="text-sm p-3 bg-muted/50 rounded border">
              <RegexHighlightedText
                text={sanitisedTitle}
                regexPattern={regexPattern}
                extractedIds={extractedIdStrings}
              />
            </div>
          </div>
        ) : (
          <div>
            <Label className="text-sm font-medium mb-2 block">Title</Label>
            <div className="text-sm p-3 bg-muted/50 rounded border">
              <RegexHighlightedText
                text={title}
                regexPattern={regexPattern}
                extractedIds={extractedIdStrings}
              />
            </div>
          </div>
        )}

        {/* Sanitized Description */}
        {sanitisedDescription ? (
          <div>
            <Label className="text-sm font-medium mb-2 block">Sanitized Description</Label>
            <div className="text-sm p-3 bg-muted/50 rounded border max-h-96 overflow-y-auto">
              <RegexHighlightedText
                text={sanitisedDescription}
                regexPattern={regexPattern}
                extractedIds={extractedIdStrings}
              />
            </div>
          </div>
        ) : description ? (
          <div>
            <Label className="text-sm font-medium mb-2 block">Description</Label>
            <div className="text-sm p-3 bg-muted/50 rounded border max-h-96 overflow-y-auto">
              <RegexHighlightedText
                text={description}
                regexPattern={regexPattern}
                extractedIds={extractedIdStrings}
              />
            </div>
          </div>
        ) : null}

        <Separator />

        {/* Extracted IDs */}
        <div>
          <Label className="text-sm font-medium mb-2 block">
            Extracted IDs ({extractedIds.length})
          </Label>
          {extractedIds.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No IDs extracted from this listing
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {extractedIds.map(({ extractedId, validated }, index) => {
                const count = getOccurrenceCount(extractedId);
                return (
                  <Badge
                    key={index}
                    variant={validated ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {extractedId}
                    {count > 1 && (
                      <span className="ml-1 text-xs opacity-70">({count}x)</span>
                    )}
                    {validated ? (
                      <span className="ml-1 text-xs opacity-70">✓</span>
                    ) : (
                      <span className="ml-1 text-xs opacity-70">✗</span>
                    )}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Validated LEGO sets */}
        <Separator />
        <div>
          <Label className="text-sm font-medium mb-2 block">
            Validated LEGO sets ({validatedSets.length})
          </Label>
          {validatedSets.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No validated LEGO sets for this listing
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {validatedSets.map((set) => (
                <Badge
                  key={set.legoSetId}
                  variant="outline"
                  className="text-xs"
                >
                  {set.setNum} — {set.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
