# Phase 17: Analytics Improvements

## Context

### Original Request
Five improvements to the analytics page:
1. **Bug Fix**: Vehicle filter dropdown loses other vehicles when one is selected
2. **Feature**: Show KPI stats (Fuel Economy, Costs, Activity) on the analytics page
3. **Bug Fix**: Stats nav icon broken SVG in active state (partial bars)
4. **Feature Change**: Legend click behavior -- click to focus, ctrl+click to hide (all charts)
5. **New Feature**: Total Miles by Month chart

### Research Findings
- **Analytics API** (`src/app/api/analytics/route.ts`, 216 lines): Line 92 sets `filteredVehicleIds = [vehicleId]` when a vehicle is selected. Lines 201-207 build `vehiclesWithColors` by filtering `vehicles` array against `filteredVehicleIds`, so the response only includes the selected vehicle. The frontend dropdown at `src/app/analytics/page.tsx` lines 423-427 maps `data?.vehicles` which then only shows one vehicle.
- **KPI Stats**: `src/app/api/vehicles/[id]/stats/route.ts` (191 lines) computes overview, mpg, costs, and frequency stats from fillups. The analytics API already fetches all fillups with odometer, mpg, gallons, totalCost, pricePerGallon -- the same data needed to compute aggregate KPIs server-side.
- **Nav Icons** (`src/lib/navItems.tsx`, 93 lines): Lines 67-69 contain the Stats `activeIcon` SVG. The SVG path uses `h-.75` and `h.75` segments which draw tiny horizontal lines instead of full bars. The inactive icon (lines 62-64) is correct -- uses proper `<path>` with stroke. The activeIcon needs a proper `fill="currentColor"` 3-bar chart SVG.
- **Legend behavior**: Currently only Monthly Spending has a Legend `onClick` handler (line 359). The other three charts (Price, MPG, Cost per Mile) render `<Legend />` with no click behavior. The current toggle uses a global `hiddenBars` Set with simple add/remove logic.
- **Monthly Spending**: Currently aggregated across all vehicles (not per-vehicle). The `monthlySpending` field is `{ month, totalCost, gallons, fillupCount }[]`.
- **Chart pattern**: Each chart has a `renderXxxChart(height)` function returning `<ResponsiveContainer>` with recharts components. Expand button, modal, dots toggle, and tooltipStyle already established in Phase 16.
- **`pivotByVehicle()`**: Generic function that transforms per-point arrays into recharts multi-series format keyed by `date` and vehicle name.
- **Fillup model**: Has `odometer: Int`, `date: DateTime`, `vehicleId: String`. Miles between fillups = odometer difference between consecutive fillups for a vehicle.

---

## Work Objectives

### Core Objective
Fix two bugs (vehicle filter dropdown, stats icon) and add three features (KPI display, focus-mode legends, miles-per-month chart) to the analytics page to make it a comprehensive fuel tracking dashboard.

### Deliverables
1. **Vehicle filter fix** -- API always returns all user vehicles regardless of filter
2. **KPI stats section** -- Collapsible card at top of analytics page showing aggregate stats
3. **Fixed stats nav icon** -- Correct filled 3-bar chart SVG for active state
4. **Focus-mode legends** -- Click = focus single item, Ctrl+click = hide item, on all charts
5. **Miles per Month chart** -- New line chart with per-vehicle monthly miles driven

### Definition of Done
- Selecting a vehicle in the dropdown filters chart data but all vehicles remain selectable
- KPI cards show Fuel Economy, Costs, and Activity stats matching the vehicle detail page layout
- The Stats nav icon renders all 3 bars fully filled when active
- Click on any chart legend focuses that item; Ctrl+click hides it; clicking focused item defocuses
- A new "Miles per Month" chart appears with one line per vehicle
- Dark mode works for all changes
- TypeScript compiles without errors
- Build succeeds

---

## Must Have / Must NOT Have (Guardrails)

### MUST Have
- API returns ALL vehicles in `vehicles` array regardless of `vehicleId` filter param
- KPI stats computed server-side from existing fillups data (no N+1 API calls)
- KPI section works for both "All Vehicles" (aggregate) and single vehicle
- Legend focus/hide behavior on ALL 4 existing charts plus the new Miles per Month chart
- Visual indicator for focused vs hidden vs normal legend items (opacity/strikethrough)
- Miles per Month handles gaps (months with no fillups) via interpolation
- Consistent color assignment for vehicles across all charts

### Must NOT Have
- No new npm packages
- No changes to the Prisma schema or database
- No separate API endpoint for KPIs (compute inline in analytics route)
- No changes to the vehicle detail page stats or its API
- No changes to mobile/desktop layout or sidebar

