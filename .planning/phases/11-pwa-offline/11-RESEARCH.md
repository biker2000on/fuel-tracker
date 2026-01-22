# Phase 11: PWA & Offline - Research

**Researched:** 2026-01-22
**Domain:** PWA install prompt, offline storage, background sync, network detection
**Confidence:** HIGH

## Summary

This phase addresses the PWA install prompt not appearing and implements robust offline fillup queuing with automatic sync. The existing codebase already has solid foundations:

- **Serwist v9.5.0** is already configured with service worker (sw.ts) and runtime caching
- **idb-keyval** is installed and basic offline queue exists in `offlineDb.ts`
- **useInstallPrompt** hook exists but install button is in a floating banner (needs to move to profile)
- **useOfflineQueue** hook exists with basic sync but lacks retry with backoff

**Primary recommendation:** Build on existing infrastructure. Move install button to a new profile page, enhance offline queue with IndexedDB caching for vehicles/fillups, add connection status indicators with toast notifications, and implement conflict resolution UI.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| serwist | ^9.5.0 | Service worker, caching, background sync | Installed |
| @serwist/next | ^9.5.0 | Next.js integration for Serwist | Installed |
| idb-keyval | ^6.2.2 | Simple IndexedDB wrapper | Installed |

### No Additional Dependencies Needed

The existing stack is sufficient. Key patterns to implement:
- Extend idb-keyval usage for vehicle/fillup caching
- Use Serwist's BackgroundSyncQueue for enhanced sync
- Use native browser APIs (navigator.onLine, online/offline events)

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── profile/
│   │   └── page.tsx           # NEW: Profile page with install button
│   └── ~offline/
│       └── page.tsx           # EXISTS: Offline fallback page
├── components/
│   ├── InstallButton.tsx      # NEW: Dedicated install button component
│   ├── OfflineIndicator.tsx   # NEW: Persistent offline status indicator
│   ├── ConnectionToast.tsx    # NEW: Toast for online/offline transitions
│   ├── PendingFillupBadge.tsx # NEW: Badge for queued fillups
│   └── ConflictResolver.tsx   # NEW: Modal for resolving sync conflicts
├── contexts/
│   └── OfflineContext.tsx     # NEW: Context for offline state management
├── hooks/
│   ├── useInstallPrompt.ts    # EXISTS: Capture beforeinstallprompt
│   ├── useOfflineQueue.ts     # EXISTS: Queue management (enhance)
│   ├── useNetworkStatus.ts    # NEW: Network detection hook
│   └── useCachedData.ts       # NEW: Hook for cached vehicle/fillup data
└── lib/
    ├── offlineDb.ts           # EXISTS: IndexedDB operations (enhance)
    └── syncEngine.ts          # NEW: Sync logic with retry/conflict resolution
```

### Pattern 1: Offline Context Provider
**What:** Centralized state management for offline features
**When to use:** App-wide access to online status, pending count, sync state
**Example:**
```typescript
// Source: Standard React Context pattern for PWA
interface OfflineContextValue {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  syncNow: () => Promise<void>
  cachedVehicles: Vehicle[]
  getCachedFillups: (vehicleId: string) => Promise<Fillup[]>
}

const OfflineContext = createContext<OfflineContextValue | null>(null)

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  // ... implementation
}
```

### Pattern 2: Optimistic UI with Pending State
**What:** Show queued fillups inline with synced data, marked with pending badge
**When to use:** Fillup history display
**Example:**
```typescript
// Source: Offline-first pattern from context research
type FillupWithStatus = Fillup & {
  syncStatus: 'synced' | 'pending' | 'error'
  localId?: string  // For pending items
}

