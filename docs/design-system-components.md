# Design System Components

## Component Priority & Implementation Plan

This document outlines all UI components needed for the LEGO pricing platform, organized by implementation priority.

---

## Phase 1: Essential Components (6 Components)

These 6 components form the foundation and should be built first. They cover the core functionality needed to display listings, prices, metrics, and basic interactions.

**Note**: Chart components have been removed from the codebase. Price History Chart and Chart base components are no longer part of the design system.

### 1. Price Display Component
**Priority**: Critical  
**Purpose**: Display prices with proper formatting and monospace font  
**Variants**:
- Default (standard price)
- Large (prominent display)
- Compact (for tables)

**Key Features**:
- Monospace font with `tabular-nums` for all price values
- Currency formatting (defaults to $)
- Optional change indicator with glassmorphism styling (no border)
- Optional time period display (e.g., "7d", "30d", "1y")
- Uses `text-foreground` for proper contrast

**Implementation Details**:
- Change indicator uses `backdrop-blur-sm bg-background/40` with rounded corners
- No border on change indicator (removed for cleaner look)
- Time period shown in parentheses next to change percentage

**Dependencies**: None

---

### 2. Stat Card Component
**Priority**: Critical  
**Purpose**: Display key metrics (average price, total listings, etc.)  
**Variants**:
- Default (number + label)
- Compact (smaller padding: `p-4` instead of `p-6`)

**Key Features**:
- Large, readable number (monospace with `tabular-nums` when numeric)
- Clear label with `text-muted-foreground`
- Uses PriceDisplay component when `isPrice={true}`
- Optional icon with brand color accent (`bg-brand/5 border-brand/20 text-brand`)
- Glassmorphism styling: gradient background with backdrop blur
- Reduced shadow intensity (`shadow-sm`)

**Styling**:
- Background: `bg-gradient-to-br from-card/80 via-card/60 to-card/40`
- Border: `border-foreground/10`
- Backdrop blur: `backdrop-blur-md`
- Border radius: `rounded-lg` (10px)
- Shadow: `shadow-sm` (subtle)

**Dependencies**: Price Display (for price stats)

---

### 3. Status Badge Component
**Priority**: Critical  
**Purpose**: Display listing status (active, sold, expired, removed)  
**Variants**:
- Active (green)
- Sold (blue)
- Expired (gray)
- Removed (red)
- Running (yellow - for jobs)
- Completed (green - for jobs)
- Failed (red - for jobs)

**Key Features**:
- Color-coded by status with semantic colors
- Glassmorphism styling: `backdrop-blur-sm bg-background/40`
- Border radius: `rounded-md` (8px) - not pill-shaped
- Consistent sizing
- Accessible contrast in both light and dark modes

**Styling**:
- Base: `rounded-md backdrop-blur-sm bg-background/40`
- Status colors: `bg-{color}/20 text-{color}-700 dark:text-{color}-400 border-{color}/30`
- Uses semantic status colors, not brand color

**Dependencies**: None

---

### 4. Filter Panel Component
**Priority**: Critical  
**Purpose**: Allow users to filter listings by various criteria  
**Variants**:
- Sidebar panel (`p-6`)
- Inline filters (`p-4`)
- Drawer (`p-6`)

**Key Features**:
- Price range inputs (min/max with monospace font)
- Status checkboxes
- Marketplace selection
- Condition filters
- Active filter count badge (uses brand color: `bg-brand/10 text-brand`)
- Clear all filters button
- Combines filter values in display chips (e.g., "Marketplace: ebay, facebook")

**Styling**:
- Glassmorphism: `backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40`
- Border: `border-foreground/10`
- Shadow: `shadow-lg`
- All text uses `text-foreground` for proper contrast
- Section headings: `text-sm font-medium text-foreground`
- Filter count badge: `bg-brand/10 text-brand` (brand color)

**Dependencies**: Input, Select, Checkbox, Button, Label, Separator

---

### 5. Loading Skeleton Component
**Priority**: Critical  
**Purpose**: Show loading states for better perceived performance  
**Variants**:
- Card skeleton
- Table row skeleton
- List item skeleton
- Stat card skeleton

**Key Features**:
- Pulse animation (via Skeleton component)
- Matches actual content layout
- Uses glassmorphism styling to match cards
- Multiple sizes
- Responsive

**Styling**:
- Card variants use: `rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 shadow-lg`
- List item uses: `border border-foreground/10 rounded-md backdrop-blur-sm bg-background/40`

**Dependencies**: Skeleton component

---

### 6. Empty State Component
**Priority**: Critical  
**Purpose**: Display when no data is available  
**Variants**:
- Default (with brand color accents)
- Error (with destructive color accents)

**Key Features**:
- Icon container with glassmorphism
- Clear title with proper contrast (`text-foreground`)
- Description text (`text-foreground/70`)
- Optional action button with outline variant
- Less intense button colors for better UX

**Styling**:
- Icon container: `rounded-lg backdrop-blur-sm border`
  - Default: `bg-brand/10 text-brand border-brand/20`
  - Error: `bg-destructive/10 text-destructive border-destructive/20`