---

## Task Flow and Dependencies

```
Track A (API Changes):
  Task 1: Fix vehicle filter (vehiclesWithColors)
      |
      +---> Task 2: Add kpiStats to API response
                |
                +---> Task 3: Add monthlyMiles to API response

Track B (Icon Fix - Independent):
  Task 4: Fix Stats activeIcon SVG

Track C (Frontend - depends on Track A):
  Task 5: Add KPI stats section to analytics page (depends on Task 2)
      |
  Task 6: Refactor legend interaction to focus/hide mode (independent of API)
      |
  Task 7: Add Miles per Month chart (depends on Task 3)
      |
  Task 8: Wire up vehicle filter fix on frontend (depends on Task 1)
```

**Parallel tracks:**
- Track A (Tasks 1 -> 2 -> 3): API-side changes, sequential
- Track B (Task 4): Independent icon fix
- Track C (Tasks 5 -> 6 -> 7 -> 8): Frontend changes, mostly sequential

**Optimal execution:** Tasks 1-3 first (API), then Tasks 4-8 (frontend can all run after API is done). Task 4 is fully independent.

---

## Detailed TODOs

### Task 1: Fix Vehicle Filter -- Always Return All Vehicles
**File:** `src/app/api/analytics/route.ts`
**Complexity:** Low
**Lines changed:** ~2

**What to do:**
- Line 201-207: Change `vehiclesWithColors` to use `vehicles` (all vehicles) instead of filtering by `filteredVehicleIds`.

**Current code (lines 200-207):**
```typescript
// Assign colors to vehicles
const vehiclesWithColors = vehicles
  .filter((v) => filteredVehicleIds.includes(v.id))
  .map((v, i) => ({
    id: v.id,
    name: v.name,
    color: VEHICLE_COLORS[i % VEHICLE_COLORS.length],
  }))
```

**New code:**
```typescript
// Assign colors to vehicles - always return ALL vehicles for the dropdown
const vehiclesWithColors = vehicles.map((v, i) => ({
  id: v.id,
  name: v.name,
  color: VEHICLE_COLORS[i % VEHICLE_COLORS.length],
}))
```

**Acceptance Criteria:**
- When `vehicleId=xxx` is set, chart data is still filtered to that vehicle
- The `vehicles` array in the response always contains ALL user vehicles
- Vehicle colors are consistent regardless of which vehicle is selected (color index based on all-vehicles order)
- No frontend changes needed for this fix

---

### Task 2: Add KPI Stats to Analytics API Response
**File:** `src/app/api/analytics/route.ts`
**Complexity:** Medium
**Lines added:** ~80

**What to do:**
After the existing data processing (after costPerMile sort on line 198), compute aggregate KPI stats from the already-fetched `fillups` array. Use the same logic as `src/app/api/vehicles/[id]/stats/route.ts`.

**New `kpiStats` computation:**
```typescript
// Build kpiStats from fillups (same logic as vehicle stats route)
const kpiStats = {
  overview: {
    totalFillups: 0,
    totalGallons: 0,
    totalCost: 0,
    totalMiles: 0,
  },
  mpg: {
    average: null as number | null,
    best: null as number | null,
    worst: null as number | null,
    recent: null as number | null,
  },
  costs: {
    averagePricePerGallon: null as number | null,
    averageCostPerFillup: null as number | null,
    costPerMile: null as number | null,
  },
  frequency: {
    averageDaysBetweenFillups: null as number | null,
    averageMilesBetweenFillups: null as number | null,
  },
}

if (fillups.length > 0) {
  kpiStats.overview.totalFillups = fillups.length
  kpiStats.overview.totalGallons = Math.round(fillups.reduce((s, f) => s + f.gallons, 0) * 100) / 100
  kpiStats.overview.totalCost = Math.round(fillups.reduce((s, f) => s + f.totalCost, 0) * 100) / 100

  // Total miles: sum of (last - first odometer) per vehicle
  for (const [, vFillups] of fillupsByVehicle) {
    if (vFillups.length >= 2) {
      kpiStats.overview.totalMiles += vFillups[vFillups.length - 1].odometer - vFillups[0].odometer
    }
  }

  // MPG stats from full fillups with mpg (must match vehicle stats route: isFull && mpg > 0)
  const fillupsWithMpg = fillups.filter(f => f.isFull && f.mpg !== null && f.mpg > 0)
  if (fillupsWithMpg.length > 0) {
    const mpgValues = fillupsWithMpg.map(f => f.mpg as number)
    kpiStats.mpg.average = Math.round((mpgValues.reduce((s, v) => s + v, 0) / mpgValues.length) * 10) / 10
    kpiStats.mpg.best = Math.round(Math.max(...mpgValues) * 10) / 10
    kpiStats.mpg.worst = Math.round(Math.min(...mpgValues) * 10) / 10
    const recentMpg = fillupsWithMpg.slice(-5).map(f => f.mpg as number)
    kpiStats.mpg.recent = Math.round((recentMpg.reduce((s, v) => s + v, 0) / recentMpg.length) * 10) / 10
  }

  // Cost stats
  kpiStats.costs.averagePricePerGallon = Math.round((fillups.reduce((s, f) => s + f.pricePerGallon, 0) / fillups.length) * 1000) / 1000
  kpiStats.costs.averageCostPerFillup = Math.round((kpiStats.overview.totalCost / fillups.length) * 100) / 100
  if (kpiStats.overview.totalMiles > 0) {
    kpiStats.costs.costPerMile = Math.round((kpiStats.overview.totalCost / kpiStats.overview.totalMiles) * 100) / 100
  }

  // Frequency stats (need at least 2 fillups)
  if (fillups.length >= 2) {
    const firstDate = fillups[0].date.getTime()
    const lastDate = fillups[fillups.length - 1].date.getTime()
    const daysBetween = (lastDate - firstDate) / (1000 * 60 * 60 * 24)
    kpiStats.frequency.averageDaysBetweenFillups = Math.round((daysBetween / (fillups.length - 1)) * 10) / 10
    kpiStats.frequency.averageMilesBetweenFillups = Math.round(kpiStats.overview.totalMiles / (fillups.length - 1))
  }
}
```

