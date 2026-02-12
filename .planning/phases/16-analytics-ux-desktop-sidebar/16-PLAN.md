# Phase 16: Analytics UX Improvements & Desktop Sidebar Navigation

## Context

### Original Request
Two features for the fuel-tracker Next.js app:
1. Analytics page chart improvements (expand button, animation speed, dot toggle, legend toggle)
2. Desktop sidebar navigation (currently only mobile BottomNav exists)

### Research Findings
- **Analytics page**: `src/app/analytics/page.tsx` (449 lines) uses recharts with 4 chart cards (3 LineCharts, 1 BarChart). All charts use `ResponsiveContainer width="100%" height={250}`, all Line components have `dot={{ r: 3 }}`, no `animationDuration` set, no fullscreen capability.
- **BottomNav**: `src/components/BottomNav.tsx` (149 lines) has `md:hidden`, defines 5 nav items with `NavItem` interface. Nav items: Home, Vehicles, Add (circular green button), Stats, Profile.
- **Root layout**: `src/app/layout.tsx` (60 lines) wraps children in `<div className="pb-16 md:pb-0">` with `<BottomNav />` outside.
- **Modal pattern**: Codebase uses `fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50` for modals (see ConflictResolver.tsx:42, vehicles/[id]/page.tsx:727).
- **Dark mode**: Consistent `dark:` prefix pattern throughout. Theme context at `src/contexts/ThemeContext.tsx`.
- **No existing desktop nav**: Only `md:hidden` on BottomNav. Desktop users see no navigation.
- **No Portal usage**: App does not use React portals; modals render inline.
- **CSS**: Uses Tailwind v4 with `@import "tailwindcss"` syntax, no tailwind.config file.
- **Content max-width**: Analytics uses `max-w-2xl`, dashboard uses `max-w-4xl`.

---

## Work Objectives

### Core Objective
Enhance the analytics page with interactive chart controls and add desktop sidebar navigation so the app is fully usable on both mobile and desktop.

### Deliverables
1. **Shared nav items module** - Extract nav item data from BottomNav into a shared file
2. **Desktop sidebar component** - Sidebar visible on `md:` and above with icons + text labels
3. **Updated root layout** - Side-by-side sidebar + content on desktop, BottomNav on mobile
4. **Chart fullscreen modal** - Expand button on each chart card, opens fullscreen overlay
5. **Chart animation speed** - All Line and Bar components get `animationDuration={250}`
6. **Data points toggle** - Global toggle to hide/show dots on all line charts
7. **Monthly spending legend toggle** - Click legend items to hide/show bar series

### Definition of Done
- All 4 chart cards have working expand buttons that open a fullscreen modal
- Charts animate at 250ms (not default 1500ms)
- A single toggle button hides/shows data points on all 3 line charts
- Clicking legend items on Monthly Spending toggles bar series visibility
- Desktop sidebar appears on md: breakpoint with correct nav items and active states
- Mobile experience is unchanged (BottomNav still works, no sidebar visible)
- Dark mode works correctly for all new components
- No new npm packages introduced
- TypeScript compiles without errors

---

## Must Have / Must NOT Have (Guardrails)

### MUST Have
- Shared nav items to avoid duplication between BottomNav and Sidebar
- Keyboard accessibility for expand buttons and toggles (Escape to close modal)
- Dark mode support on all new UI
- Active state highlighting matching existing green-600 color scheme
- Responsive chart sizing in fullscreen modal

### Must NOT Have
- No new npm packages
- No changes to the API layer or data fetching logic
- No per-chart dot toggle (one global toggle only)
- No special circular "Add" button treatment on desktop sidebar (just a normal nav item)
- No changes to mobile BottomNav visual design (only refactoring nav item data out)

---

## Task Flow and Dependencies

```
Task 1: Extract shared nav items
    |
    +---> Task 2: Desktop Sidebar component (depends on Task 1)
    |         |
    |         +---> Task 3: Update root layout (depends on Task 2)
    |
    +---> Task 4: Refactor BottomNav to use shared items (depends on Task 1)

Task 5: Chart fullscreen modal component (independent)
    |
    +---> Task 7: Integrate all chart improvements into analytics page
              (depends on Tasks 5, 6)

Task 6: Chart controls state + animation + dot toggle + legend toggle (independent)
    |
    +---> Task 7: Integrate all chart improvements into analytics page
```

