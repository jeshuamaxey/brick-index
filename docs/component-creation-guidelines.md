# Component Creation Guidelines

This document provides instructions for creating new UI components that are consistent with the "Modern Intelligence" design system. Follow these guidelines to ensure all components maintain visual and functional consistency.

---

## File Structure & Organization

### Location
- **UI Components**: Place in `/components/ui/` directory
- **Feature-Specific Components**: Place in `/components/[feature-name]/` directory (e.g., `/components/listings/`, `/components/jobs/`)

### File Naming
- Use kebab-case: `price-display.tsx`, `stat-card.tsx`
- Match component name: File `price-display.tsx` contains component `PriceDisplay`

### Component Structure
```typescript
'use client'; // If using client-side features

import * as React from "react"
import { cn } from "@/lib/utils"
// Other imports

// Type definitions
interface ComponentNameProps {
  // Props definition
}

// Component implementation
export function ComponentName({ 
  className,
  ...props 
}: ComponentNameProps) {
  return (
    <div className={cn("base-classes", className)} {...props}>
      {/* Component content */}
    </div>
  )
}
```

---

## Styling Guidelines

### Use Tailwind CSS Classes
- **Always use Tailwind utility classes** instead of custom CSS
- Leverage the design system tokens (spacing, colors, typography)
- Use `cn()` utility from `@/lib/utils` for conditional classes

### Color Usage
- **Never use hardcoded colors** - always use semantic color variables:
  - `bg-background`, `text-foreground` for base colors
  - `bg-card`, `text-card-foreground` for cards
  - `bg-primary`, `text-primary-foreground` for primary actions
  - `bg-muted`, `text-muted-foreground` for subtle elements
  - `bg-destructive`, `text-destructive-foreground` for errors
  - `bg-brand`, `text-brand` for brand accents (teal)
  - `border-border` for borders
  - `ring-ring` for focus states
- **Brand Color**: Use `bg-brand`, `text-brand`, `border-brand` for subtle brand accents
  - Use with opacity: `bg-brand/10`, `text-brand`, `border-brand/20` for subtle effects
  - Applied to: Filter count badges, stat card icons, empty state icons/buttons, header accents

### Typography
- **Use Geist Sans** (default) for all UI text: `font-sans` (default)
- **Use Geist Mono** for numeric data: `font-mono`
  - Prices: Always use `font-mono` with `tabular-nums` for alignment
  - Piece counts: Always use `font-mono` with `tabular-nums`
  - Percentages: Always use `font-mono` with `tabular-nums`
  - IDs, codes: Always use `font-mono` with `tabular-nums`
- **Font sizes**: Use Tailwind scale (`text-sm`, `text-base`, `text-lg`, etc.)
- **Font weights**: `font-normal`, `font-medium`, `font-semibold`, `font-bold`
- **Tabular numbers**: Always use `tabular-nums` with `font-mono` for proper alignment

### Spacing
- Use the spacing scale: `p-4`, `px-6`, `gap-3`, `space-y-4`, etc.
- **Card padding**: Standard is `p-6` (24px all around)
- **Compact cards**: Use `p-4` (16px) for compact variant
- **Component gaps**: Use `gap-2` (8px), `gap-3` (12px), or `gap-4` (16px)
- **Section spacing**: Use `space-y-4` (16px) or `space-y-6` (24px)
- **Filter panel sections**: Use `space-y-4` between filter groups

### Border Radius
- **Cards**: `rounded-lg` (10px) - smaller radius for modern feel
- **Buttons**: `rounded-md` (8px)
- **Inputs**: `rounded-md` (8px)
- **Badges**: `rounded-md` (8px) - not pill-shaped, uses glassmorphism
- **Images**: `rounded-lg` (10px)
- **Small elements**: `rounded-md` (8px)

### Shadows
- **Stat Cards**: `shadow-sm` (subtle, reduced intensity)
- **Filter Panels**: `shadow-lg` (more prominent for panels)
- **Cards with gradients**: `shadow-sm` or `shadow-lg` depending on context
- **Hover states**: Slightly increase shadow if needed
- **Modals**: `shadow-lg` or `shadow-xl`