**Add `kpiStats` to the response:**
```typescript
return NextResponse.json({
  priceHistory,
  mpgHistory,
  monthlySpending,
  costPerMile,
  vehicles: vehiclesWithColors,
  kpiStats,  // NEW
})
```

**Also add `kpiStats` to the empty-data early returns (lines 53-59 and 70-78):**
```typescript
kpiStats: {
  overview: { totalFillups: 0, totalGallons: 0, totalCost: 0, totalMiles: 0 },
  mpg: { average: null, best: null, worst: null, recent: null },
  costs: { averagePricePerGallon: null, averageCostPerFillup: null, costPerMile: null },
  frequency: { averageDaysBetweenFillups: null, averageMilesBetweenFillups: null },
},
```

**Important note:** The `fillupsByVehicle` Map is already built on lines 171-179. The KPI computation MUST be placed AFTER that Map is built (after line 195). The `isFull` field is NOT selected in the current Prisma query (line 106-116) -- add `isFull: true` to the `select` clause so MPG filtering can match the vehicle stats route behavior (`f.isFull && f.mpg !== null`).

**Acceptance Criteria:**
- `kpiStats` field present in all API responses (including empty-data early returns)
- Stats match vehicle detail page logic for a single vehicle
- Aggregate stats sum/average correctly across multiple vehicles
- `isFull` field added to fillup select clause
- No N+1 queries

---

### Task 3: Add Monthly Miles to Analytics API Response
**File:** `src/app/api/analytics/route.ts`
**Complexity:** Medium-High
**Lines added:** ~60

**What to do:**
After computing `kpiStats`, build a `monthlyMiles` field. For each vehicle, compute miles driven between consecutive fillups and assign to months.

**Algorithm:**
```typescript
// Build monthlyMiles: for each vehicle, compute miles per month
interface MonthlyMilesPoint {
  month: string  // "YYYY-MM"
  vehicleId: string
  vehicleName: string
  miles: number
}

const monthlyMilesRaw: MonthlyMilesPoint[] = []

for (const [vId, vFillups] of fillupsByVehicle) {
  if (vFillups.length < 2) continue
  const vName = vehicleNameMap.get(vId) || ''

  for (let i = 1; i < vFillups.length; i++) {
    const prev = vFillups[i - 1]
    const curr = vFillups[i]
    const milesDriven = curr.odometer - prev.odometer
    if (milesDriven <= 0) continue

    const prevDate = prev.date
    const currDate = curr.date

    // Get all months in the range [prevDate, currDate]
    const startMonth = new Date(prevDate.getFullYear(), prevDate.getMonth(), 1)
    const endMonth = new Date(currDate.getFullYear(), currDate.getMonth(), 1)

    // Count months in range
    const months: string[] = []
    const iter = new Date(startMonth)
    while (iter <= endMonth) {
      months.push(`${iter.getFullYear()}-${String(iter.getMonth() + 1).padStart(2, '0')}`)
      iter.setMonth(iter.getMonth() + 1)
    }

    // Spread miles evenly across months in the gap
    const milesPerMonth = milesDriven / months.length
    for (const month of months) {
      monthlyMilesRaw.push({
        month,
        vehicleId: vId,
        vehicleName: vName,
        miles: Math.round(milesPerMonth * 10) / 10,
      })
    }
  }
}

// Aggregate by vehicle + month (a month may have multiple fillup segments)
const monthlyMilesAgg = new Map<string, MonthlyMilesPoint>()
for (const point of monthlyMilesRaw) {
  const key = `${point.vehicleId}-${point.month}`
  const existing = monthlyMilesAgg.get(key)
  if (existing) {
    existing.miles = Math.round((existing.miles + point.miles) * 10) / 10
  } else {
    monthlyMilesAgg.set(key, { ...point })
  }
}

const monthlyMiles = Array.from(monthlyMilesAgg.values())
  .sort((a, b) => a.month.localeCompare(b.month))
```

