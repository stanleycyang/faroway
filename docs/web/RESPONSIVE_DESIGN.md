# TripGenie Responsive Design Documentation

## Breakpoints Used

The project uses Tailwind CSS's default breakpoints:

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| (default)  | 0px       | Mobile-first base styles |
| `sm:`      | 640px     | Small tablets, large phones in landscape |
| `md:`      | 768px     | Tablets |
| `lg:`      | 1024px    | Desktops, large tablets |
| `xl:`      | 1280px    | Large desktops |

## Responsive Design Audit Results ✅

### 1. Landing Page (`/app/(marketing)/page.tsx`)
- ✅ Mobile (320px+): Single-column layout, hero card stacks below text
- ✅ Tablet (768px+): Two-column hero with card beside text
- ✅ Desktop (1024px+): Full width with comfortable spacing
- ✅ Touch targets: All buttons min 44px (actually 48-52px)
- ✅ Date picker: Single calendar on mobile, positioned to not overflow
- ✅ Destination dropdown: Proper overflow handling
- ✅ Images: Using Next.js Image with responsive sizing

### 2. Dashboard (`/app/(app)/dashboard/page.tsx`)
- ✅ Mobile: Single-column trip cards, stacked stats (2x2 grid)
- ✅ Tablet: 2-column trip cards
- ✅ Desktop: 3-column trip cards, 4-column stats
- ✅ Touch targets: All interactive elements ≥44px
- ✅ Filter tabs: Horizontal scroll on mobile, min-height for touch

### 3. Trip Creation (`/app/(app)/trips/new/page.tsx`)
- ✅ Mobile: Full-width form, step labels hidden (icons only)
- ✅ Tablet+: Step labels visible
- ✅ Touch targets: +/- buttons are 44px (w-11 h-11)
- ✅ Date picker: Modal-based, single calendar on mobile

### 4. Trip Detail (`/app/(app)/trips/[id]/page.tsx`)
- ✅ Mobile: Compact header, collapsible day sections
- ✅ Tablet+: Full meta display, daily costs visible
- ✅ Progress indicators: 3-column grid works on all sizes
- ✅ Map placeholder: Responsive height

### 5. Auth Pages (`/auth/login/page.tsx`, `/auth/signup/page.tsx`)
- ✅ Mobile: Centered card with max-width
- ✅ Form inputs: Proper autocomplete, inputMode, min 48px height
- ✅ OAuth buttons: Full-width, min 48px height
- ✅ Text: 16px base size prevents zoom on iOS

## Key Responsive Patterns

### Touch Targets
All interactive elements meet the 44px minimum:
- Buttons: `min-h-[44px]` or `min-h-[48px]`
- Input fields: `min-h-[48px]` or `min-h-[52px]`
- Counter buttons: `w-11 h-11` (44px)
- List items: `min-h-[52px]`

### Form Best Practices
- `inputMode="email"` for email fields
- `inputMode="search"` for search fields  
- `autoComplete` attributes for password managers
- `text-base` (16px) prevents iOS zoom on focus

### Layout Patterns
- Mobile-first: Base styles target mobile
- Grid columns: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Padding: `px-4 sm:px-6 lg:px-8`
- Hiding text: `hidden sm:inline` for optional labels

### Images
- All images use Next.js `Image` component
- `fill` + `object-cover` for backgrounds
- `sizes` prop for responsive loading

## No Horizontal Scroll ✅
All pages tested at 320px viewport width with no horizontal overflow.

## Modals/Dialogs ✅
- Date picker: Modal with backdrop on mobile
- Destination dropdown: Max-height with scroll

---
Last audited: February 2026