**Parallel tracks:**
- Track A (Tasks 1 -> 2 -> 3 + 4): Navigation
- Track B (Tasks 5 + 6 -> 7): Analytics chart improvements

---

## Detailed TODOs

### Task 1: Extract Shared Nav Items
**File:** NEW `src/lib/navItems.tsx`
**Complexity:** Low
**Estimated lines:** ~90

**What to do:**
- Create `src/lib/navItems.tsx` exporting the `NavItem` interface and `navItems` array
- Move the 5 nav item definitions (lines 19-94 of BottomNav.tsx) into this shared file
- Export the `isActive(pathname, href)` utility function (lines 96-101 of BottomNav.tsx)
- Keep SVG icons exactly as-is (both outline `icon` and filled `activeIcon` variants)

**Acceptance Criteria:**
- `NavItem` interface exported from `src/lib/navItems.tsx`
- `navItems` array exported with all 5 items
- `isActivePath(pathname: string, href: string): boolean` exported
- No runtime behavior changes

---

### Task 2: Create Desktop Sidebar Component
**File:** NEW `src/components/Sidebar.tsx`
**Complexity:** Medium
**Estimated lines:** ~70

**What to do:**
- Create a `'use client'` component that imports from `src/lib/navItems.tsx`
- Use `usePathname()` from next/navigation
- Render a `<nav>` with classes: `hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-56 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 z-40`
- Add app title/logo area at top (simple "Fuel Tracker" text, matching existing h1 styling)
- Render each nav item as a `<Link>` with:
  - Icon (w-5 h-5) + text label side by side
  - Active state: `bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-medium`
  - Inactive state: `text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800`
  - Padding: `px-4 py-3` with `gap-3` between icon and label
  - Rounded: `rounded-lg mx-2`
- The "Add" item should render as a normal nav item (no circular green button treatment)
- Items should have `text-sm` labels

**Acceptance Criteria:**
- Hidden on mobile (`hidden md:flex`)
- Shows all 5 nav items with icons and text labels
- Active item uses green-600 color scheme
- Dark mode styling works
- Fixed positioning, full viewport height
- Width: `w-56` (224px)

---

### Task 3: Update Root Layout for Desktop Sidebar
**File:** `src/app/layout.tsx` (60 lines)
**Complexity:** Low

**What to do:**
- Import the new `Sidebar` component
- Change the layout structure inside `<Providers>`:
  ```
  <Sidebar />
  <div className="pb-16 md:pb-0 md:pl-56">
    {children}
  </div>
  <BottomNav />
  ```
- The `md:pl-56` matches the sidebar `w-56` to offset content on desktop

**Acceptance Criteria:**
- On mobile: children have `pb-16` (for BottomNav), no left padding
- On desktop (md+): children have `md:pl-56` (for sidebar), no bottom padding
- Sidebar renders but is `hidden` on mobile via its own classes
- BottomNav renders but is `md:hidden` via its own classes

---

### Task 4: Refactor BottomNav to Use Shared Nav Items
**File:** `src/components/BottomNav.tsx` (149 lines)
**Complexity:** Low

**What to do:**
- Remove the `NavItem` interface definition (lines 7-13)
- Remove the `navItems` array definition (lines 19-94)
- Remove the `isActive` function (lines 96-101)
- Import `{ navItems, isActivePath, type NavItem }` from `@/lib/navItems`
- Replace `isActive(item.href)` calls with `isActivePath(pathname, item.href)`
- Keep all rendering logic (the circular Add button, layout, styles) unchanged

**Acceptance Criteria:**
- BottomNav renders identically to before
- No duplicate nav item definitions
- TypeScript compiles clean

---

### Task 5: Create Chart Fullscreen Modal Component
**File:** NEW `src/components/ChartModal.tsx`
**Complexity:** Medium
**Estimated lines:** ~60

**What to do:**
- Create a `'use client'` component: `ChartModal({ isOpen, onClose, title, children })`
- Props: `isOpen: boolean`, `onClose: () => void`, `title: string`, `children: React.ReactNode`
- When `isOpen` is false, return `null`
- Modal overlay: `fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50` (matching existing pattern from ConflictResolver.tsx)
- Modal content: `bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] p-6`
- Header: title text + close button (X icon) on the right
- Body: `{children}` - the chart will be passed in, wrapped in a taller `ResponsiveContainer`
- Close on Escape key: `useEffect` with `keydown` listener
- Close on backdrop click: `onClick` on the overlay div, with `e.stopPropagation()` on the content div