**Add to response:**
```typescript
return NextResponse.json({
  priceHistory,
  mpgHistory,
  monthlySpending,
  costPerMile,
  vehicles: vehiclesWithColors,
  kpiStats,
  monthlyMiles,  // NEW
})
```

**Add to empty-data early returns:**
```typescript
monthlyMiles: [],
```

**Acceptance Criteria:**
- `monthlyMiles` is an array of `{ month, vehicleId, vehicleName, miles }` objects
- Miles between consecutive fillups are spread evenly across the months they span
- Multiple fillup segments in the same month for the same vehicle are summed
- Data is sorted by month ascending
- Empty array returned when no data

---

### Task 4: Fix Stats Nav Icon Active State
**File:** `src/lib/navItems.tsx`
**Complexity:** Low
**Lines changed:** ~4

**What to do:**
Replace the broken `activeIcon` SVG path (lines 67-69) with a correct Heroicons solid chart-bar SVG that renders 3 fully filled bars.

**Current broken SVG (lines 67-69):**
```tsx
<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
  <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V4.125c0-1.036.84-1.875 1.875-1.875h.75zm-4.5 4.5c-1.035 0-1.875.84-1.875 1.875v11.25c0 1.035.84 1.875 1.875 1.875h-.75A1.875 1.875 0 0112 19.875V8.625c0-1.036.84-1.875 1.875-1.875h.75zM6.375 10.875c-1.036 0-1.875.84-1.875 1.875v6.75c0 1.035.84 1.875 1.875 1.875h-.75A1.875 1.875 0 014.5 19.5v-6.75c0-1.036.84-1.875 1.875-1.875h.75z" />
</svg>
```

**Replacement -- Heroicons v2 solid `chart-bar` (3 bars, ascending left to right):**
```tsx
<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
  <path fillRule="evenodd" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" clipRule="evenodd" />
</svg>
```

**Note:** This is the same path geometry as the outline/stroke version (the inactive icon on lines 62-64) but rendered as a single filled path with `fillRule="evenodd"` and `clipRule="evenodd"`, using `fill="currentColor"` instead of `stroke`. The key difference from the broken version is that this uses proper closed shapes (capital `Z` path commands) instead of the `h-.75`/`h.75` partial line segments.

**Acceptance Criteria:**
- Active Stats icon shows 3 fully filled bars (short, medium, tall from left to right)
- Icon matches the same bar proportions as the inactive stroke version
- `fill="currentColor"` ensures it inherits the active nav color
- No visual regression on the inactive (outline) icon

---

### Task 5: Add KPI Stats Section to Analytics Page
**File:** `src/app/analytics/page.tsx`
**Complexity:** Medium
**Lines added:** ~120

**What to do:**

**5a. Update `AnalyticsData` interface (around line 68):**
Add the `kpiStats` field to match the API response:
```typescript
interface KpiStats {
  overview: {
    totalFillups: number
    totalGallons: number
    totalCost: number
    totalMiles: number
  }
  mpg: {
    average: number | null
    best: number | null
    worst: number | null
    recent: number | null
  }
  costs: {
    averagePricePerGallon: number | null
    averageCostPerFillup: number | null
    costPerMile: number | null
  }
  frequency: {
    averageDaysBetweenFillups: number | null
    averageMilesBetweenFillups: number | null
  }
}

interface AnalyticsData {
  priceHistory: PricePoint[]
  mpgHistory: MpgPoint[]
  monthlySpending: MonthlySpendingPoint[]
  costPerMile: CostPerMilePoint[]
  vehicles: VehicleInfo[]
  kpiStats: KpiStats          // NEW
  monthlyMiles: MonthlyMilesPoint[]  // NEW (for Task 7)
}
```

