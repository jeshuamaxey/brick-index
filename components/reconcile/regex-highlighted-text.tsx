'use client';

import { useMemo } from 'react';

interface RegexHighlightedTextProps {
  text: string;
  regexPattern: RegExp;
  extractedIds: string[];
}

interface TextSegment {
  text: string;
  isMatch: boolean;
  isExtracted: boolean;
}

/**
 * Component that highlights regex matches in text
 * - Primary highlight (green/yellow): Matches that are in extractedIds (correctly extracted)
 * - Secondary highlight (orange/red): Matches found by regex but NOT in extractedIds (false positives)
 * - Normal: Non-matching text
 */
export function RegexHighlightedText({
  text,
  regexPattern,
  extractedIds,
}: RegexHighlightedTextProps) {
  const segments = useMemo(() => {
    if (!text) {
      return [{ text: '', isMatch: false, isExtracted: false }];
    }

    // Create a Set for fast lookup
    const extractedIdsSet = new Set(extractedIds);

    // Find all matches with their positions
    const matches: Array<{
      start: number;
      end: number;
      text: string;
      isExtracted: boolean;
    }> = [];

    // Reset regex lastIndex to ensure we start from the beginning
    const globalPattern = new RegExp(regexPattern.source, regexPattern.flags.includes('g') ? regexPattern.flags : regexPattern.flags + 'g');
    let match;
    while ((match = globalPattern.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        isExtracted: extractedIdsSet.has(match[0]),
      });
    }

    // Sort matches by start position
    matches.sort((a, b) => a.start - b.start);

    // Build segments
    const segments: TextSegment[] = [];
    let lastIndex = 0;

    for (const match of matches) {
      // Add text before match
      if (match.start > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, match.start),
          isMatch: false,
          isExtracted: false,
        });
      }

      // Add match
      segments.push({
        text: match.text,
        isMatch: true,
        isExtracted: match.isExtracted,
      });

      lastIndex = match.end;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      segments.push({
        text: text.substring(lastIndex),
        isMatch: false,
        isExtracted: false,
      });
    }

    return segments;
  }, [text, regexPattern, extractedIds]);

  return (
    <span className="whitespace-pre-wrap">
      {segments.map((segment, index) => {
        if (!segment.isMatch) {
          return <span key={index}>{segment.text}</span>;
        }

        if (segment.isExtracted) {
          // Primary highlight: correctly extracted IDs (green/yellow)
          return (
            <mark
              key={index}
              className="bg-yellow-200 dark:bg-yellow-900/50 px-0.5 rounded"
              title={`Extracted ID: ${segment.text}`}
            >
              {segment.text}
            </mark>
          );
        } else {
          // Secondary highlight: false positives (orange/red)
          return (
            <mark
              key={index}
              className="bg-orange-200 dark:bg-orange-900/50 px-0.5 rounded"
              title={`False positive: ${segment.text} (regex matched but not extracted)`}
            >
              {segment.text}
            </mark>
          );
        }
      })}
    </span>
  );
}