**Acceptance Criteria:**
- Opens as a centered modal overlay
- Close via X button, Escape key, or backdrop click
- Dark mode support
- Content area large enough for expanded chart (`max-w-5xl`)
- Scrollable if content overflows vertically

---

### Task 6: Add Chart State Management (Analytics Page)
**File:** `src/app/analytics/page.tsx`
**Complexity:** Medium

**What to do - State additions (near line 117-118):**
- Add `const [showDots, setShowDots] = useState(true)` for global dot toggle
- Add `const [expandedChart, setExpandedChart] = useState<string | null>(null)` for tracking which chart is fullscreen (null = none, 'price' | 'mpg' | 'spending' | 'costPerMile')
- Add `const [hiddenBars, setHiddenBars] = useState<Set<string>>(new Set())` for monthly spending legend toggle

**What to do - Legend click handler:**
- Add function `handleLegendClick(dataKey: string)`:
  ```typescript
  const handleLegendClick = (dataKey: string) => {
    setHiddenBars(prev => {
      const next = new Set(prev)
      if (next.has(dataKey)) {
        next.delete(dataKey)
      } else {
        next.add(dataKey)
      }
      return next
    })
  }
  ```

**Acceptance Criteria:**
- Three new state variables added
- Legend click handler toggles items in the Set
- No rendering changes yet (Task 7 integrates)

---

### Task 7: Integrate Chart Improvements into Analytics Page
**File:** `src/app/analytics/page.tsx`
**Complexity:** High (most changes)

**What to do - Imports:**
- Add import for `ChartModal` from `@/components/ChartModal`

**What to do - Global controls bar (insert after the filter section, around line 269):**
- Add a row between the filters and the charts with a dot toggle button:
  ```
  <div className="flex items-center justify-end mb-4">
    <button onClick={() => setShowDots(prev => !prev)} className="...">
      {showDots ? 'Hide' : 'Show'} Data Points
    </button>
  </div>
  ```
- Style the button: `text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors`

**What to do - Expand button per chart card:**
- In each chart card's header (4 occurrences), change from just `<h2>` to a flex row with `<h2>` on the left and an expand button on the right:
  ```
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Price per Gallon</h2>
    <button
      onClick={() => setExpandedChart('price')}
      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      aria-label="Expand Price per Gallon chart"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
    </button>
  </div>
  ```
- Apply to all 4 chart cards with keys: `'price'`, `'mpg'`, `'spending'`, `'costPerMile'`

**What to do - Animation duration:**
- On every `<Line>` component (3 charts x N vehicles each), add `animationDuration={250}`
- On every `<Bar>` component (2 bars in Monthly Spending), add `animationDuration={250}`
- Locations:
  - Price per Gallon Line: line ~310-318
  - MPG Over Time Line: line ~350-358
  - Monthly Spending Bar: line ~397-398
  - Cost per Mile Line: line ~429-437

**What to do - Dot toggle on Line charts:**
- Change `dot={{ r: 3 }}` to `dot={showDots ? { r: 3 } : false}` on all Line components
- Affects 3 chart sections (Price per Gallon, MPG Over Time, Cost per Mile)

**What to do - Monthly Spending legend toggle:**
- On the `<Legend>` component (line ~392-396), add `onClick={(e) => handleLegendClick(e.dataKey)}`
- Add `cursor: 'pointer'` to Legend via `wrapperStyle={{ cursor: 'pointer' }}`
- On each `<Bar>` component, conditionally hide: `hide={hiddenBars.has('totalCost')}` and `hide={hiddenBars.has('gallons')}`
- Update Legend formatter to show strikethrough or dimmed style for hidden items:
  ```typescript
  formatter={(value) => {
    const label = value === 'totalCost' ? 'Total Cost' : value === 'gallons' ? 'Gallons' : value
    return <span style={{ color: hiddenBars.has(value) ? '#9ca3af' : undefined, textDecoration: hiddenBars.has(value) ? 'line-through' : undefined }}>{label}</span>
  }}
  ```