**5b. Add collapsed state:**
```typescript
const [kpiExpanded, setKpiExpanded] = useState(true)
```

**5c. Render KPI section (after "Data Points Toggle" button, before charts):**
Place a collapsible card between the controls row and `<div className="space-y-6">`. Layout mirrors `src/app/vehicles/[id]/page.tsx` lines 538-637 (the Statistics section with Fuel Economy, Costs, Activity cards).

```tsx
{/* KPI Stats */}
{data && data.kpiStats.overview.totalFillups > 0 && (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
    <button
      onClick={() => setKpiExpanded(prev => !prev)}
      className="w-full flex items-center justify-between p-4"
    >
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">Key Metrics</h2>
      <svg className={`w-5 h-5 text-gray-400 transition-transform ${kpiExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {kpiExpanded && (
      <div className="px-4 pb-4 space-y-4">
        {/* Fuel Economy */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Fuel Economy</h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Average MPG, Recent MPG, Best MPG, Worst MPG */}
            {/* Same layout as vehicles/[id]/page.tsx lines 544-568 */}
          </div>
        </div>
        {/* Costs */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Costs</h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Total Spent, Per Mile, Avg $/Gallon, Avg Fillup */}
          </div>
        </div>
        {/* Activity */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Activity</h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Total Fillups, Miles Tracked, Avg Between Fillups, Avg Miles/Fillup */}
          </div>
        </div>
      </div>
    )}
  </div>
)}
```

**Acceptance Criteria:**
- KPI section appears between controls row and charts
- Shows 3 sub-cards: Fuel Economy, Costs, Activity
- Same visual layout as vehicle detail page stats section
- Collapsible via chevron button
- Hidden when no fillup data
- Dark mode support
- Works for both "All Vehicles" (aggregate) and single vehicle filter

---

### Task 6: Refactor Legend Interaction to Focus/Hide Mode
**File:** `src/app/analytics/page.tsx`
**Complexity:** High
**Lines changed:** ~80

**What to do:**

**6a. Replace `hiddenBars` state with per-chart legend state:**

Remove:
```typescript
const [hiddenBars, setHiddenBars] = useState<Set<string>>(new Set())
```

Add:
```typescript
// Legend interaction state per chart
// focusedItem: if set, only this item is fully visible; all others are dimmed
// hiddenItems: items explicitly hidden via ctrl+click
interface LegendState {
  focusedItem: string | null
  hiddenItems: Set<string>
}

const [legendStates, setLegendStates] = useState<Record<string, LegendState>>({})

const getLegendState = (chartKey: string): LegendState => {
  return legendStates[chartKey] || { focusedItem: null, hiddenItems: new Set() }
}

const handleLegendClick = (chartKey: string, dataKey: string, ctrlKey: boolean) => {
  setLegendStates(prev => {
    const current = prev[chartKey] || { focusedItem: null, hiddenItems: new Set() }

    if (ctrlKey) {
      // Ctrl+click: toggle hide for this specific item, clear focus
      const nextHidden = new Set(current.hiddenItems)
      if (nextHidden.has(dataKey)) {
        nextHidden.delete(dataKey)
      } else {
        nextHidden.add(dataKey)
      }
      return { ...prev, [chartKey]: { focusedItem: null, hiddenItems: nextHidden } }
    } else {
      // Regular click: focus mode
      if (current.focusedItem === dataKey) {
        // Clicking the focused item again: defocus, show all
        return { ...prev, [chartKey]: { focusedItem: null, hiddenItems: new Set() } }
      } else {
        // Focus on this item, clear hidden
        return { ...prev, [chartKey]: { focusedItem: dataKey, hiddenItems: new Set() } }
      }
    }
  })
}
```

**6b. Helper to determine item visibility:**
```typescript
const getItemOpacity = (chartKey: string, dataKey: string): number => {
  const state = getLegendState(chartKey)
  if (state.hiddenItems.has(dataKey)) return 0  // hidden
  if (state.focusedItem === null) return 1       // no focus, all visible
  return state.focusedItem === dataKey ? 1 : 0.15  // focused: full, others: dimmed
}

const isItemHidden = (chartKey: string, dataKey: string): boolean => {
  const state = getLegendState(chartKey)
  return state.hiddenItems.has(dataKey)
}
```

**6c. Update all chart render functions:**

For **line charts** (Price, MPG, Cost per Mile), add `strokeOpacity` and `fillOpacity` to each `<Line>`:
```tsx
<Line
  key={name}
  type="monotone"
  dataKey={name}
  stroke={vehicleColorMap.get(name) || VEHICLE_COLORS[i % VEHICLE_COLORS.length]}
  strokeWidth={2}
  strokeOpacity={getItemOpacity('price', name)}
  dot={showDots && getItemOpacity('price', name) > 0 ? { r: 3 } : false}
  connectNulls
  animationDuration={250}
