# Phase 15: Offline Auth Fix, Analytics Page, Thousandths Pricing

## Revision History

- **v6 (2026-02-12):** Added retroactive price adjustment to Sub-Plan 15-03. When a user sets `defaultThousandths` on the profile page, the PATCH handler now retroactively adjusts ALL historical fillup prices that don't already have thousandths applied. Uses a round-cent detection heuristic (`Math.round(price * 100) / 100 === price`) to identify which fillups need adjustment. Updates are executed in a Prisma `$transaction` for atomicity. The API response now includes an `adjustedFillups` count, and the profile UI shows feedback (e.g., "47 historical fillups adjusted"). Updated acceptance criteria (removed "NOT retroactively modified" criterion, added retroactive adjustment criteria), added new risks (large datasets, irreversibility, floating point detection edge cases), and added verification steps for retroactive behavior.
- **v5 (2026-02-12):** Fixed four issues identified by Critic review of v4. (1) Removed incorrect CachedVehicle-to-Vehicle mapping code in Step 2e -- the `CachedVehicle` and `Vehicle` interfaces are structurally identical (both use flat `groupId`/`groupName` fields), so `setVehicles(cached)` works directly with no mapping needed. (2) Fixed `isLoading` never being set to `false` in the offline path -- `fetchVehicles()` is the only place that calls `setIsLoading(false)`, but it never runs when offline, causing the loading gate (`status === 'loading' || isLoading`) to trap the page on a spinner forever. Added `setIsLoading(false)` after both success and failure of cache load. (3) Clarified render guard placement with explicit state machine showing the full loading/offline/render flow. (4) Added known limitation note about cached data quality from the dashboard's `cacheVehicles()` call.
- **v4 (2026-02-12):** Moved `/vehicles` page (`src/app/vehicles/page.tsx`) from Category C (offline notice only) to Category A (cached data support). The caching infrastructure already exists: `cacheVehicles()` is called by the dashboard when online, and `getCachedVehicles()` can retrieve cached data. The vehicles list page now reads from this cache when offline instead of showing a generic "requires connection" notice. Added Step 2e implementation details, updated Files to Modify, acceptance criteria, and verification steps. Category C now only contains the groups page.
- **v3 (2026-02-12):** Added Sub-Plan 15-04 (Fillup History KPI Fix). The fillup history page's KPI cards were calculating totals from only the loaded/paginated fillups instead of the full vehicle dataset. 15-04 fetches from the existing `/api/vehicles/[id]/stats` endpoint for accurate totals, adds richer KPI cards (total cost, cost per mile), and adds optional date-range query parameters to the stats endpoint so KPIs reflect active filters. Updated dependency graph, commit strategy, and success criteria.
- **v2 (2026-02-12):** Revised to address Critic feedback. Changes: (1) expanded 15-01 to cover ALL 13 pages with auth redirect, (2) added hydration race condition fix via synchronous `navigator.onLine` fallback, (3) changed `defaultThousandths` default to `0` (opt-in), (4) added `pricePerGallonRaw` string field to fix decimal detection at API layer, (5) declared 15-02 dependency on 15-01 and included inline offline guard pattern.

## Phase Overview

**Goal:** Deliver four distinct improvements to the fuel-tracker PWA: (1) fix broken offline experience caused by premature auth redirects, (2) add a new analytics page with time-series charts, (3) add configurable thousandths pricing for US-style fuel prices, and (4) fix fillup history KPI cards to show accurate totals from the server instead of only loaded/paginated data.

**Scope:** Client-side auth guards, new API endpoint + charting page, Prisma schema migration + profile/fillup logic changes, stats endpoint enhancement + KPI card refactor.

**Dependencies:**
- Phase 14 (Fix PWA Install) - COMPLETE
- Existing offline infrastructure (OfflineContext, useNetworkStatus, service worker) - STABLE
- Existing fillup/vehicle data model - STABLE
- Existing `/api/vehicles/[id]/stats` endpoint - STABLE

**Execution Order:** Sub-plan 15-01 MUST complete first (15-02 depends on it for the offline auth guard pattern). Sub-plans 15-02, 15-03, and 15-04 are independent of each other and can run in parallel after 15-01 is complete.

**Dependency Graph:**
```
15-01 (Offline Auth Fix)
  |
  +---> 15-02 (Analytics Page) -- uses offline guard pattern from 15-01
  |
  +---> 15-03 (Thousandths Pricing) -- independent, parallel with 15-02 and 15-04
  |
  +---> 15-04 (Fillup History KPI Fix) -- independent, parallel with 15-02 and 15-03
```

---

## Sub-Plan 15-01: PWA Offline Auth Fix

### Problem Statement

When the PWA goes offline, `useSession()` from next-auth cannot reach the server and returns `status: 'unauthenticated'`. **13 pages** have client-side guards that detect this status and immediately `router.push('/login')`, destroying the offline experience before the service worker fallback can even activate.

### Root Cause

The issue is purely client-side. The `authorized` callback in `src/auth.config.ts` (line 43) runs as Next.js middleware on the server -- it is not reachable when offline, so it is not the direct cause. The real problem is the client-side `useEffect` (or inline render) pattern across 13 pages that redirects to `/login` when `status === 'unauthenticated'`.

### Complete Inventory of Affected Pages

Every page with an auth redirect pattern has been identified, categorized by what offline experience it should provide, and assigned the appropriate fix:

#### Category A: Pages with cached data support (show cached data when offline)

These pages either already use `useOffline()` / `useOfflineQueue()` or have existing IndexedDB caching infrastructure available. When offline, they should display cached data with a "cached data" banner.

| # | File | Line | Hook Available | Offline Behavior |
|---|------|------|----------------|------------------|
| 1 | `src/app/dashboard/page.tsx` | 117 | `useOffline()` (line 56) | Show cached vehicles/stats via `loadCachedData()` |
| 2 | `src/app/vehicles/[id]/page.tsx` | 230 | `useOffline()` (line 80) | Show cached vehicle detail from IndexedDB |
| 3 | `src/app/vehicles/[id]/fillups/page.tsx` | 91 | `useOffline()` (line 57) | Show cached fillups + pending queue |
| 4 | `src/app/fillups/new/page.tsx` | 67 | `useOfflineQueue()` (line 58) | Show form with cached vehicles, queue submission offline |
| 5 | `src/app/vehicles/page.tsx` | 32 | Add `useNetworkStatus` + `getCachedVehicles` | Show cached vehicles list from IndexedDB with "cached data" banner |

#### Category B: Pages that require server connectivity (show "requires connection" notice)

These pages perform server-only operations (create, edit, import) that cannot function offline. They do NOT currently import any offline hook and must add one.

| # | File | Line | Needs Import | Offline Behavior |
|---|------|------|--------------|------------------|
| 6 | `src/app/import/page.tsx` | 55 | Add `useNetworkStatus` | "Import requires an internet connection" notice |
| 7 | `src/app/vehicles/new/page.tsx` | 45 | Add `useNetworkStatus` | "Creating a vehicle requires an internet connection" notice |
| 8 | `src/app/vehicles/[id]/edit/page.tsx` | 52 | Add `useNetworkStatus` | "Editing a vehicle requires an internet connection" notice |
| 9 | `src/app/fillups/[id]/edit/page.tsx` | 68 | Add `useNetworkStatus` | "Editing a fillup requires an internet connection" notice |
| 10 | `src/app/groups/join/page.tsx` | 15 | Add `useNetworkStatus` | "Joining a group requires an internet connection" notice |
| 11 | `src/app/groups/new/page.tsx` | 24 | Add `useNetworkStatus` | "Creating a group requires an internet connection" notice |

#### Category C: Pages that list data without caching infrastructure (show "requires connection")

The groups page lists data that could theoretically be cached but does NOT currently have caching infrastructure. For simplicity, show "requires connection" notice. Future phases can add caching.

| # | File | Line | Needs Import | Offline Behavior |
|---|------|------|--------------|------------------|
| 12 | `src/app/groups/page.tsx` | 26 | Add `useNetworkStatus` | "Groups list requires an internet connection" notice |

#### Category D: Pages with existing offline hook but special handling

| # | File | Line | Hook Available | Offline Behavior |
|---|------|------|----------------|------------------|
| 13 | `src/app/profile/page.tsx` | 41, 133 | `useOffline()` (line 15) | Show offline notice (profile settings not available offline) |

### Fix Strategy

#### The Core Guard Pattern

Every auth redirect across all 13 pages must use the same guarded pattern. To prevent the SSR hydration race condition (Critical Issue 2), the guard includes a synchronous `navigator.onLine` fallback:

```typescript
// SAFE OFFLINE GUARD PATTERN (use on ALL pages)
if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
  router.push('/login')
  return  // or return null for inline guards
}
```

**Why the double-check with `navigator.onLine`:**

The `useNetworkStatus` hook (in `src/hooks/useNetworkStatus.ts`) initializes `isOnline = true` for SSR hydration compatibility. The actual `navigator.onLine` value is set in a `useEffect` AFTER the first render. This creates a race condition:

1. Component mounts, `isOnline = true` (SSR default)
2. `useSession` returns `status: 'unauthenticated'` (network unreachable)
3. Guard checks `isOnline` -- it's `true` (wrong!) -- redirect fires
4. `useEffect` runs, sets `isOnline = false` -- too late