**What to do - Fullscreen modal rendering:**
- After the chart cards section (before closing `</div>` of `space-y-6`), add ChartModal instances.
- Use a helper approach: define a `renderChart(chartKey, chartJSX, height)` function or render the ChartModal conditionally:
  ```tsx
  <ChartModal
    isOpen={expandedChart === 'price'}
    onClose={() => setExpandedChart(null)}
    title="Price per Gallon"
  >
    <ResponsiveContainer width="100%" height={500}>
      {/* Same LineChart as inline but with height={500} */}
    </ResponsiveContainer>
  </ChartModal>
  ```
- To avoid duplicating chart JSX, extract each chart's inner content into a helper function that takes a `height` parameter:
  ```typescript
  const renderPriceChart = (height: number) => (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={priceChartData}>
        {/* ... same chart internals ... */}
      </LineChart>
    </ResponsiveContainer>
  )
  ```
- Do this for all 4 charts, then use `renderPriceChart(250)` inline and `renderPriceChart(500)` in the modal

**Acceptance Criteria:**
- Each chart card has an expand icon button in the top-right
- Clicking expand opens the chart in a fullscreen modal with `height={500}`
- Modal closes via X, Escape, or backdrop click
- All Line and Bar components have `animationDuration={250}`
- "Hide/Show Data Points" toggle works globally across all 3 line charts
- Monthly Spending legend items are clickable; clicking toggles bar visibility
- Hidden legend items show strikethrough text
- Dark mode works for all new UI elements
- No TypeScript errors

---

## Commit Strategy

### Commit 1: Extract shared nav items
- NEW `src/lib/navItems.tsx`
- MODIFIED `src/components/BottomNav.tsx` (refactored to use shared items)
- Message: `refactor(nav): extract shared nav items from BottomNav`

### Commit 2: Add desktop sidebar and update layout
- NEW `src/components/Sidebar.tsx`
- MODIFIED `src/app/layout.tsx`
- Message: `feat(nav): add desktop sidebar navigation with responsive layout`

### Commit 3: Add chart improvements to analytics page
- NEW `src/components/ChartModal.tsx`
- MODIFIED `src/app/analytics/page.tsx`
- Message: `feat(analytics): add chart expand, animation, dot toggle, and legend toggle`

---

## Success Criteria

1. **Desktop navigation**: On viewport >= 768px (md), sidebar is visible on the left with all 5 nav items showing icons + text labels. Active item uses green-600 highlight. Content is offset to the right.
2. **Mobile navigation**: On viewport < 768px, BottomNav is visible at the bottom, sidebar is hidden. No visual changes to BottomNav.
3. **Chart expand**: Each of the 4 chart cards has an expand button. Clicking it opens a fullscreen modal with a larger chart (height 500). Modal is dismissable via X, Escape, or backdrop.
4. **Animation speed**: All chart animations complete in 250ms instead of the default 1500ms.
5. **Dot toggle**: A global "Hide/Show Data Points" button above the charts toggles dot visibility on all 3 line charts.
6. **Legend toggle**: On Monthly Spending chart, clicking "Total Cost" or "Gallons" in the legend hides/shows that bar series. Hidden items show strikethrough text.
7. **Dark mode**: All new components render correctly in dark mode.
8. **Type safety**: `npx tsc --noEmit` passes with zero errors.
9. **No regressions**: Existing functionality (filters, tooltips, data loading, offline notice) continues to work.

---

## Verification Steps

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Build succeeds
npm run build

# 3. Dev server runs without errors
npm run dev

# 4. Manual verification checklist:
# - [ ] Desktop (>= 768px): sidebar visible, content offset, nav items with icons + labels
# - [ ] Desktop: active nav item is green, clicking navigates correctly
# - [ ] Mobile (< 768px): sidebar hidden, BottomNav visible, no layout shift
# - [ ] Analytics: all 4 charts have expand button in top-right
# - [ ] Analytics: clicking expand opens fullscreen modal with larger chart
# - [ ] Analytics: modal closes via X, Escape, backdrop click
# - [ ] Analytics: "Hide Data Points" button toggles dots on all line charts
# - [ ] Analytics: clicking Monthly Spending legend items toggles bars
# - [ ] Analytics: hidden legend items show strikethrough
# - [ ] Dark mode: toggle dark mode, verify sidebar + modal + toggle all render correctly
# - [ ] Charts animate quickly (250ms, not slow 1500ms default)
```