/>
```

For **bar chart** (Monthly Spending), use `hide` prop when opacity is 0, else use `fillOpacity`:
```tsx
<Bar
  dataKey="totalCost"
  fill="#3b82f6"
  radius={[4, 4, 0, 0]}
  animationDuration={250}
  hide={isItemHidden('spending', 'totalCost')}
  fillOpacity={getItemOpacity('spending', 'totalCost')}
/>
```

**6d. Add Legend `onClick` to ALL charts (not just Monthly Spending):**

For line charts, add to `<Legend>`:
```tsx
<Legend
  onClick={(data, _index, event) => {
    const nativeEvent = event as unknown as React.MouseEvent
    handleLegendClick('price', data.dataKey as string, nativeEvent.ctrlKey || nativeEvent.metaKey)
  }}
  wrapperStyle={{ cursor: 'pointer' }}
  formatter={(value) => {
    const opacity = getItemOpacity('price', String(value))
    return (
      <span style={{
        color: opacity === 0 ? '#9ca3af' : undefined,
        textDecoration: opacity === 0 ? 'line-through' : undefined,
        opacity: opacity === 0 ? 0.5 : opacity < 1 ? 0.4 : 1,
      }}>
        {value}
      </span>
    )
  }}
/>
```

For Monthly Spending bar chart, similar but with label mapping:
```tsx
formatter={(value) => {
  const label = value === 'totalCost' ? 'Total Cost' : value === 'gallons' ? 'Gallons' : value
  const opacity = getItemOpacity('spending', String(value))
  return (
    <span style={{
      color: opacity === 0 ? '#9ca3af' : undefined,
      textDecoration: opacity === 0 ? 'line-through' : undefined,
      opacity: opacity === 0 ? 0.5 : opacity < 1 ? 0.4 : 1,
    }}>
      {label}
    </span>
  )
}}
```

**6e. Use chart keys:** `'price'`, `'mpg'`, `'spending'`, `'costPerMile'`, `'miles'` (for the new chart in Task 7).

**Acceptance Criteria:**
- Clicking a legend item focuses it: only that item is fully visible, others are dimmed (0.15 opacity)
- Clicking the same focused item defocuses: all items return to full visibility
- Ctrl+click (or Cmd+click on Mac) hides the clicked item, others remain visible
- Hidden items show strikethrough + dimmed legend text
- Focused-but-not-active items show dimmed legend text
- Each chart tracks its own legend state independently
- Legend interaction works on all 5 charts (4 existing + 1 new)

---

### Task 7: Add Miles per Month Chart
**File:** `src/app/analytics/page.tsx`
**Complexity:** Medium
**Lines added:** ~60

**What to do:**

**7a. Add `MonthlyMilesPoint` interface (near other interfaces):**
```typescript
interface MonthlyMilesPoint {
  month: string
  vehicleId: string
  vehicleName: string
  miles: number
}
```

**7b. Pivot monthly miles data (after existing pivots around line 210):**
```typescript
// pivotByVehicle expects 'date' key, so remap 'month' to 'date' for reuse
const monthlyMilesChartData = data
  ? pivotByVehicle(
      data.monthlyMiles.map(p => ({ ...p, date: p.month })),
      'miles'
    )
  : []