function useMergedFillups(vehicleId: string): FillupWithStatus[] {
  const { data: serverFillups } = useFillups(vehicleId)
  const { pendingFillups } = useOfflineQueue()

  // Merge pending with server data, sorted by date
  return useMemo(() => {
    const pending = pendingFillups
      .filter(p => p.data.vehicleId === vehicleId)
      .map(p => ({
        ...p.data,
        id: p.id,
        syncStatus: 'pending' as const,
        localId: p.id
      }))

    const synced = (serverFillups || []).map(f => ({
      ...f,
      syncStatus: 'synced' as const
    }))

    return [...pending, ...synced].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [serverFillups, pendingFillups, vehicleId])
}
```

### Pattern 3: Exponential Backoff for Sync Retries
**What:** Retry failed syncs with increasing delays
**When to use:** Automatic sync when connection restored
**Example:**
```typescript
// Source: https://advancedweb.hu/how-to-implement-an-exponential-backoff-retry-strategy-in-javascript/
async function syncWithBackoff(
  syncFn: () => Promise<void>,
  maxRetries = 5,
  baseDelay = 1000
): Promise<boolean> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await syncFn()
      return true
    } catch (error) {
      if (attempt === maxRetries - 1) throw error

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt)
      const jitter = delay * 0.2 * Math.random()
      await new Promise(r => setTimeout(r, delay + jitter))
    }
  }
  return false
}
```

### Anti-Patterns to Avoid
- **DevTools offline testing:** Service worker requests still go through. Test with actual network disconnection.
- **Empty service worker fetch handlers:** Chrome ignores them. The existing sw.ts has proper handlers.
- **Syncing on every keystroke:** Batch operations, sync on submit or debounced intervals.
- **Blocking UI during sync:** Always sync in background, show non-blocking indicators.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB operations | Raw IndexedDB API | idb-keyval (installed) | Async/await, much simpler API |
| Service worker | Manual SW registration | @serwist/next (installed) | Handles precaching, runtime caching |
| Background sync queue | Custom queue in localStorage | Serwist BackgroundSyncQueue | Handles IndexedDB storage, browser sync API |
| Network detection | Polling navigator.onLine | online/offline events | Event-driven, no polling needed |
| Retry logic | Simple setTimeout | Exponential backoff pattern | Prevents server overload |

**Key insight:** The project already has the right libraries installed. The task is extending their usage, not adding new dependencies.

## Common Pitfalls

### Pitfall 1: beforeinstallprompt Not Firing
**What goes wrong:** Install button never appears or only works sometimes
**Why it happens:** Multiple reasons:
1. PWA already installed
2. Criteria not met (manifest, HTTPS, service worker)
3. User engagement heuristic not satisfied (Chrome: 30 seconds interaction)
4. Browser doesn't support the event (Safari, Firefox)

**How to avoid:**
- Always show install button if `canInstall` is true OR if platform is iOS (manual instructions)
- Don't hide the button after dismissal - user decision states: install, dismiss, already installed
- Check manifest is valid: name, icons (192x192, 512x512), start_url, display

**Warning signs:** `deferredPrompt` always null, event never fires on console

### Pitfall 2: Offline Data Staleness
**What goes wrong:** User sees outdated cached data without knowing it
**Why it happens:** Cache not refreshed, no visual indicator of data age

**How to avoid:**
- Always show "Last updated" timestamp for cached data
- Add visual indicator (subtle badge, different background) for cached views
- Proactively refresh cache when online

**Warning signs:** Users complaining about "wrong" data that's actually stale cache

### Pitfall 3: Sync Conflicts Silently Overwritten
**What goes wrong:** User loses data when another device syncs first
**Why it happens:** Server wins without user awareness

**How to avoid:**
- Track local changes with timestamps
- On sync, compare server state before writing
- When conflict detected, present user with choice (per CONTEXT.md decision)

**Warning signs:** Users reporting "disappeared" fillups

### Pitfall 4: Service Worker Cache Poisoning
**What goes wrong:** Users stuck on old version, can't see new features
**Why it happens:** skipWaiting not working, cache not cleared

**How to avoid:**
- Serwist handles this with `skipWaiting: true, clientsClaim: true` (already configured)
- Ensure versioned cache names (already done via build manifest)

**Warning signs:** Users reporting they don't see new features after deploy

### Pitfall 5: Memory Issues with Large Offline Queues
**What goes wrong:** App becomes slow or crashes with many queued items
**Why it happens:** No limit on queue size, storing too much data

**How to avoid:**
- Context decision says "no limit" but monitor performance
- Consider compressing data or warning at high counts
- Prioritize oldest items for sync

**Warning signs:** Growing IndexedDB size, slow app startup

## Code Examples

### Example 1: Enhanced Network Status Hook
```typescript
// Source: https://medium.com/@abdulahad2024/real-time-network-status-detection-in-react-js-next-js-67595c4bd81c
'use client'

import { useState, useEffect, useCallback } from 'react'