The synchronous `navigator.onLine` check eliminates this race. On the server (`typeof navigator === 'undefined'`), we skip the check entirely (SSR does not redirect). On the client, `navigator.onLine` is always available synchronously, providing the correct value even before the hook's `useEffect` fires.

#### For pages that need `useNetworkStatus` added (Category B, C, and the vehicles page in Category A)

Pages that do NOT already have an offline hook must import `useNetworkStatus` directly (lighter than importing the full `OfflineContext`). The vehicles page (Category A) additionally imports `getCachedVehicles` from `@/lib/offlineDb` for cached data access:

```typescript
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

// In the component:
const { isOnline } = useNetworkStatus()
```

### Files to Modify

| File | Change |
|------|--------|
| `src/app/dashboard/page.tsx` (line 117) | Guard redirect with `&& isOnline && navigator.onLine` + offline fallback to cached data |
| `src/app/profile/page.tsx` (lines 41, 133) | Guard redirect and render check + show offline profile notice |
| `src/app/fillups/new/page.tsx` (line 67) | Guard redirect + offline form with cached vehicles |
| `src/app/vehicles/[id]/page.tsx` (line 230) | Guard redirect + show cached vehicle detail |
| `src/app/vehicles/[id]/fillups/page.tsx` (line 91) | Guard redirect + show cached fillups |
| `src/app/import/page.tsx` (line 55) | Add `useNetworkStatus` import, guard redirect, show offline notice |
| `src/app/vehicles/page.tsx` (line 32) | Add `useNetworkStatus` + `getCachedVehicles` imports, guard redirect, load and display cached vehicles when offline with "cached data" banner, fall back to `OfflineNotice` if no cache |
| `src/app/vehicles/new/page.tsx` (line 45) | Add `useNetworkStatus` import, guard redirect, show offline notice |
| `src/app/vehicles/[id]/edit/page.tsx` (line 52) | Add `useNetworkStatus` import, guard redirect, show offline notice |
| `src/app/fillups/[id]/edit/page.tsx` (line 68) | Add `useNetworkStatus` import, guard redirect, show offline notice |
| `src/app/groups/page.tsx` (line 26) | Add `useNetworkStatus` import, guard redirect, show offline notice |
| `src/app/groups/join/page.tsx` (line 15) | Add `useNetworkStatus` import, guard redirect, show offline notice |
| `src/app/groups/new/page.tsx` (line 24) | Add `useNetworkStatus` import, guard redirect, show offline notice |

### Implementation Steps

**Step 1: Create Shared Offline Notice Component**

To avoid duplicating the offline notice UI across 8+ pages (Categories B, C, and D), create a small shared component:

Create `src/components/OfflineNotice.tsx`:

```typescript
'use client'

interface OfflineNoticeProps {
  message: string
}

export function OfflineNotice({ message }: OfflineNoticeProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">You are offline</p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">{message}</p>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Fix Category A Pages (cached data support)**

**2a. Dashboard (`src/app/dashboard/page.tsx`, line 117)**

Already has `isOnline` from `useOffline()` at line 56. Modify the `useEffect`:

```
// BEFORE (line 117-119):
if (status === 'unauthenticated') {
  router.push('/login')
  return
}

// AFTER:
if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
  router.push('/login')
  return
}
if (status === 'unauthenticated' && !isOnline) {
  loadCachedData()
  return
}
```

**2b. Vehicle Detail (`src/app/vehicles/[id]/page.tsx`, line 230)**

Already has `isOnline` from `useOffline()` at line 80. Apply the same guard pattern:

```
// BEFORE (line 230-232):
if (status === 'unauthenticated') {
  router.push('/login')
  return
}

// AFTER:
if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
  router.push('/login')
  return
}
```

When offline and unauthenticated, the page already has cached vehicle data loading logic that will execute.

**2c. Vehicle Fillups (`src/app/vehicles/[id]/fillups/page.tsx`, line 91)**

Already has `isOnline` from `useOffline()` at line 57. Apply guard:

```
// BEFORE (line 91-93):
if (status === 'unauthenticated') {
  router.push('/login')
  return
}

// AFTER:
if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
  router.push('/login')
  return
}
```

When offline, the page will show cached fillups and pending queue items.

**2d. New Fillup Form (`src/app/fillups/new/page.tsx`, line 67)**

Already has `isOnline` from `useOfflineQueue()` at line 58. Apply guard:

```
// BEFORE (line 67-69):
if (status === 'unauthenticated') {
  router.push('/login')
  return
}

// AFTER:
if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
  router.push('/login')
  return
}
```

When offline, the form loads cached vehicles and queues fillups offline (existing behavior).

**2e. Vehicles List (`src/app/vehicles/page.tsx`, line 32)**

This page does NOT currently import any offline hooks. It fetches from `/api/vehicles` and displays vehicle cards. The caching infrastructure already exists: the dashboard calls `cacheVehicles()` when online, populating IndexedDB with `CachedVehicle` objects. This page needs to READ from that cache when offline.

**Interface compatibility note:** The `CachedVehicle` interface (from `src/lib/offlineDb.ts`) and the page's `Vehicle` interface (from `src/app/vehicles/page.tsx`) are structurally identical -- both use flat fields `groupId: string` and `groupName: string`. No mapping or transformation is needed. Cached vehicles can be assigned directly to the `Vehicle[]` state.

**Known limitation -- cached data quality:** The dashboard's `cacheVehicles()` call (in `src/app/dashboard/page.tsx` lines 88-102) maps from `VehicleSummary` to `CachedVehicle` with some placeholder values: `tankSize: null`, `fuelType: 'regular'`, `groupId: ''`, `groupName: ''`, `createdAt: ''`, `updatedAt: ''`. This means cached vehicles displayed on the vehicles list page will show empty group names and hardcoded fuel types. This is acceptable because: (a) the "Showing cached data" banner already signals to users that data may be incomplete or stale, and (b) the primary purpose of showing cached vehicles offline is to allow navigation to cached vehicle detail pages, not to display perfect metadata.

Add imports:
```typescript
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { getCachedVehicles } from '@/lib/offlineDb'
import { OfflineNotice } from '@/components/OfflineNotice'
```

Add hook call inside the component:
```typescript
const { isOnline } = useNetworkStatus()
```

Add state for tracking cached data display:
```typescript
const [isShowingCached, setIsShowingCached] = useState(false)
```

Guard the auth redirect (line 32):
```
// BEFORE:
if (status === 'unauthenticated') {
  router.push('/login')
}

// AFTER:
if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
  router.push('/login')
}
```

When offline and unauthenticated, attempt to load cached vehicles from IndexedDB. Add this logic in the `useEffect` that handles session status. **CRITICAL: `setIsLoading(false)` must be called in both the success and catch paths.** The page has a loading gate at line 57 (`if (status === 'loading' || isLoading)`) that renders a spinner. The `isLoading` state starts as `true` (line 28) and is only set to `false` inside `fetchVehicles()` (line 53). When offline, `fetchVehicles()` never runs, so without explicitly setting `isLoading = false` here, the page would be stuck on the loading spinner forever.

```typescript
if (status === 'unauthenticated' && !isOnline) {
  // Attempt to load cached vehicles
  getCachedVehicles().then(cached => {
    if (cached && cached.length > 0) {
      // CachedVehicle and Vehicle have identical flat structures -- no mapping needed
      setVehicles(cached)
      setIsShowingCached(true)
    }
    setIsLoading(false)  // CRITICAL: release the loading gate
  }).catch(() => {
    // No cached data available -- OfflineNotice will render
    setIsLoading(false)  // CRITICAL: release the loading gate even on failure
  })
  return
}
```

**State machine for the vehicles page render flow:**

```
1. Initial state: isLoading=true, status='loading'
   -> Render: Loading spinner (line 57 gate catches both conditions)

2a. ONLINE path: status='authenticated' -> fetchVehicles() runs
   -> fetchVehicles() sets isLoading=false in finally block (line 52-54)
   -> Render: Vehicle list (or empty state)

2b. ONLINE + unauthenticated: status='unauthenticated' && isOnline
   -> Guard fires router.push('/login')
   -> Render: Nothing (redirect in progress)

2c. OFFLINE path: status='unauthenticated' && !isOnline
   -> getCachedVehicles() resolves:
      - Has data: setVehicles(cached), setIsShowingCached(true), setIsLoading(false)
        -> Render: Vehicle list with "Showing cached data" banner
      - No data: setIsLoading(false)
        -> Render: OfflineNotice fallback (checked AFTER loading gate resolves)
   -> getCachedVehicles() rejects:
      - setIsLoading(false)
        -> Render: OfflineNotice fallback
```

Add a "Showing cached data" banner above the vehicle list when `isShowingCached` is true. Place this inside the main return JSX, just before the `{error && ...}` block (before line 81):
```tsx
{isShowingCached && (
  <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Showing cached data</p>
    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
      You are viewing previously loaded vehicles. Some data may be out of date.
    </p>
  </div>
)}
```

If offline and no cached data is available (empty cache or cache read fails), show the `OfflineNotice`. Place this check AFTER the loading gate (after line 63), so it only evaluates once `isLoading` has been set to `false`:
```tsx
// This goes AFTER the loading spinner gate (line 57-63) and BEFORE the main return
if (!isOnline && !isShowingCached && vehicles.length === 0) {
  return <OfflineNotice message="Vehicles list is not available offline. Visit the dashboard while online to cache your vehicles." />
}
```

Note: The `status === 'unauthenticated'` check is not needed here because this code only runs after the loading gate has resolved and the `useEffect` has already handled the online-unauthenticated redirect case.

**Step 3: Fix Category D Page (Profile)**

**3a. Profile (`src/app/profile/page.tsx`, lines 41, 133)**

Already has `isOnline` from `useOffline()` at line 15. Fix both the useEffect guard AND the render guard:

```
// BEFORE (line 41-43):
if (status === 'unauthenticated') {
  router.push('/login')
}

