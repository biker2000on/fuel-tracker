---
phase: 11-pwa-offline
plan: 03
subsystem: offline
tags: [sync, indexeddb, retry, backoff, offline-queue, pending-ui]

# Dependency graph
requires:
  - phase: 11-02
    provides: OfflineContext with isOnline/wasOffline, ConnectionToast for status
provides:
  - Sync engine with exponential backoff retry logic
  - Pending fillups visible in history with badge
  - Delete queued fillups before sync
  - Toast notification on successful sync
affects: [11-04-install-prompt]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Exponential backoff for retries (baseDelay * 2^attempt)
    - Sequential queue processing to maintain order
    - Unified display type for mixed synced/pending items

key-files:
  created:
    - src/lib/syncEngine.ts
    - src/components/PendingFillupBadge.tsx
  modified:
    - src/hooks/useOfflineQueue.ts
    - src/contexts/OfflineContext.tsx
    - src/components/ConnectionToast.tsx
    - src/lib/offlineDb.ts
    - src/app/vehicles/[id]/fillups/page.tsx

key-decisions:
  - "Sequential sync processing to maintain FIFO order"
  - "Don't retry on 4xx (client errors), only on 5xx and network errors"
  - "Estimated MPG shown with ~ prefix for pending fillups"
  - "Pending fillups shown at top of list with amber ring highlight"

patterns-established:
  - "SyncResult type for standardized sync responses with retryCount"
  - "DisplayFillup union type for rendering mixed synced/pending items"
  - "onSyncComplete callback pattern for notification propagation"

# Metrics
duration: 5min
completed: 2026-01-22
---

# Phase 11 Plan 03: Sync Engine & Pending UI Summary

**Sync engine with exponential backoff retry, pending fillup visibility in history with amber badge, and sync success toasts**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-22T17:06:29Z
- **Completed:** 2026-01-22T17:11:33Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Sync engine with configurable retry and exponential backoff (baseDelay * 2^attempt)
- Pending fillups displayed in history with clear visual distinction (amber badge + ring)
- Users can delete pending fillups from queue before sync
- Toast notification shows "X fillups synced" when coming back online

## Task Commits

Each task was committed atomically:

1. **Task 1: Create syncEngine with retry and backoff** - `d6f391d` (feat)
2. **Task 2: Update useOfflineQueue and OfflineContext to use syncEngine** - `bdc0908` (feat)
3. **Task 3: Display pending fillups in history with badge and actions** - `a5c9ba1` (feat)

## Files Created/Modified
- `src/lib/syncEngine.ts` - Sync logic with syncSingleFillup and syncPendingFillups, retry with backoff
- `src/components/PendingFillupBadge.tsx` - Amber badge component with clock icon
- `src/hooks/useOfflineQueue.ts` - Updated to use syncEngine, added onSyncComplete callback
- `src/contexts/OfflineContext.tsx` - Wired pendingCount, isSyncing, syncQueue from hook
- `src/components/ConnectionToast.tsx` - Added 'synced' toast type with blue styling
- `src/lib/offlineDb.ts` - Added updateQueueItem and getQueueItem functions
- `src/app/vehicles/[id]/fillups/page.tsx` - Shows pending fillups with badge, sync button, delete

## Decisions Made
- Sequential sync processing rather than parallel to maintain FIFO order for chronological accuracy
- 4xx errors don't retry (client errors should be fixed, not retried)
- Estimated MPG shown with ~ prefix to indicate it's calculated locally, not server-verified
- Pending fillups get amber ring highlight to make them visually distinct from synced fillups
- Stats summary only counts synced fillups for accuracy (pending excluded)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sync engine complete with retry logic
- Pending fillups visible and manageable in UI
- Ready for Plan 11-04: Install prompt and PWA metadata finalization

---
*Phase: 11-pwa-offline*
*Completed: 2026-01-22*
