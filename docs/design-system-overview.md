# Design System Overview

## Design Direction: Modern Intelligence

This design system implements the "Modern Intelligence" visual identity - a clean, approachable, and professional aesthetic that balances data precision with user-friendly design. Inspired by modern analytics platforms like Stripe Dashboard, Linear, and Notion.

---

## Color Palette

### Base Colors

The system uses OKLCH color space for better perceptual uniformity and color manipulation.

#### Light Mode
- **Background**: `oklch(1 0 0)` - Pure white
- **Foreground**: `oklch(0.145 0 0)` - Near-black text
- **Card**: `oklch(1 0 0)` - White cards
- **Card Foreground**: `oklch(0.145 0 0)` - Dark text on cards

#### Dark Mode
- **Background**: `oklch(0.145 0 0)` - Very dark gray
- **Foreground**: `oklch(0.985 0 0)` - Near-white text
- **Card**: `oklch(0.205 0 0)` - Dark gray cards
- **Card Foreground**: `oklch(0.985 0 0)` - Light text on cards

### Semantic Colors

#### Primary
- **Light**: `oklch(0.205 0 0)` - Dark gray/black
- **Dark**: `oklch(0.922 0 0)` - Light gray/white
- Used for: Primary actions, links, active states

#### Secondary
- **Light**: `oklch(0.97 0 0)` - Very light gray
- **Dark**: `oklch(0.269 0 0)` - Medium gray
- Used for: Secondary actions, subtle backgrounds

#### Muted
- **Light**: `oklch(0.97 0 0)` - Very light gray
- **Dark**: `oklch(0.269 0 0)` - Medium gray
- **Foreground**: `oklch(0.556 0 0)` (light) / `oklch(0.708 0 0)` (dark)
- Used for: Subtle text, placeholders, disabled states

#### Accent
- **Light**: `oklch(0.97 0 0)` - Very light gray
- **Dark**: `oklch(0.269 0 0)` - Medium gray
- Used for: Hover states, subtle highlights

#### Destructive
- **Light**: `oklch(0.577 0.245 27.325)` - Warm red
- **Dark**: `oklch(0.704 0.191 22.216)` - Brighter red
- Used for: Errors, destructive actions, warnings

#### Brand
- **Light**: `oklch(0.55 0.15 200)` - Teal
- **Dark**: `oklch(0.65 0.15 200)` - Lighter teal
- **Foreground**: `oklch(0.985 0 0)` - White/light text
- Used for: Brand accents, filter badges, icon containers, empty state accents
- **Usage**: Always use with opacity for subtlety: `bg-brand/10`, `text-brand`, `border-brand/20`

### Status Colors

#### Success/Active
- **Light**: `oklch(0.696 0.17 162.48)` - Soft green
- **Dark**: `oklch(0.696 0.17 162.48)` - Same green
- Usage: Active listings, successful operations, positive metrics

#### Warning/In Progress
- **Light**: `oklch(0.769 0.188 70.08)` - Soft amber/yellow
- **Dark**: `oklch(0.769 0.188 70.08)` - Same amber
- Usage: Running jobs, pending states, caution indicators

#### Info
- **Light**: `oklch(0.488 0.243 264.376)` - Soft blue
- **Dark**: `oklch(0.488 0.243 264.376)` - Same blue
- Usage: Informational messages, neutral states

#### Error/Removed
- Uses destructive color palette
- Usage: Failed operations, removed listings, errors

### Chart Colors

**Note**: Chart components have been removed from the codebase. Chart colors are retained in CSS variables for potential future use, but no chart components are currently implemented.

### Border & Input Colors

- **Border**: `oklch(0.922 0 0)` (light) / `oklch(1 0 0 / 10%)` (dark)
- **Input**: `oklch(0.922 0 0)` (light) / `oklch(1 0 0 / 15%)` (dark)
- **Ring** (focus): `oklch(0.708 0 0)` (light) / `oklch(0.556 0 0)` (dark)

---

## Typography

### Font Families

#### Primary Font: Geist Sans
- **Variable**: `--font-geist-sans`
- **Usage**: All UI text, labels, headings, body text
- **Characteristics**: Clean, modern, highly legible

#### Monospace Font: Geist Mono
- **Variable**: `--font-geist-mono`
- **Usage**: 
  - **Prices and currency values** (e.g., `$125.50`, `€89.99`) - always with `tabular-nums`
  - **Numeric metrics** (e.g., piece counts, percentages, IDs) - always with `tabular-nums`
  - **Code snippets** (if any)
  - **Timestamps** (optional, for technical precision) - with `tabular-nums`
- **Characteristics**: Always use with `tabular-nums` class for proper number alignment, technical precision

### Type Scale