### Borders
- **Default**: `border` (1px)
- **Color**: `border-border` or `border-foreground/10` for subtle glassmorphism effects
- **Glassmorphism borders**: `border-foreground/10` or `border-brand/20` for subtle definition
- **Focus**: `ring-2 ring-ring` for focus states

---

## Component Patterns

### Variant-Based Components
Use `class-variance-authority` (CVA) for components with multiple variants:

```typescript
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const componentVariants = cva(
  "base-classes", // Always applied
  {
    variants: {
      variant: {
        default: "default-classes",
        secondary: "secondary-classes",
      },
      size: {
        sm: "small-classes",
        md: "medium-classes",
        lg: "large-classes",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

interface ComponentProps extends VariantProps<typeof componentVariants> {
  className?: string
  // Other props
}

export function Component({ variant, size, className, ...props }: ComponentProps) {
  return (
    <div 
      className={cn(componentVariants({ variant, size }), className)} 
      {...props}
    />
  )
}
```

### Forwarding Refs
For components that wrap native elements, use `React.forwardRef`:

```typescript
const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn("base-classes", className)} 
        {...props}
      />
    )
  }
)
Component.displayName = "Component"
```

### Data Slot Pattern
For complex components with sub-components, use the `data-slot` pattern (as seen in Card component):

```typescript
function Component({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="component"
      className={cn("base-classes", className)}
      {...props}
    />
  )
}

function ComponentHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="component-header"
      className={cn("header-classes", className)}
      {...props}
    />
  )
}
```

### Component Composition
When components can use other components internally, compose them:

```typescript
// StatCard uses PriceDisplay when displaying prices
{shouldUsePriceDisplay ? (
  <PriceDisplay
    value={value}
    currency={currency}
    variant="large"
    showChange={showTrend}
    changePercentage={trendPercentage}
    timePeriod={timePeriod}
  />
) : (
  <p className="font-mono tabular-nums">{formattedValue}</p>
)}
```

This ensures consistency and reusability across components.

---

## Monospace Font Usage Rules

### Always Use Monospace For:
1. **All price values**: `$125.50`, `€89.99`, `£45.00` (with `tabular-nums`)
2. **Numeric metrics**: Piece counts, minifig counts, percentages (with `tabular-nums`)
3. **IDs and codes**: Job IDs, listing IDs, set numbers (with `tabular-nums`)
4. **Timestamps** (optional): If displaying precise technical timestamps (with `tabular-nums`)