// AFTER:
if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
  router.push('/login')
}
```

Render guard at line 133-135:

```
// BEFORE:
if (status === 'unauthenticated') {
  return null
}

// AFTER:
if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
  return null
}
if (status === 'unauthenticated' && !isOnline) {
  return <OfflineNotice message="Profile settings are not available while offline." />
}
```

Import `OfflineNotice` from `@/components/OfflineNotice`.

**Step 4: Fix Category B Pages (require server connectivity)**

For each of these 6 pages, the changes follow the same pattern:

1. Add import: `import { useNetworkStatus } from '@/hooks/useNetworkStatus'`
2. Add hook call: `const { isOnline } = useNetworkStatus()`
3. Guard the redirect with `&& isOnline && (typeof navigator === 'undefined' || navigator.onLine)`
4. Add offline fallback: `if (!isOnline) return <OfflineNotice message="..." />`
5. Add import: `import { OfflineNotice } from '@/components/OfflineNotice'`

**4a. Import Page (`src/app/import/page.tsx`, line 55)**

This is inside `ImportForm()` component (line 30). Add `useNetworkStatus` hook call after line 32. The redirect is inside a `useEffect` at line 54:

```
// BEFORE (line 55-57):
if (status === 'unauthenticated') {
  router.push('/login')
  return
}

// AFTER:
if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
  router.push('/login')
  return
}
```

Add an early return before the main render:
```
if (!isOnline) {
  return <OfflineNotice message="Import requires an internet connection." />
}
```

**4b. New Vehicle (`src/app/vehicles/new/page.tsx`, line 45)**

Add `useNetworkStatus` hook. Guard the redirect. Add offline fallback before render:

```
if (!isOnline) {
  return <OfflineNotice message="Creating a vehicle requires an internet connection." />
}
```

**4c. Edit Vehicle (`src/app/vehicles/[id]/edit/page.tsx`, line 52)**

Add `useNetworkStatus` hook. Guard the redirect. Add offline fallback:

```
if (!isOnline) {
  return <OfflineNotice message="Editing a vehicle requires an internet connection." />
}
```

**4d. Edit Fillup (`src/app/fillups/[id]/edit/page.tsx`, line 68)**

Add `useNetworkStatus` hook. Guard the redirect. Add offline fallback:

```
if (!isOnline) {
  return <OfflineNotice message="Editing a fillup requires an internet connection." />
}
```

**4e. Join Group (`src/app/groups/join/page.tsx`, line 15)**

NOTE: This page uses an INLINE guard (not inside `useEffect`). The pattern is:

```
// BEFORE (line 15-18):
if (status === 'unauthenticated') {
  router.push('/login')
  return null
}

// AFTER:
if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
  router.push('/login')
  return null
}
if (!isOnline) {
  return <OfflineNotice message="Joining a group requires an internet connection." />
}
```

**4f. New Group (`src/app/groups/new/page.tsx`, line 24)**

Same inline guard pattern as Join Group:

```
// BEFORE (line 24-27):
if (status === 'unauthenticated') {
  router.push('/login')
  return null
}

// AFTER:
if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
  router.push('/login')
  return null
}
if (!isOnline) {
  return <OfflineNotice message="Creating a group requires an internet connection." />
}
```

**Step 5: Fix Category C Page (list page without caching)**

**5a. Groups List (`src/app/groups/page.tsx`, line 26)**

Add `useNetworkStatus` hook. Guard the redirect. Add offline fallback:

```
if (!isOnline) {
  return <OfflineNotice message="Groups list requires an internet connection." />
}
```

**Step 6: Verify no other pages have the pattern**

Search the entire codebase for `unauthenticated` references in `.tsx` files. The 13 pages listed above is the complete set as verified by grep. The landing page (`src/app/page.tsx` line 27) uses `unauthenticated` to show a landing page (not to redirect), so it requires no change.

### Acceptance Criteria

- [ ] When offline, visiting `/dashboard` shows cached vehicle data instead of redirecting to `/login`
- [ ] When offline, visiting `/profile` shows an offline notice instead of redirecting to `/login`
- [ ] When offline, visiting `/fillups/new` allows the fillup form to load (with cached vehicles) instead of redirecting to `/login`
- [ ] When offline, visiting `/vehicles/[id]` shows cached vehicle detail instead of redirecting
- [ ] When offline, visiting `/vehicles/[id]/fillups` shows cached fillups instead of redirecting
- [ ] When offline, visiting `/vehicles` shows cached vehicles with a "Showing cached data" banner instead of redirecting (if cache populated from prior dashboard visit)
- [ ] When offline, visiting `/vehicles` with no cached data shows `OfflineNotice` with helpful message instead of redirecting
- [ ] When offline, visiting `/vehicles/new` shows an offline notice instead of redirecting
- [ ] When offline, visiting `/vehicles/[id]/edit` shows an offline notice instead of redirecting
- [ ] When offline, visiting `/fillups/[id]/edit` shows an offline notice instead of redirecting
- [ ] When offline, visiting `/import` shows an offline notice instead of redirecting
- [ ] When offline, visiting `/groups` shows an offline notice instead of redirecting
- [ ] When offline, visiting `/groups/new` shows an offline notice instead of redirecting
- [ ] When offline, visiting `/groups/join` shows an offline notice instead of redirecting
- [ ] When online and truly unauthenticated, ALL 13 pages still redirect to `/login` correctly
- [ ] No hydration race condition: a page that loads offline does NOT briefly redirect before `useEffect` corrects `isOnline`
- [ ] `OfflineNotice` component renders consistently across all pages
- [ ] No TypeScript errors introduced
- [ ] Build passes (`npm run build`)

### Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **RESOLVED (v2):** `useNetworkStatus` initializes `isOnline = true` for SSR, causing redirect before `useEffect` corrects it | N/A | N/A | Added synchronous `navigator.onLine` fallback check in the guard pattern: `&& (typeof navigator === 'undefined' \|\| navigator.onLine)`. This prevents the redirect from firing during the SSR-to-client hydration gap. |
| User sees stale/empty data when offline | Medium | Low | Dashboard already shows "Showing cached data" banner; other pages show explicit offline notice |
| Adding `useNetworkStatus` to 8 new pages increases bundle slightly | Low | Low | `useNetworkStatus` is a tiny hook (~50 lines); tree-shaking prevents bloat |
| Edge case: browser reports `navigator.onLine = true` but network is actually down (known browser bug) | Low | Low | This is the same as the pre-existing behavior -- the session check will timeout and user will see a loading state. The guard prevents the REDIRECT, which is the real problem. |

### Verification Steps

1. Start dev server, log in, visit dashboard and several pages to populate cache
2. Open DevTools > Network > toggle "Offline"
3. Navigate to `/dashboard` -- should show cached data with yellow "cached data" banner, NOT redirect to login
4. Navigate to `/profile` -- should show offline notice, NOT redirect to login
5. Navigate to `/fillups/new` -- should show the form (possibly with cached vehicles), NOT redirect to login
6. Navigate to `/vehicles/[id]` -- should show cached vehicle detail, NOT redirect
7. Navigate to `/vehicles/[id]/fillups` -- should show cached fillups, NOT redirect
8. Navigate to `/vehicles` -- should show cached vehicles with "Showing cached data" banner, NOT redirect
8a. Clear IndexedDB (`Application > Storage > IndexedDB > fuel-tracker-db`), then navigate to `/vehicles` offline -- should show `OfflineNotice` with message about visiting dashboard to cache vehicles
9. Navigate to `/vehicles/new` -- should show offline notice, NOT redirect
10. Navigate to `/import` -- should show offline notice, NOT redirect
11. Navigate to `/groups` -- should show offline notice, NOT redirect
12. Navigate to `/groups/new` -- should show offline notice, NOT redirect
13. Navigate to `/groups/join` -- should show offline notice, NOT redirect
14. Toggle network back online -- should resume normal behavior
15. Log out, verify online unauthenticated redirect still works on all 13 pages
16. **Hydration race test:** With DevTools open, set network to Offline, then hard-refresh `/dashboard`. Verify that the page does NOT briefly flash/redirect to `/login` before showing cached data.

---

## Sub-Plan 15-02: Analytics Page with Charts

**DEPENDENCY: Sub-plan 15-01 must be completed first.** This page uses the offline auth guard pattern established in 15-01. The pattern is included inline below so this sub-plan is self-contained for the executor.

### Problem Statement

Users have no way to visualize their fuel data trends over time. The existing stats endpoint (`/api/vehicles/[id]/stats`) provides only per-vehicle summary aggregates, not time-series data.

### Architecture

**New files to create:**
| File | Purpose |
|------|---------|
| `src/app/analytics/page.tsx` | Analytics page with charts |
| `src/app/api/analytics/route.ts` | Time-series analytics API endpoint |

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/BottomNav.tsx` | Add Analytics nav item (replace Theme toggle position or add as 5th item) |
| `package.json` | Add `recharts` dependency |