- Title: `text-foreground` (or `text-destructive` for error)
- Description: `text-foreground/70`
- Button: `variant="outline"` with subtle colors
  - Default: `border-brand/30 text-brand hover:bg-brand/10`
  - Error: `border-destructive/30 text-destructive hover:bg-destructive/10`

**Dependencies**: Button, Icon (Lucide React)

---

## Phase 2: Core Data Components

### 9. Data Table Component
**Priority**: High  
**Purpose**: Display listings in sortable, filterable table format  
**Status**: Already exists, may need refinement  
**Enhancements Needed**:
- Monospace for numeric columns
- Better mobile responsiveness
- Column visibility toggles
- Export functionality

---

### 10. Listing Detail Panel/Sheet
**Priority**: High  
**Purpose**: Show full details of a selected listing  
**Status**: Already exists, may need refinement  
**Enhancements Needed**:
- Better image gallery
- Improved layout
- Monospace for prices/metrics
- Better mobile experience

---

### 11. Metric Comparison Component
**Priority**: High  
**Purpose**: Compare current price vs average vs historical  
**Variants**:
- Inline comparison
- Comparison card
- Side-by-side metrics

**Key Features**:
- Current value
- Average value
- Historical range
- Percentage difference
- Visual indicators

**Dependencies**: Price Display, Stat Card

---

### 12. Chart Tooltip Component
**Priority**: High  
**Purpose**: Custom tooltip for charts with monospace values  
**Key Features**:
- Monospace font for numbers
- Clean layout
- Multiple data points
- Date formatting

**Dependencies**: Chart library

---

## Phase 3: Navigation & Layout Components

### 13. App Header Component
**Priority**: Medium  
**Purpose**: Top navigation bar with search, user menu, etc.  
**Key Features**:
- Global search
- User profile menu
- Notifications
- Theme toggle (if needed)

---

### 14. Breadcrumb Navigation Component
**Priority**: Medium  
**Purpose**: Show current location in app hierarchy  
**Status**: Already exists  
**Enhancements**: May need styling updates

---

### 15. Sidebar Navigation Component
**Priority**: Medium  
**Purpose**: Main app navigation  
**Status**: Already exists  
**Enhancements**: May need styling updates

---

### 16. Page Layout Components
**Priority**: Medium  
**Purpose**: Consistent page structure  
**Variants**:
- Dashboard layout
- List/table layout
- Detail layout
- Comparison layout

---

## Phase 4: Interactive Components

### 17. Search Bar Component
**Priority**: Medium  
**Purpose**: Global search for sets and listings  
**Key Features**:
- Autocomplete
- Recent searches
- Search suggestions
- Keyboard shortcuts

---

### 18. Sort Dropdown Component
**Priority**: Medium  
**Purpose**: Sort listings by various criteria  
**Key Features**:
- Multiple sort options
- Ascending/descending toggle
- Visual indicators

---

### 19. Pagination Component
**Priority**: Medium  
**Purpose**: Navigate through paginated results  
**Key Features**:
- Page numbers
- Previous/next buttons
- Items per page selector
- Jump to page

---

### 20. Modal/Dialog Component
**Priority**: Medium  
**Purpose**: Display overlays and confirmations  
**Status**: May exist via Radix UI  
**Enhancements**: Styling consistency

---

### 21. Sheet/Drawer Component
**Priority**: Medium  
**Purpose**: Slide-in panels for details  
**Status**: Already exists  
**Enhancements**: May need styling updates

---

## Phase 5: Collection & Watchlist Components

### 22. Collection Card Component
**Priority**: Low  
**Purpose**: Display saved LEGO sets in collection  
**Key Features**:
- Set image
- Set number and name
- Collection value
- Last updated price

---

### 23. Watchlist Toggle Component
**Priority**: Low  
**Purpose**: Add/remove sets from watchlist  
**Key Features**:
- Toggle button
- Active state
- Confirmation feedback

---

### 24. Price Alert Settings Component
**Priority**: Low  
**Purpose**: Configure price alerts for watched sets  
**Key Features**:
- Alert threshold input
- Alert frequency selection
- Active alerts list

---

## Phase 6: Advanced Visualization Components

### 25. Price Distribution Chart Component
**Priority**: Low  
**Purpose**: Show price distribution histogram  
**Key Features**:
- Histogram visualization
- Statistical markers (mean, median)
- Interactive bins

---

### 26. Market Activity Timeline Component
**Priority**: Low  
**Purpose**: Show listing activity over time  
**Key Features**:
- Timeline visualization
- Activity markers
- Event annotations

---

### 27. Comparison View Component
**Priority**: Low  
**Purpose**: Compare multiple sets side-by-side  
**Key Features**:
- Multiple set cards
- Comparison metrics table
- Difference highlighting

---

## Phase 7: Form & Input Components

### 28. Enhanced Input Components
**Priority**: Low  
**Purpose**: Specialized inputs for the platform  
**Variants**:
- Price input (with currency)
- Number input (with formatting)
- Date range picker
- Search input

---

### 29. Multi-Select Component
**Priority**: Low  
**Purpose**: Select multiple options (marketplaces, conditions, etc.)  
**Key Features**:
- Checkbox list
- Selected count
- Clear all