#### Headings
- **H1**: `text-3xl` or `text-4xl`, `font-semibold` or `font-bold`
- **H2**: `text-2xl`, `font-semibold`
- **H3**: `text-xl`, `font-semibold`
- **H4**: `text-lg`, `font-semibold`

#### Body Text
- **Base**: `text-base` (16px), `font-normal`
- **Small**: `text-sm` (14px), `font-normal`
- **Extra Small**: `text-xs` (12px), `font-normal`

#### Special Cases
- **Large Numbers** (stat cards): `text-2xl` or `text-3xl`, `font-semibold`, **monospace**
- **Prices**: `text-lg` or `text-xl`, `font-semibold`, **monospace**
- **Labels**: `text-sm`, `font-medium`
- **Captions**: `text-xs`, `font-normal`, muted color

### Font Weights
- **Normal**: 400
- **Medium**: 500 (for labels, emphasis)
- **Semibold**: 600 (for headings, important numbers)
- **Bold**: 700 (rarely used, for maximum emphasis)

### Line Height
- **Tight**: `leading-tight` (for headings)
- **Normal**: `leading-normal` (default)
- **Relaxed**: `leading-relaxed` (for body text, descriptions)

---

## Spacing System

Based on 4px base unit (Tailwind's default).

### Spacing Scale
- **0**: `0` (0px)
- **1**: `0.25rem` (4px)
- **2**: `0.5rem` (8px)
- **3**: `0.75rem` (12px)
- **4**: `1rem` (16px)
- **5**: `1.25rem` (20px)
- **6**: `1.5rem` (24px)
- **8**: `2rem` (32px)
- **10**: `2.5rem` (40px)
- **12**: `3rem` (48px)
- **16**: `4rem` (64px)
- **20**: `5rem` (80px)
- **24**: `6rem` (96px)

### Common Patterns
- **Card padding**: `px-6 py-6` (24px horizontal, 24px vertical)
- **Card gap**: `gap-6` (24px between card sections)
- **Section spacing**: `space-y-4` or `space-y-6` (16px or 24px vertical)
- **Component gap**: `gap-2` or `gap-3` (8px or 12px)
- **Input padding**: `px-3 py-2` (12px horizontal, 8px vertical)
- **Button padding**: `px-4 py-2` (16px horizontal, 8px vertical)

---

## Border Radius

Using a base radius of `0.625rem` (10px) with a calculated scale.

### Radius Scale
- **sm**: `calc(var(--radius) - 4px)` = 6px
- **md**: `calc(var(--radius) - 2px)` = 8px
- **lg**: `var(--radius)` = 10px (default)
- **xl**: `calc(var(--radius) + 4px)` = 14px
- **2xl**: `calc(var(--radius) + 8px)` = 18px
- **3xl**: `calc(var(--radius) + 12px)` = 22px
- **4xl**: `calc(var(--radius) + 16px)` = 26px

### Usage Guidelines
- **Cards**: `rounded-lg` (10px) - modern, refined feel
- **Buttons**: `rounded-md` (8px) - slightly rounded
- **Inputs**: `rounded-md` (8px)
- **Badges**: `rounded-md` (8px) - not pill-shaped, uses glassmorphism
- **Images**: `rounded-lg` (10px)
- **Small elements**: `rounded-md` (8px)
- **Icon containers**: `rounded-lg` (10px)

---

## Shadows & Elevation

### Shadow Scale
- **sm**: `shadow-sm` - Subtle elevation for cards
- **default**: `shadow` - Standard card elevation
- **md**: `shadow-md` - Medium elevation (modals, dropdowns)
- **lg**: `shadow-lg` - High elevation (popovers, tooltips)
- **xl**: `shadow-xl` - Maximum elevation (rarely used)

### Usage
- **Stat Cards**: `shadow-sm` - Reduced intensity for subtle elevation
- **Filter Panels**: `shadow-lg` - More prominent for panels
- **Cards with gradients**: `shadow-sm` or `shadow-lg` depending on context
- **Hover states**: Slightly increase shadow on hover if needed
- **Modals/Sheets**: `shadow-lg` or `shadow-xl`
- **Buttons**: No shadow (flat design), subtle on hover if needed

---

## Borders

### Border Width
- **Default**: `1px`
- **Thick**: `2px` (for emphasis, focus states)

### Border Colors
- **Default**: `border-border` (uses CSS variable)
- **Subtle**: `border-foreground/10` (10% opacity) - for glassmorphism
- **Medium**: `border-foreground/20` (20% opacity)
- **Strong**: `border-foreground/30` (30% opacity)
- **Brand accents**: `border-brand/20` (20% opacity) - for subtle brand touches

### Usage
- **Cards**: `border` (1px, subtle)
- **Inputs**: `border border-input`
- **Dividers**: `border-b border-foreground/10`
- **Focus rings**: `ring-2 ring-ring` (2px, uses ring color)

---

## Icons

### Icon Library
- **Primary**: Lucide React (`lucide-react`)
- **Size Standard**: `h-4 w-4` (16px) for inline icons
- **Variations**: `h-3 w-3` (12px) for small, `h-5 w-5` (20px) for larger

### Icon Usage
- **Inline with text**: `h-4 w-4`, `inline-block`, `align-middle`
- **Button icons**: `h-4 w-4`, use `[&_svg]:size-4` utility
- **Standalone**: `h-5 w-5` or `h-6 w-6`
- **Color**: Inherit text color or use `text-muted-foreground` for subtle icons

---

## Animation & Transitions

### Transition Duration
- **Fast**: `transition-colors` (150ms default)
- **Medium**: `transition-all duration-200` (200ms)
- **Slow**: `transition-all duration-300` (300ms)

### Common Transitions
- **Hover states**: `transition-colors` - Smooth color changes
- **Interactive elements**: `transition-all` - All properties
- **Modals/Sheets**: `transition-transform` or `transition-opacity`

### Easing
- **Default**: Tailwind's default easing (ease-in-out)
- **Smooth**: Use for most interactions

---

## Responsive Breakpoints

Using Tailwind's default breakpoints:

- **sm**: `640px` - Small tablets, large phones
- **md**: `768px` - Tablets
- **lg**: `1024px` - Small laptops
- **xl**: `1280px` - Desktops
- **2xl**: `1536px` - Large desktops

### Mobile-First Approach
- Design for mobile first
- Use `md:`, `lg:`, `xl:` prefixes for larger screens
- Ensure touch targets are at least 44x44px on mobile

---

## Accessibility

### Color Contrast
- All text must meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- Use semantic colors appropriately
- Don't rely solely on color to convey information

### Focus States
- All interactive elements must have visible focus indicators
- Use `focus-visible:ring-2 focus-visible:ring-ring` pattern
- Ensure keyboard navigation works throughout

### Touch Targets
- Minimum 44x44px for touch interactions
- Adequate spacing between interactive elements

---

## Dark Mode

### Implementation
- Uses CSS variables that automatically switch based on `.dark` class
- All components should work seamlessly in both modes
- Test all components in both light and dark modes

### Considerations
- Adjust opacity values for borders and backgrounds in dark mode
- Ensure sufficient contrast in both modes
- Use semantic color variables, not hardcoded colors

---

## Glassmorphism & Visual Effects

### Glassmorphism Pattern
The design system incorporates subtle glassmorphism effects for a modern, refined aesthetic:

- **Backdrop Blur**: `backdrop-blur-sm` (subtle) or `backdrop-blur-md` (more pronounced)
- **Semi-transparent Backgrounds**: Use opacity modifiers like `/40`, `/80`, `/10`
- **Gradient Backgrounds**: `bg-gradient-to-br from-card/80 via-card/60 to-card/40`
- **Subtle Borders**: `border-foreground/10` or `border-brand/20`

### Where Glassmorphism is Used
- **Stat Cards**: Gradient background with backdrop blur
- **Filter Panels**: Gradient background with backdrop blur
- **Status Badges**: `backdrop-blur-sm bg-background/40`
- **Change Indicators**: `backdrop-blur-sm bg-background/40` (no border)
- **Icon Containers**: Subtle glassmorphism with brand accents
- **Empty States**: Icon containers with glassmorphism

### Brand Color Usage
- **Teal Brand Color**: `oklch(0.55 0.15 200)` (light) / `oklch(0.65 0.15 200)` (dark)
- **Applied Subtly**: Use with opacity for accents, not dominant colors
- **Where Used**:
  - Filter count badges: `bg-brand/10 text-brand`
  - Stat card icons: `bg-brand/5 border-brand/20 text-brand`
  - Empty state icons/buttons: `bg-brand/10 text-brand border-brand/20`
  - Header accents: `border-brand/10`

## Design Principles

1. **Clarity First**: Information should be immediately understandable
2. **Consistent Spacing**: Use the spacing scale consistently
3. **Subtle Interactions**: Hover and focus states should be noticeable but not jarring
4. **Data Precision**: Use monospace fonts with `tabular-nums` for numeric data to convey accuracy
5. **Progressive Disclosure**: Show essential information first, details on demand
6. **Whitespace**: Generous whitespace creates breathing room and improves readability
7. **Visual Hierarchy**: Use size, weight, and color to guide attention
8. **Glassmorphism**: Subtle depth through backdrop blur and gradients
9. **Brand Accents**: Use brand color sparingly and subtly for visual interest
10. **Text Contrast**: Always ensure text has proper contrast (`text-foreground` for visibility)