### Implementation Steps

**Step 1: Install Recharts**

```bash
npm install recharts
```

Recharts is the standard React charting library. It is lightweight, composable, and works with React 19. It renders SVG charts that inherently support dark/light theming via CSS.

**Step 2: Create Analytics API Endpoint**

Create `src/app/api/analytics/route.ts`:

This endpoint returns time-series data for the authenticated user's vehicles. It accepts query parameters:
- `vehicleId` (optional) -- filter to specific vehicle, otherwise aggregate all
- `period` (optional, default `12m`) -- `3m`, `6m`, `12m`, `all`

Response shape:
```typescript
interface AnalyticsResponse {
  priceHistory: Array<{
    date: string       // ISO date (day granularity)
    pricePerGallon: number
    vehicleId: string
    vehicleName: string
  }>
  mpgHistory: Array<{
    date: string
    mpg: number
    vehicleId: string
    vehicleName: string
  }>
  monthlySpending: Array<{
    month: string      // "2026-01", "2026-02", etc.
    totalCost: number
    gallons: number
    fillupCount: number
  }>
  costPerMile: Array<{
    date: string
    costPerMile: number
    vehicleId: string
    vehicleName: string
  }>
  vehicles: Array<{
    id: string
    name: string
    color: string      // assigned chart color
  }>
}
```

Implementation approach:
1. Auth check (same pattern as other API routes)
2. Get user's group memberships -> vehicle IDs (same pattern as `src/app/api/fillups/route.ts` lines 64-86)
3. Query fillups within the time period, ordered by date ASC
4. Group/aggregate data into the response arrays
5. Assign a consistent color per vehicle (from a predefined palette)

For `costPerMile`, calculate running cost-per-mile between consecutive fillups for each vehicle (requires odometer delta).

For `monthlySpending`, group fillups by `YYYY-MM` and sum `totalCost` and `gallons`.

**Step 3: Create Analytics Page**

Create `src/app/analytics/page.tsx`:

Page structure:
1. Header with title "Analytics" and vehicle filter dropdown
2. Period selector (3M / 6M / 12M / All) as pill buttons
3. Chart cards, each in a white/dark card with title:
   - **Price per Gallon** -- `LineChart` with `ResponsiveContainer`, one line per vehicle. X-axis = date, Y-axis = price. Tooltip shows date + price + vehicle name.
   - **MPG Over Time** -- `LineChart`, one line per vehicle. Only fillups with `mpg !== null`.
   - **Monthly Spending** -- `BarChart` with stacked bars if multiple vehicles, or simple bars. X-axis = month labels, Y-axis = dollar amount.
   - **Cost per Mile** -- `LineChart`, one line per vehicle.
4. Empty state: "Log some fillups to see your analytics!"

**Auth guard (inline pattern from 15-01):** The analytics page must include the offline-safe auth guard. Since chart data is not cached in IndexedDB, show an offline notice. The page must:

1. Import `useNetworkStatus` from `@/hooks/useNetworkStatus`
2. Import `OfflineNotice` from `@/components/OfflineNotice` (created in 15-01)
3. Add the guard in the `useEffect`:
```typescript
const { isOnline } = useNetworkStatus()

useEffect(() => {
  if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
    router.push('/login')
    return
  }
  if (status === 'authenticated') {
    fetchAnalytics()
  }
}, [status, isOnline])
```

4. Add offline fallback before the main render:
```typescript
if (!isOnline) {
  return <OfflineNotice message="Analytics requires an internet connection to load chart data." />
}
```

Dark/light theme support:
- Recharts allows customizing axis colors, grid colors, tooltip styles
- Read current theme from `useTheme()` context (`src/contexts/ThemeContext.tsx`)
- Set axis stroke colors: light mode = `#6b7280`, dark mode = `#9ca3af`
- Set grid stroke: light mode = `#e5e7eb`, dark mode = `#374151`
- Tooltip: use Tailwind-compatible background/text colors

Chart colors per vehicle (predefined palette):
```typescript
const VEHICLE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
]
```

Responsive design:
- Charts use `<ResponsiveContainer width="100%" height={250}>` for mobile-friendly sizing
- On smaller screens, legend moves below the chart
- Touch-friendly tooltips via Recharts' built-in touch support

**Step 4: Add Analytics to Bottom Navigation**

In `src/components/BottomNav.tsx`, add an Analytics nav item. The current nav has 4 items + Theme toggle (5 total). Options:

**Recommended approach:** Replace the Theme toggle button in BottomNav with the Analytics link. The theme toggle is already available on the Profile page (lines 283-325 of `src/app/profile/page.tsx`), making the bottom nav toggle redundant.

Add to the `navItems` array (after Vehicles, before Add):

```typescript
{
  href: '/analytics',
  label: 'Stats',
  icon: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  activeIcon: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V4.125c0-1.036.84-1.875 1.875-1.875h.75zm-4.5 4.5c-1.035 0-1.875.84-1.875 1.875v11.25c0 1.035.84 1.875 1.875 1.875h-.75A1.875 1.875 0 0112 19.875V8.625c0-1.036.84-1.875 1.875-1.875h.75zM6.375 10.875c-1.036 0-1.875.84-1.875 1.875v6.75c0 1.035.84 1.875 1.875 1.875h-.75A1.875 1.875 0 014.5 19.5v-6.75c0-1.036.84-1.875 1.875-1.875h.75z" />
    </svg>
  ),
}
```

Nav order becomes: Home | Vehicles | Add | Stats | Profile

Remove the Theme toggle button entirely from BottomNav (lines 139-161). Users can change theme from the Profile page.

**Step 5: Service Worker Caching**

Add analytics API caching to `src/app/sw.ts`:

```typescript
// API GET - Analytics (NetworkFirst, acceptable to show slightly stale data)
{
  matcher: ({ request, url }: { request: Request; url: URL }) => {
    return request.method === "GET" && url.pathname === "/api/analytics";
  },
  handler: new NetworkFirst({
    cacheName: "api-analytics",
    networkTimeoutSeconds: 5,
  }),
},
```

### Acceptance Criteria

- [ ] `recharts` is installed as a dependency
- [ ] `/api/analytics` returns correct time-series data for the authenticated user
- [ ] `/api/analytics?vehicleId=xxx` filters to a specific vehicle
- [ ] `/api/analytics?period=3m` correctly limits the date range
- [ ] `/analytics` page renders with at least 4 chart types (price, MPG, monthly spending, cost per mile)
- [ ] Charts respond to vehicle filter dropdown
- [ ] Charts respond to period selector (3M/6M/12M/All)
- [ ] Charts render correctly in both light and dark themes
- [ ] Bottom nav shows "Stats" link that navigates to `/analytics`
- [ ] Theme toggle is removed from bottom nav (still available on Profile page)
- [ ] Page shows empty state when user has no fillup data
- [ ] When offline, analytics page shows `OfflineNotice` with "requires internet connection" message (NOT redirect to login)
- [ ] Auth guard uses the safe pattern with `navigator.onLine` fallback (from 15-01)
- [ ] No TypeScript errors, build passes
- [ ] Page is responsive on mobile viewports

### Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Recharts bundle size bloat | Medium | Medium | Recharts is ~130KB gzipped; use dynamic import with `next/dynamic` to code-split the chart components |
| Large dataset performance | Low | Medium | Limit query to reasonable time period (default 12m); use Prisma query optimization with `select` |
| Chart readability on mobile | Medium | Low | Use `ResponsiveContainer`, reduce legend size on mobile, test at 375px width |
| Removing theme toggle from nav frustrates users | Low | Low | Theme is still accessible from Profile page; users adapt quickly |
| Dark mode chart colors unreadable | Medium | Medium | Test all chart colors against both `#1f2937` (dark bg) and `#ffffff` (light bg); use the predefined palette above which has good contrast |

### Verification Steps

1. Run `npm run build` -- verify no errors
2. Navigate to `/analytics` -- should show charts or empty state
3. Log multiple fillups across vehicles
4. Verify price chart shows correct data points
5. Verify MPG chart shows only fillups with MPG values
6. Verify monthly spending aggregates correctly
7. Switch between 3M/6M/12M/All -- data updates
8. Select specific vehicle -- only that vehicle's data shown
9. Toggle dark mode -- charts remain readable
10. Check on mobile viewport (375px) -- charts are responsive
11. Verify bottom nav has 5 items: Home, Vehicles, Add, Stats, Profile
12. **Offline test:** Toggle offline in DevTools, navigate to `/analytics` -- should show OfflineNotice, NOT redirect

---

## Sub-Plan 15-03: Thousandths Pricing

### Problem Statement

In the US, nearly all gas prices include $0.009 per gallon (the "9/10 of a cent" you see on gas station signs). When users enter $2.09, the actual price is $2.099. Currently, users must manually type all 3 decimal places, which is tedious and error-prone.

Additionally, when a user enables thousandths pricing, their existing historical fillups remain at the old "round cent" values (e.g., $2.09 instead of $2.099). The feature must retroactively adjust all historical fillup prices that don't already have thousandths applied, recalculating `totalCost` for each affected fillup.

### Architecture