```

**7c. Create `renderMilesChart(height)` function (after other render functions):**
```typescript
const renderMilesChart = (height: number) => (
  <ResponsiveContainer width="100%" height={height}>
    <LineChart data={monthlyMilesChartData}>
      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
      <XAxis
        dataKey="date"
        tickFormatter={formatMonthLabel}
        stroke={axisColor}
        fontSize={12}
      />
      <YAxis
        stroke={axisColor}
        fontSize={12}
        tickFormatter={(v: number) => `${Math.round(v)}`}
      />
      <Tooltip
        contentStyle={tooltipStyle}
        labelFormatter={(label) => formatMonthLabel(String(label))}
        formatter={(value) => [`${Number(value).toFixed(0)} mi`, '']}
      />
      <Legend
        onClick={(data, _index, event) => {
          const nativeEvent = event as unknown as React.MouseEvent
          handleLegendClick('miles', data.dataKey as string, nativeEvent.ctrlKey || nativeEvent.metaKey)
        }}
        wrapperStyle={{ cursor: 'pointer' }}
        formatter={(value) => {
          const opacity = getItemOpacity('miles', String(value))
          return (
            <span style={{
              color: opacity === 0 ? '#9ca3af' : undefined,
              textDecoration: opacity === 0 ? 'line-through' : undefined,
              opacity: opacity === 0 ? 0.5 : opacity < 1 ? 0.4 : 1,
            }}>
              {value}
            </span>
          )
        }}
      />
      {vehicleNames.map((name, i) => (
        <Line
          key={name}
          type="monotone"
          dataKey={name}
          stroke={vehicleColorMap.get(name) || VEHICLE_COLORS[i % VEHICLE_COLORS.length]}
          strokeWidth={2}
          strokeOpacity={getItemOpacity('miles', name)}
          dot={showDots && getItemOpacity('miles', name) > 0 ? { r: 3 } : false}
          connectNulls
          animationDuration={250}
        />
      ))}
    </LineChart>
  </ResponsiveContainer>
)
```

**7d. Add chart card (after Cost per Mile chart card, before the ChartModal section):**
```tsx
{/* Miles per Month Chart */}
{data!.monthlyMiles.length > 0 && (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">Miles per Month</h2>
      {expandButton('miles', 'Miles per Month')}
    </div>
    {renderMilesChart(250)}
  </div>
)}
```

**7e. Add ChartModal for miles chart (after the existing ChartModals):**
```tsx
<ChartModal isOpen={expandedChart === 'miles'} onClose={() => setExpandedChart(null)} title="Miles per Month">
  {renderMilesChart(500)}