---

### 30. Range Slider Component
**Priority**: Low  
**Purpose**: Price range selection  
**Key Features**:
- Dual handles
- Min/max display
- Step increments

---

## Phase 8: Utility Components

### 31. Tooltip Component
**Priority**: Low  
**Purpose**: Show additional information on hover  
**Status**: May exist via Radix UI  
**Enhancements**: Styling consistency

---

### 32. Popover Component
**Priority**: Low  
**Purpose**: Show contextual information on click  
**Status**: May exist via Radix UI  
**Enhancements**: Styling consistency

---

### 33. Badge/Tag Component
**Priority**: Low  
**Purpose**: Display labels and categories  
**Variants**:
- Default badge
- Category tag
- Marketplace badge
- Condition badge

---

### 34. Divider/Separator Component
**Priority**: Low  
**Purpose**: Visual separation between sections  
**Status**: Already exists  
**Enhancements**: May need styling updates

---

### 35. Copy to Clipboard Component
**Priority**: Low  
**Purpose**: Copy text/IDs to clipboard  
**Key Features**:
- Copy button
- Success feedback
- Icon indicator

---

## Phase 9: Export & Sharing Components

### 36. Export Button Component
**Priority**: Low  
**Purpose**: Export data (CSV, PDF)  
**Key Features**:
- Format selection
- Export options
- Progress indicator

---

### 37. Share Component
**Priority**: Low  
**Purpose**: Share listings or sets  
**Key Features**:
- Share options
- Link generation
- Social sharing (if needed)

---

## Implementation Notes

### Component Structure
- All components should be in `/components/ui/` or `/components/[category]/`
- Use TypeScript for all components
- Follow existing patterns (Radix UI + Tailwind)
- Use `cn()` utility for className merging

### Styling Approach
- Use Tailwind CSS classes
- Leverage CSS variables for theming
- Ensure dark mode compatibility
- Use semantic color variables
- **Glassmorphism**: Use `backdrop-blur-sm` or `backdrop-blur-md` with semi-transparent backgrounds
- **Gradients**: Use `bg-gradient-to-br from-card/80 via-card/60 to-card/40` for card backgrounds
- **Brand color**: Use subtly for accents (badges, icons, buttons) - `bg-brand/10`, `text-brand`, `border-brand/20`
- **Border radius**: Use `rounded-lg` (10px) for cards, `rounded-md` (8px) for smaller elements
- **Shadows**: Use `shadow-sm` for subtle elevation, `shadow-lg` for panels

### Monospace Font Usage
- **Always use monospace for**: Prices, piece counts, percentages, IDs, codes
- **Always include `tabular-nums`**: Ensures proper number alignment
- **Use regular font for**: Labels, descriptions, titles, UI text
- **Pattern**: `font-mono font-semibold tabular-nums text-foreground`
- Apply via `font-mono tabular-nums` classes

### Accessibility
- Include proper ARIA labels
- Ensure keyboard navigation
- Maintain color contrast
- Test with screen readers

### Responsive Design
- Mobile-first approach
- Test on multiple screen sizes
- Use responsive utilities (`sm:`, `md:`, `lg:`)

### Performance
- Lazy load images
- Optimize chart rendering
- Use React.memo where appropriate
- Minimize re-renders

---

## Component Dependencies Map

```
Price Display (1)
  └─ Used by: Stat Card (when isPrice={true})

Status Badge (3)
  └─ Used by: Data Table, Job Detail Panel, Listing views

Stat Card (2)
  └─ Used by: Dashboard, Metric displays
  └─ Uses: Price Display (for price values)

Filter Panel (4)
  └─ Uses: Input, Select, Checkbox, Button, Label, Separator
  └─ Used by: Listing views, Search pages

Loading Skeleton (5)
  └─ Used by: All data-loading components
  └─ Uses: Skeleton component

Empty State (6)
  └─ Uses: Button, Icon (Lucide React)
  └─ Used by: All empty data states
```

---

## Implementation Status

### ✅ Phase 1: Essential Components (COMPLETE)
All 6 essential components have been implemented:
1. ✅ Price Display Component
2. ✅ Stat Card Component
3. ✅ Status Badge Component
4. ✅ Filter Panel Component
5. ✅ Loading Skeleton Component
6. ✅ Empty State Component

### Key Implementation Decisions
- **Glassmorphism**: All cards use gradient backgrounds with backdrop blur
- **Border radius**: `rounded-lg` (10px) for cards, `rounded-md` (8px) for badges
- **Brand color**: Teal (`oklch(0.55 0.15 200)`) used subtly for accents
- **Monospace**: Always includes `tabular-nums` for proper alignment
- **Text contrast**: All text uses `text-foreground` or semantic colors for visibility
- **Shadows**: Reduced intensity (`shadow-sm` for cards, `shadow-lg` for panels)

## Next Steps

1. **Proceed to Phase 2** components as needed
2. **Refine existing components** based on user feedback
3. **Add new components** following the established patterns
4. **Maintain consistency** with glassmorphism and brand color usage