interface NetworkStatus {
  isOnline: boolean
  wasOffline: boolean  // Track if we came back from offline
  connectionType: string | null
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    connectionType: null
  })

  useEffect(() => {
    const updateStatus = (online: boolean) => {
      setStatus(prev => ({
        isOnline: online,
        wasOffline: !online || prev.wasOffline,
        connectionType: (navigator as any).connection?.effectiveType ?? null
      }))
    }

    const handleOnline = () => updateStatus(true)
    const handleOffline = () => updateStatus(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Also listen for connection changes if available
    const connection = (navigator as any).connection
    if (connection) {
      connection.addEventListener('change', () => {
        updateStatus(navigator.onLine)
      })
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return status
}
```

### Example 2: IndexedDB Cache for Vehicles and Fillups
```typescript
// Source: Extending existing offlineDb.ts with idb-keyval
import { get, set, del, keys } from 'idb-keyval'

const CACHE_PREFIX = 'cache-'
const VEHICLES_KEY = `${CACHE_PREFIX}vehicles`
const FILLUPS_PREFIX = `${CACHE_PREFIX}fillups-`
const CACHE_METADATA_KEY = `${CACHE_PREFIX}metadata`

interface CacheMetadata {
  vehiclesLastUpdated: string | null
  fillupsLastUpdated: Record<string, string>  // vehicleId -> timestamp
}

// Cache vehicles
export async function cacheVehicles(vehicles: Vehicle[]): Promise<void> {
  await set(VEHICLES_KEY, vehicles)
  await updateCacheMetadata({ vehiclesLastUpdated: new Date().toISOString() })
}

export async function getCachedVehicles(): Promise<Vehicle[] | null> {
  return await get<Vehicle[]>(VEHICLES_KEY) ?? null
}

// Cache fillups per vehicle (last 10)
export async function cacheFillups(
  vehicleId: string,
  fillups: Fillup[]
): Promise<void> {
  const toCache = fillups.slice(0, 10)  // Per CONTEXT.md: last 10
  await set(`${FILLUPS_PREFIX}${vehicleId}`, toCache)

  const metadata = await getCacheMetadata()
  metadata.fillupsLastUpdated[vehicleId] = new Date().toISOString()
  await set(CACHE_METADATA_KEY, metadata)
}

export async function getCachedFillups(vehicleId: string): Promise<Fillup[] | null> {
  return await get<Fillup[]>(`${FILLUPS_PREFIX}${vehicleId}`) ?? null
}

async function getCacheMetadata(): Promise<CacheMetadata> {
  return await get<CacheMetadata>(CACHE_METADATA_KEY) ?? {
    vehiclesLastUpdated: null,
    fillupsLastUpdated: {}
  }
}

async function updateCacheMetadata(
  updates: Partial<CacheMetadata>
): Promise<void> {
  const current = await getCacheMetadata()
  await set(CACHE_METADATA_KEY, { ...current, ...updates })
}
```

### Example 3: Conflict Detection and Resolution
```typescript
// Source: Based on conflict resolution patterns from research
interface SyncConflict {
  localFillup: PendingFillup
  serverFillups: Fillup[]  // New fillups on server for same vehicle
  vehicleId: string
}

async function detectConflicts(
  pending: PendingFillup
): Promise<SyncConflict | null> {
  // Fetch current server state for this vehicle
  const response = await fetch(
    `/api/fillups?vehicleId=${pending.data.vehicleId}&since=${pending.createdAt}`
  )

  if (!response.ok) return null

  const { fillups: serverFillups } = await response.json()

  if (serverFillups.length > 0) {
    return {
      localFillup: pending,
      serverFillups,
      vehicleId: pending.data.vehicleId
    }
  }

  return null
}

// Resolution options per CONTEXT.md
type ConflictResolution =
  | { type: 'keep-local' }
  | { type: 'keep-server' }
  | { type: 'keep-both' }
```

### Example 4: Install Button for Profile Page
```typescript
// Source: MDN beforeinstallprompt documentation
'use client'

import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export function InstallButton() {
  const { canInstall, isInstalled, isStandalone, promptInstall } = useInstallPrompt()

  // Always show the section, with different content based on state
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
      <h3 className="font-medium text-gray-900 dark:text-white mb-2">
        Install App
      </h3>

      {isInstalled || isStandalone ? (
        <p className="text-sm text-green-600 dark:text-green-400">
          App is installed - you're using it now!
        </p>
      ) : canInstall ? (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Add to home screen for quick access at the pump
          </p>
          <button
            onClick={promptInstall}
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
          >
            Install Fuel Tracker
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Add to home screen for quick access
          </p>
          {/* iOS-specific instructions */}
          <p className="text-xs text-gray-500 dark:text-gray-500">
            On iOS: Tap the share button, then "Add to Home Screen"
          </p>
        </>
      )}
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| next-pwa | Serwist | 2024 | Already using Serwist - correct choice |
| localStorage for offline | IndexedDB | Ongoing | Already using idb-keyval - correct choice |
| Manual SW registration | Framework integration | Ongoing | @serwist/next handles this |
| Workbox | Serwist | 2024 | Serwist is modern Workbox fork, installed |

**Deprecated/outdated:**
- `@serwist/background-sync` - Use main `serwist` package instead (v9.x consolidated modules)
- `workbox-*` packages - Serwist is the maintained successor

## Open Questions

Things that couldn't be fully resolved:

1. **Exact Chrome engagement heuristic timing**
   - What we know: Chrome requires ~30 seconds of user interaction
   - What's unclear: Exact conditions, whether this has changed recently
   - Recommendation: Don't rely on timing; show install option in profile regardless

2. **Background Sync API support in 2026**
   - What we know: Serwist provides fallback for unsupported browsers
   - What's unclear: Current browser support percentages
   - Recommendation: Use Serwist's BackgroundSyncQueue which handles fallback automatically

3. **Optimal cache limits**
   - What we know: CONTEXT.md says 10 fillups per vehicle
   - What's unclear: Whether this is enough for meaningful offline analytics
   - Recommendation: Start with 10, monitor feedback, easy to increase later

## Sources

### Primary (HIGH confidence)
- [Serwist Background Sync Documentation](https://serwist.pages.dev/docs/serwist/guide/background-syncing) - BackgroundSyncQueue API, testing strategy
- [MDN beforeinstallprompt Event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event) - Event interface, code examples
- [MDN Making PWAs Installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) - Installation criteria
- [Chrome Install Criteria](https://developer.chrome.com/blog/update-install-criteria) - Chrome-specific requirements

### Secondary (MEDIUM confidence)
- [web.dev Installation Prompt](https://web.dev/learn/pwa/installation-prompt) - Best practices for custom install UI
- [LogRocket Offline-First Apps 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) - Current patterns and tools
- [Advanced Web Machinery Exponential Backoff](https://advancedweb.hu/how-to-implement-an-exponential-backoff-retry-strategy-in-javascript/) - Retry implementation
- [GTC Sys Conflict Resolution](https://gtcsys.com/comprehensive-faqs-guide-data-synchronization-in-pwas-offline-first-strategies-and-conflict-resolution/) - Sync conflict patterns

### Tertiary (LOW confidence)
- Various Medium articles on React network detection hooks - Implementation patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already installed, verified versions
- Architecture: HIGH - Patterns well-documented, similar to existing code
- Pitfalls: HIGH - Well-documented across official sources
- Conflict resolution: MEDIUM - User decisions clear, implementation patterns vary

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (30 days - stable domain, PWA standards well-established)

## Existing Codebase Analysis

### What Already Exists (DO NOT REBUILD)
1. **sw.ts** - Full service worker with runtime caching for:
   - Static assets (CacheFirst)
   - API GET requests (NetworkFirst with 3s timeout)
   - API mutations (NetworkOnly)
   - Offline fallback to `~offline` page

2. **useInstallPrompt.ts** - Complete hook with:
   - beforeinstallprompt capture
   - Standalone detection
   - iOS Safari detection
   - appinstalled listener

3. **offlineDb.ts** - IndexedDB queue with:
   - addToQueue, getQueue, removeFromQueue
   - PendingFillup interface

4. **useOfflineQueue.ts** - Basic sync with:
   - Online/offline detection
   - Auto-sync on reconnect
   - syncInProgress tracking

5. **InstallPrompt.tsx** - Floating banner (to be deprecated)

### What Needs Enhancement
1. **useOfflineQueue** - Add retry with backoff, conflict detection
2. **offlineDb** - Add vehicle/fillup caching functions
3. **Profile page** - Create new page with install button
4. **Toast notifications** - Create component for connection changes
5. **Offline indicator** - Create persistent status component
6. **Fillup history** - Merge pending items with server data

### What Needs Creation
1. Profile page (`/app/profile/page.tsx`)
2. OfflineContext provider
3. ConnectionToast component
4. OfflineIndicator component
5. PendingFillupBadge component
6. ConflictResolver modal
7. syncEngine.ts for enhanced sync logic
