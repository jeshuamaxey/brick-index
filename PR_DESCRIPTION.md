# Refactor Dev Pages: Simplify Aggregate Stats and Improve Dark/Light Mode Support

## Summary

This PR significantly simplifies the aggregate statistics page and refactors all dev pages to use Tailwind's semantic color helpers for proper dark/light mode support. The changes result in a cleaner, more maintainable codebase with better accessibility.

## Changes

### Aggregate Page Simplification
- **Simplified UI**: Removed complex charts and visualizations, keeping only essential statistics
- **Combined stats cards**: Merged "With Analysis" and "Without Analysis" into a single card
- **Added price per piece stats**: New card showing listings with/without price per piece estimates
- **Price distribution table**: Replaced histogram visualization with a clean table showing price ranges and counts
- **Configurable bucket size**: Added dropdown to select number of buckets (5, 10, 25, 50, 100) for price distribution
- **Min/Max price display**: Shows minimum and maximum prices in the dataset

### Dark/Light Mode Support
- **Replaced hardcoded colors**: All dev pages now use Tailwind `bg-background`, `text-foreground`, and opacity variants
- **Consistent theming**: Updated listings, analysis, capture, and seed pages to use semantic color classes
- **Proper contrast**: All UI elements now adapt correctly to both light and dark modes

### Seed Page Refactoring
- **Separate action cards**: Split into two distinct cards - one for seeding listings, one for analyzing
- **Clear descriptions**: Each card includes a detailed explanation of what the action does
- **Improved UX**: Removed "Seed Everything" button and consolidated information into card descriptions
- **Better loading states**: Tracks which specific action is running for more accurate button states

### Dependencies
- **Removed unused dependency**: Removed `recharts` package (no longer needed after removing charts)

## Files Changed

- `app/api/dev/aggregate/route.ts` - Added price distribution and price per piece counts
- `app/dev/aggregate/page.tsx` - Simplified from 780+ lines to ~150 lines
- `app/dev/analysis/page.tsx` - Updated colors for dark/light mode
- `app/dev/capture/page.tsx` - Updated colors for dark/light mode
- `app/dev/listings/page.tsx` - Updated colors for dark/light mode
- `app/dev/seed/page.tsx` - Refactored to use separate cards
- `package.json` - Removed recharts dependency

## Impact

- **Code reduction**: Net reduction of ~600 lines of code
- **Better maintainability**: Simpler codebase with fewer dependencies
- **Improved accessibility**: Proper contrast in both light and dark modes
- **Enhanced UX**: Clearer information architecture with better descriptions

## Testing

- [x] Verified aggregate page displays correctly with different bucket sizes
- [x] Tested dark/light mode switching on all dev pages
- [x] Confirmed seed page actions work independently
- [x] Validated all UI elements have proper contrast

## Screenshots

_Add screenshots of the updated pages if available_