This feature requires changes at three layers:

1. **Database:** New field on User model
2. **API:** Profile GET/PATCH to expose the setting (including retroactive adjustment of historical fillups on PATCH); Fillup POST to apply it to new fillups
3. **UI:** Profile page setting (with retroactive adjustment feedback); fillup form indicator

### Design Decision: Default Value

**Decision: `defaultThousandths` defaults to `0` (opt-in).**

**Rationale:** Although the user noted "In the US almost all prices have $0.009 added", setting a non-zero default would silently apply thousandths pricing to ALL existing users immediately after migration, including:
- Non-US users who do not have this pricing convention
- Users who already enter 3 decimal places manually
- Users who would be confused by prices being slightly different than entered

Users who want this feature will opt in via the Profile settings page. The UI will include a prominent callout explaining the feature so US users can easily enable it.

### Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `defaultThousandths` field to User model with `@default(0)` |
| `src/app/api/user/profile/route.ts` | Return and accept `defaultThousandths` in GET/PATCH |
| `src/app/api/fillups/route.ts` | Apply thousandths logic using `pricePerGallonRaw` string field |
| `src/app/profile/page.tsx` | Add thousandths setting UI in Preferences section |
| `src/app/fillups/new/page.tsx` | Send `pricePerGallonRaw` string + show effective price hint |

**New files:**
| File | Purpose |
|------|---------|
| `prisma/migrations/[timestamp]_add_default_thousandths/migration.sql` | Prisma migration |

### Implementation Steps

**Step 1: Schema Migration**

Add to `prisma/schema.prisma`, in the User model (after line 22, before `createdAt`):

```prisma
defaultThousandths Float @default(0)
```

Run migration:
```bash
npx prisma migrate dev --name add_default_thousandths
```

This adds a non-nullable column with a default of `0` (feature disabled). All existing users get `0` -- no pricing behavior changes until they opt in.

**Step 2: Update Profile API**

In `src/app/api/user/profile/route.ts`:

**GET handler** (line 15-37): Add `defaultThousandths` to the `select` and response:
```typescript
select: {
  id: true,
  email: true,
  name: true,
  defaultThousandths: true,  // ADD
  createdAt: true
}

// In response:
return NextResponse.json({
  id: user.id,
  email: user.email,
  name: user.name,
  defaultThousandths: user.defaultThousandths,  // ADD
  createdAt: user.createdAt.toISOString()
})
```

**PATCH handler** (line 40-117): Accept `defaultThousandths` as an updatable field. Add validation:

```typescript
// Add to body type:
let body: { name?: string; defaultThousandths?: number }

// Add validation block (after the name validation block, before the final "no valid fields" response):
if (body.defaultThousandths !== undefined) {
  if (typeof body.defaultThousandths !== 'number') {
    return NextResponse.json(
      { error: 'defaultThousandths must be a number' },
      { status: 400 }
    )
  }
  if (body.defaultThousandths < 0 || body.defaultThousandths > 0.009) {
    return NextResponse.json(
      { error: 'defaultThousandths must be between 0 and 0.009' },
      { status: 400 }
    )
  }
  // Round to 3 decimal places to avoid floating point issues
  body.defaultThousandths = Math.round(body.defaultThousandths * 1000) / 1000
}
```

Refactor the PATCH handler to build a dynamic update object instead of only updating `name`:

```typescript
const updateData: { name?: string; defaultThousandths?: number } = {}

if (validatedName) updateData.name = validatedName
if (body.defaultThousandths !== undefined) updateData.defaultThousandths = body.defaultThousandths

if (Object.keys(updateData).length === 0) {
  return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
}

const updatedUser = await prisma.user.update({
  where: { id: session.user.id },
  data: updateData,
  select: { id: true, email: true, name: true, defaultThousandths: true, updatedAt: true }
})
```

**Retroactive Adjustment of Historical Fillups:**

After saving the user's `defaultThousandths` value, retroactively adjust all historical fillups that have "round cent" prices (i.e., no thousandths already applied). This runs only when the new thousandths value is greater than 0.

**Round-cent detection heuristic:** A price is considered "round cent" (needing adjustment) if `Math.round(pricePerGallon * 100) / 100 === pricePerGallon`. Examples:
- `2.09` -> `Math.round(2.09 * 100) / 100 = 2.09` -> matches -> needs adjustment
- `2.099` -> `Math.round(2.099 * 100) / 100 = 2.1` -> does NOT match -> already has thousandths, skip
- `3.00` -> matches -> needs adjustment
- `2.109` -> does NOT match -> already has thousandths, skip

**Transition behavior:**
- `0 -> 0.009`: Add 0.009 to all round-cent fillups. This is the primary use case.
- `0.009 -> 0.009`: No change (value unchanged, PATCH short-circuits or re-runs harmlessly -- all fillups already adjusted would fail the round-cent check).
- `0.009 -> 0`: User is disabling. Do NOT revert historical adjustments. The adjusted prices are now the correct historical record.
- `0.005 -> 0.009`: Only fillups still at round-cent values are adjusted. Fillups previously adjusted from 2.09 to 2.095 fail the round-cent check (2.095 != Math.round(2.095*100)/100 = 2.10), so they are skipped. They stay at 2.095, not 2.099. **This edge case is acceptable and documented.**

Add after the `prisma.user.update` call:

```typescript
// Retroactive adjustment of historical fillups
let adjustedFillups = 0

if (body.defaultThousandths !== undefined && body.defaultThousandths > 0) {
  const newThousandths = body.defaultThousandths

  // Get all fillups by this user
  const fillups = await prisma.fillup.findMany({
    where: { userId: session.user.id },
    select: { id: true, pricePerGallon: true, gallons: true }
  })

  // Filter to round-cent prices (no thousandths already applied)
  const updates = fillups
    .filter(f => Math.round(f.pricePerGallon * 100) / 100 === f.pricePerGallon)
    .map(f => {
      const newPrice = Math.round((f.pricePerGallon + newThousandths) * 1000) / 1000
      const newTotalCost = Math.round(f.gallons * newPrice * 100) / 100
      return prisma.fillup.update({
        where: { id: f.id },
        data: { pricePerGallon: newPrice, totalCost: newTotalCost }
      })
    })

  // Execute all updates in a transaction for atomicity
  if (updates.length > 0) {
    await prisma.$transaction(updates)
    adjustedFillups = updates.length
  }
}

// Return response with adjustment count
return NextResponse.json({
  ...updatedUser,
  adjustedFillups  // number of historical fillups retroactively adjusted
})
```

**Response shape update:** The PATCH `/api/user/profile` response now includes an `adjustedFillups` field (number). When 0, no fillups were adjusted (either thousandths was set to 0, or no round-cent fillups existed). When > 0, indicates how many fillups were retroactively updated.

**Step 3: Update Fillup POST to Apply Thousandths (with `pricePerGallonRaw` string)**

**The decimal place detection problem:** JSON-parsed numbers lose trailing zeros. When the client sends `pricePerGallon: 2.10`, the server receives `2.1` -- it cannot distinguish "2.1" (1 decimal) from "2.10" (2 decimals). Using `body.pricePerGallon.toString()` on the server is unreliable for this reason.

**Solution:** The client sends an additional `pricePerGallonRaw` string field containing the exact user input. The server uses this string for decimal place detection while still validating the numeric `pricePerGallon` field.

In `src/app/api/fillups/route.ts`:

After the existing `pricePerGallon` validation (line 241), add validation for the new optional field:

```typescript
// Validate optional pricePerGallonRaw (string version of price for decimal detection)
if (body.pricePerGallonRaw !== undefined && body.pricePerGallonRaw !== null) {
  if (typeof body.pricePerGallonRaw !== 'string') {
    return NextResponse.json(
      { error: 'pricePerGallonRaw must be a string' },
      { status: 400 }
    )
  }
  // Verify it parses to a valid number close to pricePerGallon
  const rawParsed = parseFloat(body.pricePerGallonRaw)
  if (isNaN(rawParsed) || Math.abs(rawParsed - body.pricePerGallon) > 0.001) {
    return NextResponse.json(
      { error: 'pricePerGallonRaw must match pricePerGallon' },
      { status: 400 }
    )
  }
}
```

Then, before calculating `totalCost` (line 327):

```typescript
// Fetch user's thousandths preference
const user = await prisma.user.findUnique({
  where: { id: session.user.id },
  select: { defaultThousandths: true }
})

// Apply thousandths if user entered price with 2 or fewer decimal places
let effectivePrice = body.pricePerGallon
if (user?.defaultThousandths && user.defaultThousandths > 0) {
  // Use the raw string for decimal place detection (preserves trailing zeros)
  // Fall back to numeric toString() if raw string not provided (backward compat)
  const priceStr = body.pricePerGallonRaw ?? body.pricePerGallon.toString()
  const decimalIndex = priceStr.indexOf('.')
  const decimalPlaces = decimalIndex === -1 ? 0 : priceStr.length - decimalIndex - 1

  if (decimalPlaces <= 2) {
    effectivePrice = body.pricePerGallon + user.defaultThousandths
    // Round to avoid floating point errors (e.g., 2.09 + 0.009 = 2.0989999...)
    effectivePrice = Math.round(effectivePrice * 1000) / 1000
  }
}

// Use effectivePrice for totalCost calculation
const totalCost = Math.round(body.gallons * effectivePrice * 100) / 100
```