</ChartModal>
```

**7f. Update `hasData` check (line 200-205) to include monthlyMiles:**
```typescript
const hasData = data && (
  data.priceHistory.length > 0 ||
  data.mpgHistory.length > 0 ||
  data.monthlySpending.length > 0 ||
  data.costPerMile.length > 0 ||
  data.monthlyMiles.length > 0  // NEW
)
```

**Acceptance Criteria:**
- New "Miles per Month" chart card appears after Cost per Mile
- One line per vehicle, colored consistently with other charts
- X-axis uses month format (e.g., "Jan '25")
- Y-axis shows miles as integers
- Tooltip shows "[value] mi"
- Has expand button and fullscreen modal
- Dots toggle works
- Legend click focus/hide works
- Chart hidden when no monthly miles data

---

### Task 8: Verify Vehicle Filter Fix on Frontend
**File:** `src/app/analytics/page.tsx`
**Complexity:** Low (verification only)
**Lines changed:** 0

**What to do:**
No frontend changes needed for the vehicle filter fix. The dropdown at lines 422-428 already maps `data?.vehicles` -- once the API returns all vehicles, the dropdown will automatically show all vehicles.

Verify that:
1. `vehicleNames` (line 220) derived from `data.vehicles` will contain all vehicles regardless of filter
2. The `pivotByVehicle` functions will only have data points for the filtered vehicle, so lines for non-selected vehicles simply won't appear in the chart (they won't break)
3. The `vehicleColorMap` will be consistent since colors are now based on the all-vehicles list

**However**, there is one consideration: when a specific vehicle is selected, `vehicleNames` will contain ALL vehicle names, so `renderXxxChart` will create `<Line>` components for all vehicles. But only the selected vehicle's data will exist in the pivoted data, so the extra lines will simply have no data points and won't render. This is acceptable -- recharts handles missing data gracefully.

**Alternative approach (optimization):** If we want to avoid rendering empty Line components, we could derive `vehicleNames` from the actual data points rather than from `data.vehicles`. But this is a minor optimization and not required for correctness.

**Acceptance Criteria:**
- Selecting "Vehicle A" in dropdown shows only Vehicle A's data in charts
- The dropdown still shows all vehicles (Vehicle A, Vehicle B, etc.)
- Selecting "All Vehicles" restores all data
- Vehicle colors remain consistent across filter changes

---

## Commit Strategy

### Commit 1: Fix vehicle filter dropdown and stats icon
- MODIFIED `src/app/api/analytics/route.ts` (remove `.filter()` on vehiclesWithColors)
- MODIFIED `src/lib/navItems.tsx` (replace broken activeIcon SVG)
- Message: `fix(analytics): always return all vehicles in filter dropdown and fix Stats icon SVG`

### Commit 2: Add KPI stats and monthly miles to analytics API
- MODIFIED `src/app/api/analytics/route.ts` (add kpiStats computation, add monthlyMiles computation, add isFull to select)
- Message: `feat(analytics): add KPI stats and monthly miles data to analytics API`

### Commit 3: Add KPI section and Miles per Month chart to frontend
- MODIFIED `src/app/analytics/page.tsx` (add interfaces, KPI card, miles chart, render function, modal)
- Message: `feat(analytics): add KPI metrics section and Miles per Month chart`

### Commit 4: Refactor legend interaction to focus/hide mode
- MODIFIED `src/app/analytics/page.tsx` (replace hiddenBars with legendStates, update all charts)
- Message: `feat(analytics): add focus/hide legend click behavior to all charts`

---

## Risk Identification

| Risk | Severity | Mitigation |
|------|----------|------------|
| `pivotByVehicle` uses `date` key but monthlyMiles has `month` key | Medium | Remap `month` to `date` before calling pivotByVehicle (addressed in Task 7b) |
| recharts `Legend` onClick event type access to `ctrlKey` | Low | The third argument is `React.MouseEvent` (imported from 'react' in recharts types). `ctrlKey`/`metaKey` are available directly; the `as unknown as React.MouseEvent` cast is redundant but harmless |
| Empty `<Line>` components for non-selected vehicles when filtering | Low | recharts handles missing data gracefully; lines simply don't render |
| Large fillup datasets could make monthlyMiles computation slow | Low | Computation is O(n) per vehicle, already bounded by the fillups query |
| `isFull` field not currently in fillup select clause | Medium | Must add to Prisma select; forgetting this will make MPG stats differ from vehicle page |
| KPI aggregate "total miles" across vehicles may seem misleadingly large | Low | This is expected behavior -- it's the sum of all vehicles' miles |
| All legend items hidden via Ctrl+click leaves empty chart | Low | Acceptable UX -- user can Ctrl+click each item back. Regular click (focus mode) always resets hiddenItems to empty Set, so clicking any legend item after hiding all will enter focus mode and show that item |

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
# Vehicle Filter:
# - [ ] Select a vehicle in dropdown -- chart data filters, dropdown still shows all vehicles
# - [ ] Select different vehicle -- dropdown still shows all vehicles
# - [ ] Select "All Vehicles" -- all data restored
# - [ ] Vehicle colors are consistent regardless of filter selection
#
# KPI Stats:
# - [ ] "Key Metrics" card appears above charts when data exists
# - [ ] Shows Fuel Economy (Avg MPG, Recent, Best, Worst)
# - [ ] Shows Costs (Total Spent, Per Mile, Avg $/Gallon, Avg Fillup)
# - [ ] Shows Activity (Total Fillups, Miles Tracked, Avg Between, Avg Miles/Fillup)
# - [ ] Collapsible via chevron click
# - [ ] Updates when vehicle filter changes
# - [ ] Values match vehicle detail page for single vehicle selection
# - [ ] Dark mode renders correctly
#
# Stats Icon:
# - [ ] Navigate to Analytics page -- bottom nav Stats icon shows 3 full bars when active
# - [ ] Navigate away -- Stats icon shows outline version
# - [ ] Both light and dark mode render correctly
#
# Legend Focus/Hide:
# - [ ] Click legend item on Price chart -- only that vehicle line is fully visible
# - [ ] Click same item again -- all lines restored
# - [ ] Click different item -- focus switches to new item
# - [ ] Ctrl+click item -- that item hidden, others visible
# - [ ] Ctrl+click hidden item -- restored
# - [ ] Legend text shows dimmed/strikethrough for hidden items
# - [ ] Each chart has independent legend state
# - [ ] Works on all 5 charts (Price, MPG, Spending, Cost/Mile, Miles/Month)
#
# Miles per Month:
# - [ ] New chart card "Miles per Month" appears after Cost per Mile
# - [ ] Shows one line per vehicle with correct colors
# - [ ] X-axis shows month labels (e.g., "Jan '25")
# - [ ] Tooltip shows mile values
# - [ ] Expand button opens fullscreen modal
# - [ ] Dots toggle works
# - [ ] Legend focus/hide works
# - [ ] Chart hidden when no data available
```

---

## Success Criteria

1. **Vehicle filter**: Dropdown always shows all vehicles; selecting one filters chart data only
2. **KPI stats**: 3 metric cards (Fuel Economy, Costs, Activity) displayed above charts, collapsible, responsive to vehicle filter
3. **Stats icon**: Active state renders 3 fully filled bars matching the inactive icon proportions
4. **Legend interaction**: Click focuses, Ctrl+click hides, works on all 5 charts independently
5. **Miles per Month**: New line chart with per-vehicle monthly miles, expand/modal/dots/legend support
6. **Quality**: TypeScript compiles clean, build passes, dark mode works, no regressions