### Never Use Monospace For:
1. **Labels**: "Price", "Pieces", "Status"
2. **Descriptions**: Any descriptive text
3. **Titles**: Component titles, headings
4. **UI text**: Button labels, navigation items
5. **Dates** (formatted): "15 Jan 2024" (unless it's a timestamp)

### Implementation Example:
```typescript
// ✅ CORRECT: Price uses monospace with tabular-nums
<span className="font-mono font-semibold tabular-nums text-foreground text-lg">$125.50</span>

// ✅ CORRECT: Label uses regular font, value uses monospace
<div>
  <span className="text-sm font-medium text-foreground">Price</span>
  <span className="font-mono text-xl font-semibold tabular-nums text-foreground">$125.50</span>
</div>

// ❌ WRONG: Price uses regular font
<span className="text-lg font-semibold">$125.50</span>

// ❌ WRONG: Missing tabular-nums (numbers won't align properly)
<span className="font-mono text-lg font-semibold">$125.50</span>
```

---

## Accessibility Requirements

### ARIA Labels
- Add `aria-label` to icon-only buttons
- Use `aria-describedby` for help text
- Include `aria-live` for dynamic content updates

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Use proper focus management
- Include visible focus indicators: `focus-visible:ring-2 focus-visible:ring-ring`

### Color Contrast
- Ensure all text meets WCAG AA standards
- Don't rely solely on color to convey information
- Use icons or text in addition to color

### Semantic HTML
- Use appropriate HTML elements (`<button>`, `<nav>`, `<main>`, etc.)
- Use heading hierarchy properly (`<h1>`, `<h2>`, etc.)
- Use lists for list items (`<ul>`, `<ol>`)

---

## Responsive Design

### Mobile-First Approach
- Design for mobile first, then enhance for larger screens
- Use responsive utilities: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`

### Touch Targets
- Minimum 44x44px for touch interactions
- Adequate spacing between interactive elements (at least 8px)

### Breakpoint Usage
```typescript
// Mobile-first: base styles for mobile, then enhance
<div className="
  flex flex-col gap-2        // Mobile: column layout
  md:flex-row md:gap-4        // Tablet+: row layout
  lg:gap-6                    // Desktop+: larger gap
">
```

---

## Glassmorphism & Visual Effects

### Glassmorphism Pattern
Components use subtle glassmorphism effects for a modern, refined look:
- **Backdrop blur**: `backdrop-blur-sm` or `backdrop-blur-md`
- **Semi-transparent backgrounds**: `bg-background/40`, `bg-card/80`, `bg-brand/10`
- **Subtle borders**: `border-foreground/10`, `border-brand/20`
- **Gradient backgrounds**: `bg-gradient-to-br from-card/80 via-card/60 to-card/40`

### Where to Use Glassmorphism
- **Cards**: Stat cards, filter panels use gradient backgrounds with backdrop blur
- **Badges**: Status badges use `backdrop-blur-sm bg-background/40`
- **Change indicators**: Price change indicators use `backdrop-blur-sm bg-background/40`
- **Icon containers**: Subtle glassmorphism with brand accents
- **Empty states**: Icon containers use glassmorphism

### Gradient Backgrounds
- **Card backgrounds**: `bg-gradient-to-br from-card/80 via-card/60 to-card/40`
- Creates subtle depth and visual interest
- Works in both light and dark modes

## Theme Detection

### useTheme Hook
For components that need to react to theme changes (like charts that need to re-render), use the `useTheme` hook:

```typescript
import { useTheme } from '@/hooks/use-theme';

export function Component() {
  const theme = useTheme(); // Returns 'light' | 'dark'
  
  // Use theme as key to force re-render when theme changes
  return <div key={theme}>...</div>;
}
```

The hook uses a MutationObserver to detect when the `dark` class is added/removed from the HTML element. This ensures components re-render properly when the theme changes.

## Dark Mode Compatibility

### Always Test Both Modes
- All components must work in both light and dark modes
- Use semantic color variables (they automatically adapt)
- Test opacity values (borders, backgrounds)
- **Critical**: Always use `text-foreground` for headings and important text to ensure visibility

### Color Variables
- Never hardcode colors - always use CSS variables
- Use opacity modifiers: `bg-foreground/10`, `border-foreground/20`
- Test text contrast: Use `text-foreground` or `text-foreground/70` for descriptions
- Error states: Use `text-destructive` for error text (has proper contrast)

---

## Component Documentation

### Include JSDoc Comments
```typescript
/**
 * Displays a price with proper formatting and monospace font.
 * 
 * @example
 * <PriceDisplay value={125.50} currency="USD" />
 */
export function PriceDisplay({ value, currency }: PriceDisplayProps) {
  // ...
}
```

### Export Types
```typescript
export interface PriceDisplayProps {
  value: number
  currency?: string
  variant?: 'default' | 'large' | 'compact'
  showChange?: boolean
  changeValue?: number
}
```

---

## Common Patterns

### Loading States
```typescript
{isLoading ? (
  <LoadingSkeleton variant="card" />
) : (
  <Component data={data} />
)}
```

### Empty States
```typescript
{data.length === 0 ? (
  <EmptyState 
    icon={Icon}
    title="No listings found"
    description="Try adjusting your filters"
    action={{
      label: 'Clear Filters',
      onClick: () => handleClearFilters()
    }}
  />
) : (
  <Component data={data} />
)}
```

**Empty State Button Styling**:
- Use `variant="outline"` for buttons (less intense than solid)
- Default state: `border-brand/30 text-brand hover:bg-brand/10 hover:border-brand/50`
- Error state: `border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50`
- Less intense colors for better UX
- Always ensure text has good contrast: Use `text-foreground` for titles, `text-foreground/70` for descriptions

### Error States
```typescript
{error ? (
  <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
    Error: {error.message}
  </div>
) : (
  <Component data={data} />
)}
```

### Filter Value Display
When displaying active filters, combine values under the same parameter:

```typescript
// ✅ CORRECT: Combine multiple values
{selectedMarketplaces.length > 0 && (
  <span className="px-2 py-1 rounded bg-muted text-xs text-foreground">
    Marketplace: {selectedMarketplaces.join(', ')}
  </span>
)}

// ❌ WRONG: Separate chips for each value
{selectedMarketplaces.map((m) => (
  <span key={m}>Marketplace: {m}</span>
))}
```

---

## Testing Checklist

Before considering a component complete, ensure:

- [ ] Works in both light and dark modes
- [ ] Responsive on mobile, tablet, and desktop
- [ ] Keyboard navigable
- [ ] Has proper ARIA labels
- [ ] Uses semantic color variables (no hardcoded colors)
- [ ] Monospace font with `tabular-nums` used for numeric data (prices, counts, etc.)
- [ ] All text uses `text-foreground` or semantic colors for visibility
- [ ] Follows spacing scale
- [ ] Uses appropriate border radius (`rounded-lg` for cards, `rounded-md` for smaller elements)
- [ ] Has hover/focus states where needed
- [ ] TypeScript types are properly defined
- [ ] Component is exported correctly
- [ ] Matches design system aesthetic
- [ ] Glassmorphism effects applied where appropriate
- [ ] Brand color used subtly (if applicable)
- [ ] Button colors are less intense (use outline variant for empty states)

---

## Examples of Good Components

### Reference Components
- **Card** (`/components/ui/card.tsx`) - Good example of data-slot pattern
- **Button** (`/components/ui/button.tsx`) - Good example of CVA variants
- **Existing components** - Use as reference for patterns

### What Makes a Good Component
1. **Reusable**: Can be used in multiple contexts
2. **Flexible**: Accepts className and other props for customization
3. **Accessible**: Follows accessibility guidelines
4. **Consistent**: Matches design system
5. **Well-typed**: Proper TypeScript definitions
6. **Documented**: Clear purpose and usage

---

## Common Mistakes to Avoid

### ❌ Don't:
- Use hardcoded colors (use semantic variables)
- Use regular font for prices/metrics (use monospace with `tabular-nums`)
- Create components that are too specific (make them reusable)
- Skip accessibility features
- Ignore dark mode
- Use inconsistent spacing
- Create components without TypeScript types
- Use `rounded-full` for badges (use `rounded-md` with glassmorphism)
- Use `rounded-xl` for cards (use `rounded-lg`)
- Use intense button colors (use outline variant with subtle colors)
- Forget to add `text-foreground` to headings and important text

### ✅ Do:
- Use semantic color variables
- Use monospace with `tabular-nums` for numeric data
- Make components flexible and reusable
- Include accessibility features
- Test in both light and dark modes
- Follow the spacing scale
- Define proper TypeScript types
- Match the design system aesthetic
- Use glassmorphism effects where appropriate (cards, badges, indicators)
- Use brand color subtly for accents
- Ensure all text uses `text-foreground` or semantic colors for visibility
- Use `rounded-lg` for cards, `rounded-md` for smaller elements

---

## Questions?

If you're unsure about:
- **Styling approach**: Check existing components in `/components/ui/`
- **Patterns**: Look at Card, Button, or other established components
- **Design tokens**: Refer to `design-system-overview.md`
- **Component priority**: Refer to `design-system-components.md`

When in doubt, maintain consistency with existing components and the design system principles.