Also store the effective price (not the raw input) as `pricePerGallon` in the database:
```typescript
// In the prisma.fillup.create data:
pricePerGallon: effectivePrice,  // was: body.pricePerGallon
```

This way, the stored price always reflects the true price paid, and all downstream calculations (stats, analytics) use the correct value.

**Step 4: Update Fillup Form to Send `pricePerGallonRaw`**

In `src/app/fillups/new/page.tsx`, the submit handler builds `fillupData` around line 163. Add the raw string:

```typescript
const fillupData = {
  date: new Date(date).toISOString(),
  gallons: gallonsNum,
  pricePerGallon: priceNum,
  pricePerGallonRaw: pricePerGallon,  // ADD: raw string from input (e.g., "2.10")
  odometer: odometerNum,
  isFull,
  // ... rest
}
```

The `pricePerGallon` state variable is already a string (line 34: `const [pricePerGallon, setPricePerGallon] = useState('')`), so sending it directly preserves the exact user input including trailing zeros.

Also update the offline queue (`queueFillup` call) to include `pricePerGallonRaw` so that when the queue syncs, the server can detect decimal places correctly.

**Step 5: Update Profile Page UI**

In `src/app/profile/page.tsx`, add a thousandths setting in the Preferences section (after the Theme section, around line 325):

Add state:
```typescript
const [defaultThousandths, setDefaultThousandths] = useState<number>(0)
const [isLoadingProfile, setIsLoadingProfile] = useState(true)
const [thousandthsSaveSuccess, setThousandthsSaveSuccess] = useState(false)
```

Add effect to load the profile setting:
```typescript
useEffect(() => {
  if (status === 'authenticated') {
    fetch('/api/user/profile')
      .then(res => res.json())
      .then(data => {
        if (data.defaultThousandths !== undefined) {
          setDefaultThousandths(data.defaultThousandths)
        }
      })
      .catch(() => {}) // silently fail
      .finally(() => setIsLoadingProfile(false))
  }
}, [status])
```

Add state for tracking retroactive adjustment feedback:
```typescript
const [adjustedFillupsCount, setAdjustedFillupsCount] = useState<number | null>(null)
```

Add save handler (updated to handle retroactive adjustment response):
```typescript
const handleThousandthsSave = async (value: number) => {
  try {
    setAdjustedFillupsCount(null)  // Reset previous adjustment feedback
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultThousandths: value })
    })
    if (res.ok) {
      const data = await res.json()
      setDefaultThousandths(value)
      setThousandthsSaveSuccess(true)
      // Show retroactive adjustment feedback if any fillups were adjusted
      if (data.adjustedFillups > 0) {
        setAdjustedFillupsCount(data.adjustedFillups)
      }
      setTimeout(() => {
        setThousandthsSaveSuccess(false)
        setAdjustedFillupsCount(null)
      }, 5000)  // 5 seconds to give user time to read adjustment feedback
    }
  } catch {}
}
```

UI in Preferences section -- add below the Theme setting:

```tsx
{/* Fuel Pricing */}
<div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
  <p className="text-gray-900 dark:text-white">Fuel Price Adjustment</p>
  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
    US gas prices include 9/10 of a cent (e.g., $2.09 is actually $2.099). Enable this to automatically add the fractional cent when you enter a price with 2 or fewer decimal places. Enabling this will also retroactively adjust all your existing fillup prices that don't already have thousandths applied.
  </p>
  {thousandthsSaveSuccess && (
    <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md">
      <p className="text-xs text-green-700 dark:text-green-300">
        Setting saved.
        {adjustedFillupsCount !== null && adjustedFillupsCount > 0 && (
          <span> {adjustedFillupsCount} historical fillup{adjustedFillupsCount !== 1 ? 's' : ''} adjusted.</span>
        )}
        {adjustedFillupsCount === 0 && defaultThousandths > 0 && (
          <span> No historical fillups needed adjustment.</span>
        )}
      </p>
    </div>
  )}
  <div className="flex items-center gap-3">
    <span className="text-sm text-gray-600 dark:text-gray-300">+$</span>
    <select
      value={defaultThousandths}
      onChange={(e) => handleThousandthsSave(parseFloat(e.target.value))}
      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
    >
      <option value={0}>0.000 (disabled)</option>
      <option value={0.001}>0.001</option>
      <option value={0.002}>0.002</option>
      <option value={0.003}>0.003</option>
      <option value={0.004}>0.004</option>
      <option value={0.005}>0.005</option>
      <option value={0.006}>0.006</option>
      <option value={0.007}>0.007</option>
      <option value={0.008}>0.008</option>
      <option value={0.009}>0.009 (US standard)</option>
    </select>
    <span className="text-sm text-gray-500 dark:text-gray-400">per gallon</span>
  </div>
</div>
```

**Step 6: Update Fillup Form Hint**

In `src/app/fillups/new/page.tsx`, fetch the user's thousandths setting and show an indicator when it will be applied.

Add state and effect:
```typescript
const [defaultThousandths, setDefaultThousandths] = useState<number>(0)

useEffect(() => {
  if (status === 'authenticated') {
    fetch('/api/user/profile')
      .then(res => res.json())
      .then(data => {
        if (data.defaultThousandths !== undefined) {
          setDefaultThousandths(data.defaultThousandths)
        }
      })
      .catch(() => {})
  }
}, [status])
```

Below the price input (after the `</div>` that closes the price per gallon input group, around line 440), add:

```tsx
{/* Thousandths adjustment hint */}
{defaultThousandths > 0 && pricePerGallon && (() => {
  const decimalPlaces = pricePerGallon.includes('.')
    ? pricePerGallon.split('.')[1]?.length || 0
    : 0
  if (decimalPlaces <= 2) {
    const adjusted = (parseFloat(pricePerGallon) + defaultThousandths).toFixed(3)
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Effective price: ${adjusted}/gal (includes +${defaultThousandths.toFixed(3)})
      </p>
    )
  }
  return null
})()}
```

Also update the `totalCost` calculation display to use the effective price:
```typescript
const effectivePrice = (() => {
  if (!pricePerGallon) return null
  const ppg = parseFloat(pricePerGallon)
  if (isNaN(ppg)) return null
  const decimalPlaces = pricePerGallon.includes('.')
    ? pricePerGallon.split('.')[1]?.length || 0
    : 0
  if (defaultThousandths > 0 && decimalPlaces <= 2) {
    return Math.round((ppg + defaultThousandths) * 1000) / 1000
  }
  return ppg
})()

const totalCost = gallons && effectivePrice
  ? (parseFloat(gallons) * effectivePrice).toFixed(2)
  : null
```

### Acceptance Criteria

- [ ] Prisma migration runs successfully, adding `defaultThousandths` to User table with default `0`
- [ ] All existing users get `defaultThousandths = 0` (feature disabled by default -- opt-in)
- [ ] `GET /api/user/profile` returns `defaultThousandths` field
- [ ] `PATCH /api/user/profile` accepts and validates `defaultThousandths` (0 to 0.009 range)
- [ ] `PATCH /api/user/profile` response includes `adjustedFillups` count
- [ ] Profile page shows thousandths setting in Preferences section, defaulting to "0.000 (disabled)"
- [ ] Changing the setting saves immediately and shows success feedback
- [ ] Fillup form sends `pricePerGallonRaw` string alongside the numeric `pricePerGallon`
- [ ] When user has thousandths enabled and enters "2.10" (2 decimal places), API correctly detects 2 decimals from `pricePerGallonRaw` and adds thousandths (stores as 2.109)
- [ ] When user enters "2.099" (3 decimal places), API uses as-is (no double-add)
- [ ] When thousandths is set to 0 (disabled), no adjustment occurs regardless of decimal places
- [ ] Fillup form shows effective price hint below price input when thousandths will be applied
- [ ] Total cost display on fillup form reflects the effective price
- [ ] **Retroactive adjustment:** When user sets `defaultThousandths` > 0, all historical fillups with round-cent prices are adjusted (price + thousandths, totalCost recalculated)
- [ ] **Retroactive adjustment:** Fillups that already have thousandths (non-round-cent prices) are NOT double-adjusted
- [ ] **Retroactive adjustment:** Setting thousandths to 0 (disabling) does NOT revert previously adjusted fillups
- [ ] **Retroactive adjustment:** Profile UI shows the count of adjusted fillups after saving (e.g., "47 historical fillups adjusted")
- [ ] **Retroactive adjustment:** All updates within a single retroactive batch execute in a Prisma `$transaction`
- [ ] Offline queued fillups include `pricePerGallonRaw` and are processed correctly at sync time
- [ ] No TypeScript errors, build passes

### Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Floating point precision errors (e.g., 2.09 + 0.009 = 2.0989999...) | High | High | Always round to 3 decimal places using `Math.round(x * 1000) / 1000` at both API and client |
| **RESOLVED (v2):** Decimal place detection fails for "2.10" vs "2.1" via JSON number | N/A | N/A | Added `pricePerGallonRaw` string field sent from client to server. The raw input string preserves trailing zeros. Server uses this string for decimal counting. Falls back to numeric `toString()` for backward compatibility with old clients/offline queue items. |
| **RESOLVED (v2):** Default of 0.009 auto-applies to all users | N/A | N/A | Changed default to `0` (opt-in). Users must explicitly enable thousandths in Profile settings. |
| User confusion about when thousandths applies | Medium | Medium | Show clear hint on fillup form; explain in profile setting description |
| Migration fails on production with existing data | Low | Low | Field has `@default(0)` so all existing rows get the default; no NOT NULL constraint issue |
| Offline fillup queue stores raw price, not effective price | Medium | High | The offline queue sends to the same POST endpoint when syncing, and now includes `pricePerGallonRaw`. Thousandths will be applied at sync time -- this is correct behavior since the stored preference is server-side |
| Old offline queue items (queued before this update) lack `pricePerGallonRaw` | Low | Low | API falls back to `body.pricePerGallon.toString()` when `pricePerGallonRaw` is not present. This loses trailing zeros but is acceptable for edge cases during the transition. |
| **Retroactive adjustment on large datasets:** User with thousands of fillups could create a slow PATCH request | Low | Medium | The transaction executes individual updates (not bulk SQL), so Prisma handles them sequentially within the transaction. For typical users (< 500 fillups), this should complete in under 2 seconds. If a timeout occurs, the transaction rolls back atomically -- no partial state. |
| **Retroactive adjustment is irreversible:** Once fillups are adjusted from 2.09 to 2.099, setting thousandths back to 0 does NOT revert them | Medium | Low | This is by design -- the adjusted price (2.099) IS the correct historical price. Document this in the UI description. The original price is not stored separately; users who made a mistake can manually edit individual fillups. |
| **Floating point precision in round-cent detection:** Edge case where a stored float like `2.09` might not compare exactly with `Math.round(2.09 * 100) / 100` due to IEEE 754 representation | Low | Medium | In practice, JavaScript's `Math.round(2.09 * 100) / 100` produces exactly `2.09` for all common cent values. The heuristic works reliably for prices in the $0.00-$99.99 range. If a false negative occurs (a round-cent price is skipped), the consequence is minor -- that one fillup keeps its original price. |
| **Changing thousandths value (e.g., 0.005 to 0.009):** Previously adjusted fillups (e.g., 2.095) are NOT re-adjusted to 2.099 | Low | Low | Acceptable limitation. Fillups adjusted to 2.095 fail the round-cent check and are skipped. Documented in the plan. Users who change their thousandths value should understand only un-adjusted fillups will be updated. |

### Verification Steps

1. Run `npx prisma migrate dev` -- migration succeeds
2. Check database: existing users have `defaultThousandths = 0`
3. Visit Profile page -- see "Fuel Price Adjustment" setting showing "0.000 (disabled)"
4. **Retroactive adjustment test setup:** Before enabling thousandths, create several fillups with round-cent prices (e.g., $2.09, $3.15, $2.50) and note their IDs and prices in the database
5. Change setting to 0.009 -- saves with success message AND shows "N historical fillups adjusted"
6. **Retroactive adjustment verification:** Check the database -- the fillups from step 4 should now have prices $2.099, $3.159, $2.509, and their `totalCost` values should be recalculated
7. **Already-adjusted fillups not double-adjusted:** Set thousandths to 0.009 again (same value) -- should show "No historical fillups needed adjustment" (all fillups already have thousandths)
8. **Disabling does NOT revert:** Set thousandths to 0.000 -- previously adjusted fillups should remain at 2.099, 3.159, etc. (NOT reverted to 2.09, 3.15)
9. Go to fillup form, enter price "2.09" -- see hint "Effective price: $2.099/gal" (only if thousandths re-enabled)
10. Submit fillup -- check database: `pricePerGallon` is 2.099, `totalCost` calculated from 2.099
11. **Critical test:** Enter price "2.10" -- see hint "Effective price: $2.109/gal" (NOT $2.109 incorrectly detected as 1 decimal)
12. Verify the API received `pricePerGallonRaw: "2.10"` in the request body (check Network tab)
13. Enter price "2.099" (3 decimal places) -- no hint shown, stored as 2.099
14. Change profile setting to 0.000 -- enter "2.09" -- no hint, stored as 2.09
15. **PATCH response shape test:** Check the API response in Network tab -- should include `adjustedFillups` field as a number
16. **Edge case -- change thousandths value:** Create a fillup at $2.09, set thousandths to 0.005 (fillup becomes $2.095), then change to 0.009. The $2.095 fillup should NOT be re-adjusted (it's no longer round-cent). Only new round-cent fillups would be adjusted.
17. **Offline test:** Queue a fillup while offline, go back online, verify sync sends `pricePerGallonRaw` and thousandths is applied correctly

---

## Sub-Plan 15-04: Fillup History KPI Fix

### Problem Statement

The fillup history page (`src/app/vehicles/[id]/fillups/page.tsx`) displays three KPI cards at the top: Fillups count, Total Gallons, and Average MPG. These values are currently calculated client-side from the `fillups` state array (lines 397-403):

```typescript
const totalFillups = fillups.length
const totalGallons = fillups.reduce((sum, f) => sum + f.gallons, 0)
const fillupsWithMpg = fillups.filter(f => f.mpg !== null)
const averageMpg = fillupsWithMpg.length > 0
  ? fillupsWithMpg.reduce((sum, f) => sum + (f.mpg || 0), 0) / fillupsWithMpg.length
  : null
```

Because the page uses infinite scroll with 20-item cursor-based pagination, the `fillups` array only contains the fillups loaded so far. A vehicle with 200 fillups will show "20 Fillups" and incorrect totals until the user scrolls to load all pages. This is misleading and incorrect.

### Root Cause

The KPI calculation operates on paginated client-side data (`fillups` state array) instead of querying the server for the complete totals. The existing `/api/vehicles/[id]/stats` endpoint (`src/app/api/vehicles/[id]/stats/route.ts`) already computes accurate totals from ALL fillups for a vehicle, but the fillup history page does not use it.

### Solution

1. Fetch KPI data from `/api/vehicles/[id]/stats` endpoint on page load
2. Replace client-side KPI calculations with server-provided values
3. Add `startDate` and `endDate` query parameters to the stats endpoint so KPIs reflect active date filters
4. Expand the KPI cards to include additional useful metrics from the stats response (total cost, cost per mile)
5. Re-fetch stats when date filters change

### Architecture

**Files to modify:**

| File | Change |
|------|--------|
| `src/app/api/vehicles/[id]/stats/route.ts` | Add optional `startDate` and `endDate` query parameters to filter the fillup set before computing stats |
| `src/app/vehicles/[id]/fillups/page.tsx` | Fetch stats from API, replace client-side KPI calculations, expand KPI cards, re-fetch on filter change |

**No new files required.** This sub-plan leverages the existing stats endpoint and existing page.

### Implementation Steps

**Step 1: Add Date Filter Support to Stats Endpoint**

In `src/app/api/vehicles/[id]/stats/route.ts`, add support for optional `startDate` and `endDate` query parameters.

After the auth/membership checks (line 74), parse query parameters from the request URL:

```typescript
// Parse optional date range filters
const url = new URL(request.url)
const startDateParam = url.searchParams.get('startDate')
const endDateParam = url.searchParams.get('endDate')

// Build date filter for Prisma query
const dateFilter: { gte?: Date; lte?: Date } = {}
if (startDateParam) {
  const startDate = new Date(startDateParam)
  if (!isNaN(startDate.getTime())) {
    dateFilter.gte = startDate
  }
}
if (endDateParam) {
  const endDate = new Date(endDateParam)
  if (!isNaN(endDate.getTime())) {
    // Set to end of day to include the entire end date
    endDate.setHours(23, 59, 59, 999)
    dateFilter.lte = endDate
  }
}
```

Modify the fillup query (line 77-80) to include the date filter:

```typescript
// BEFORE:
const fillups = await prisma.fillup.findMany({
  where: { vehicleId: id },
  orderBy: { date: 'asc' }
})

// AFTER:
const fillups = await prisma.fillup.findMany({
  where: {
    vehicleId: id,
    ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
  },
  orderBy: { date: 'asc' }
})
```

**Important:** The `totalMiles` calculation (line 121-124) uses the difference between first and last odometer readings. When date-filtered, this still correctly shows the miles driven within the filtered range (first fillup in range to last fillup in range). This is the expected behavior.

**Backward compatibility:** Existing callers (e.g., `src/app/vehicles/[id]/page.tsx` line 217) do NOT pass date parameters, so they continue to get unfiltered stats. No changes needed to existing callers.

**Step 2: Add Stats State and Fetch to Fillups Page**

In `src/app/vehicles/[id]/fillups/page.tsx`, add an interface and state for the stats response.

Add the interface after the existing `Vehicle` interface (after line 31):

```typescript
interface VehicleStats {
  overview: {
    totalFillups: number
    totalGallons: number
    totalCost: number
    totalMiles: number
    firstFillup: string | null
    lastFillup: string | null
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
```

Add state (after the existing state declarations, around line 74):

```typescript
const [vehicleStats, setVehicleStats] = useState<VehicleStats | null>(null)
const [isLoadingStats, setIsLoadingStats] = useState(true)
```

Add the fetch function (after `fetchVehicle`, around line 148):

```typescript
async function fetchStats(filterStartDate?: string, filterEndDate?: string) {
  try {
    setIsLoadingStats(true)
    const statsParams = new URLSearchParams()
    if (filterStartDate) {
      statsParams.append('startDate', filterStartDate)
    }
    if (filterEndDate) {
      statsParams.append('endDate', filterEndDate)
    }
    const queryString = statsParams.toString()
    const url = `/api/vehicles/${vehicleId}/stats${queryString ? `?${queryString}` : ''}`
    const response = await fetch(url)
    if (response.ok) {
      const data = await response.json()
      setVehicleStats(data)
    }
  } catch {
    // Stats are non-critical; fail silently, KPI cards won't display
    console.error('Failed to load vehicle stats')
  } finally {
    setIsLoadingStats(false)
  }
}
```

**Step 3: Call fetchStats on Page Load and Filter Changes**

In the main `useEffect` (line 90-101), add `fetchStats()` alongside the existing fetches:

```typescript
useEffect(() => {
  if (status === 'unauthenticated') {
    router.push('/login')
    return
  }

  if (status === 'authenticated') {
    fetchVehicle()
    fetchFillups()
    fetchPendingFillups()
    fetchStats()  // ADD: fetch full stats for KPIs
  }
}, [status, router, vehicleId, fetchPendingFillups])
```

In the `applyDateFilter` function (line 189-199), add a `fetchStats` call so KPIs update when filters change:

```typescript
function applyDateFilter(start: string, end: string, filterName: string | null) {
  setStartDate(start)
  setEndDate(end)
  setActiveFilter(filterName)
  setFillups([])
  setNextCursor(null)
  setIsLoading(true)
  fetchFillups(undefined, start, end)
  fetchStats(start, end)  // ADD: re-fetch stats with filter params
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
```

**Step 4: Remove Client-Side KPI Calculations**

Remove the client-side stat calculations (lines 397-403):

```typescript
// DELETE these lines:
const totalFillups = fillups.length
const totalGallons = fillups.reduce((sum, f) => sum + f.gallons, 0)
const fillupsWithMpg = fillups.filter(f => f.mpg !== null)
const averageMpg = fillupsWithMpg.length > 0
  ? fillupsWithMpg.reduce((sum, f) => sum + (f.mpg || 0), 0) / fillupsWithMpg.length
  : null
```

These are fully replaced by the `vehicleStats` state from the API.

**Step 5: Update KPI Card Display**

Replace the existing 3-card KPI grid (lines 594-622) with an expanded layout that uses server-provided stats. The new layout shows 3 cards on the first row and 3 cards on the second row (6 total), using the richer data from the stats endpoint.

Replace the Stats Summary section with:

```tsx
{/* Stats Summary */}
{vehicleStats && vehicleStats.overview.totalFillups > 0 && (
  <div className="mb-6">
    <div className="grid grid-cols-3 gap-3 mb-3">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {vehicleStats.overview.totalFillups}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Fillups
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {vehicleStats.overview.totalGallons.toFixed(1)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Total Gal
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {vehicleStats.mpg.average ? vehicleStats.mpg.average.toFixed(1) : '--'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Avg MPG
        </p>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          ${vehicleStats.overview.totalCost.toFixed(0)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Total Cost
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {vehicleStats.costs.costPerMile ? `$${vehicleStats.costs.costPerMile.toFixed(2)}` : '--'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Cost/Mile
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {vehicleStats.costs.averagePricePerGallon ? `$${vehicleStats.costs.averagePricePerGallon.toFixed(3)}` : '--'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Avg $/Gal
        </p>
      </div>
    </div>
    {activeFilter && (
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
        Stats for: {activeFilter}
      </p>
    )}
  </div>
)}
{isLoadingStats && !vehicleStats && (
  <div className="grid grid-cols-3 gap-3 mb-6">
    {[1, 2, 3].map(i => (
      <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center animate-pulse">
        <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-1" />
        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
      </div>
    ))}
  </div>
)}
```

**Design notes:**
- First row retains the 3 original KPIs (Fillups, Total Gal, Avg MPG) for continuity
- Second row adds 3 new KPIs (Total Cost, Cost/Mile, Avg $/Gal) from the full stats response
- When a date filter is active, a small note below the stats clarifies the scope
- A loading skeleton displays while stats are being fetched
- Padding reduced from `p-4` to `p-3` to fit 6 cards comfortably on mobile

### Acceptance Criteria

- [ ] KPI cards show accurate totals for ALL fillups, not just the loaded/paginated subset
- [ ] A vehicle with 200 fillups correctly shows "200" in the Fillups card on initial load (not "20")
- [ ] Total Gallons reflects the sum across ALL fillups for the vehicle
- [ ] Average MPG matches the server-calculated average (only full fillups with MPG values)
- [ ] Three new KPI cards are displayed: Total Cost, Cost/Mile, Avg $/Gal
- [ ] When a date filter is active (e.g., "Last 30 days"), KPIs update to reflect only that date range
- [ ] When the filter is cleared, KPIs return to showing the full vehicle totals
- [ ] Stats endpoint backward compatibility: existing callers without date params still get full totals
- [ ] Stats endpoint correctly handles `startDate` only, `endDate` only, and both parameters
- [ ] Stats endpoint returns the same response shape regardless of whether date filters are passed
- [ ] KPI cards show a loading skeleton while stats are being fetched
- [ ] KPI cards render correctly in both light and dark themes
- [ ] No TypeScript errors introduced
- [ ] Build passes (`npm run build`)

### Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Extra API call on page load adds latency | Low | Low | The stats endpoint queries are simple aggregations with no JOINs on indexed columns; response is fast. Fetched in parallel with fillups, so no additional perceived latency. |
| Date-filtered stats may be confusing if user forgets filter is active | Medium | Low | Added a "Stats for: [filter name]" label below the KPI cards when a filter is active |
| `totalMiles` calculation may be incorrect for date-filtered ranges (odometer diff only covers filtered range) | Low | Low | This is actually the desired behavior: showing miles driven within the filtered period. Edge case: if only 1 fillup in range, totalMiles = 0 and costPerMile = null, which is correct. |
| Stats endpoint receives invalid date strings | Low | Low | Invalid dates are checked with `isNaN(date.getTime())` and silently ignored, falling back to unfiltered results |

### Verification Steps

1. Create or use a vehicle with 30+ fillups
2. Navigate to `/vehicles/[id]/fillups` -- KPI cards should show totals for ALL fillups (not just first 20)
3. Verify "Fillups" card shows the correct total count
4. Verify "Total Gal" matches the sum from the vehicle stats page
5. Verify "Avg MPG" matches the vehicle stats page value
6. Verify "Total Cost", "Cost/Mile", and "Avg $/Gal" cards display correctly
7. Apply "Last 30 days" filter -- KPIs should update to reflect only fillups in that range
8. Apply "This year" filter -- KPIs should update
9. Clear filter -- KPIs should return to full totals
10. Apply a custom date range -- KPIs should match
11. Verify existing vehicle detail page (`/vehicles/[id]`) still shows correct stats (backward compat)
12. Test with a vehicle that has 0 fillups -- no KPI cards should display
13. Test with a vehicle that has 1 fillup -- KPI cards show, Cost/Mile shows "--"
14. Verify dark mode renders correctly
15. Run `npm run build` -- no errors

---

## Commit Strategy

| Commit | Scope | Message |
|--------|-------|---------|
| 1 | 15-01 (component) | `feat(pwa): add shared OfflineNotice component` |
| 2 | 15-01 (auth fix) | `fix(pwa): guard auth redirects with offline check on all 13 pages` |
| 3 | 15-03 (schema) | `feat(db): add defaultThousandths field to User model (opt-in, default 0)` |
| 4 | 15-03 (api+ui) | `feat(pricing): add thousandths pricing with raw string decimal detection and retroactive adjustment` |
| 5 | 15-04 (api+ui) | `fix(stats): use server stats for fillup history KPIs instead of paginated data` |
| 6 | 15-02 (api) | `feat(analytics): add time-series analytics API endpoint` |
| 7 | 15-02 (page) | `feat(analytics): add analytics page with fuel data charts` |
| 8 | 15-02 (nav) | `feat(nav): add Stats link to bottom navigation, remove redundant theme toggle` |

## Overall Success Criteria

- [ ] All four features work independently (with 15-02, 15-03, and 15-04 depending on 15-01 completing first)
- [ ] PWA works offline without login redirect on ALL 13 affected pages
- [ ] Vehicles list page shows cached vehicles when offline (populated from dashboard visit), or `OfflineNotice` if no cache
- [ ] No hydration race condition causes brief redirect flash when loading offline
- [ ] Analytics page shows meaningful charts for users with fillup data
- [ ] Analytics page shows offline notice (not redirect) when offline
- [ ] Thousandths pricing defaults to disabled (0) for all users -- opt-in only
- [ ] Thousandths correctly detects decimal places from raw input string, including trailing zeros
- [ ] Enabling thousandths retroactively adjusts all historical round-cent fillup prices and recalculates totalCost
- [ ] Retroactive adjustment count is displayed to the user on the profile page after saving
- [ ] Fillup history KPI cards show accurate totals from the server, not from paginated client data
- [ ] Fillup history KPIs update correctly when date filters are applied or cleared
- [ ] Stats endpoint backward compatibility preserved (no date params = full totals)
- [ ] No regressions to existing functionality
- [ ] `npm run build` passes with zero errors
- [ ] All pages render correctly in both light and dark themes
- [ ] Mobile viewport (375px) renders all pages correctly
