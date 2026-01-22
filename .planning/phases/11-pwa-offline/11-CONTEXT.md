# Phase 11: PWA & Offline - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix install prompt not appearing, enable offline fillup queuing with automatic sync when back online. Includes offline indicator, cached data viewing, and conflict resolution.

</domain>

<decisions>
## Implementation Decisions

### Install experience
- Install button lives in profile/settings page (not floating banner)
- Always visible as an option, even if already installed or dismissed
- Include short benefit text: "Add to home screen for quick access" or similar
- Let browser handle actual install prompt when button is tapped

### Offline indicator
- Toast notification when connection status changes (going offline/online)
- Persistent subtle indicator showing current offline status
- "Back online" toast only shows if queued items were synced

### Offline features
- Fillup entry works offline (primary use case)
- View previously loaded history offline
- Analytics available from cached data with "cached data may be incomplete" notice
- Features requiring internet are greyed out with tooltip explanation

### Data caching
- Vehicle list always cached for offline access
- Last 10 fillups per vehicle cached for offline viewing
- Cache supports offline analytics calculations

### Offline fillup behavior
- Lat/long recorded during offline fillup
- Reverse geocoding lookup happens on sync
- MPG calculated on sync (server-side)
- Local estimated MPG shown while queued, marked as "estimated"

### Fillup queuing
- Queued fillups shown in-line with history, marked with pending badge/icon
- Full edit and delete available for queued items before sync
- No limit on queue size

### Sync behavior
- Sync immediately when connection detected
- Automatic retry with backoff on failure
- Toast message on successful sync: "X fillups synced"

### Conflict handling
- If server has new fillups for same vehicle (from another device), ask user how to resolve
- Present both fillups and let user choose which to keep or keep both

### Claude's Discretion
- Exact offline indicator design/placement
- Retry backoff timing and max attempts
- Conflict resolution UI design
- Cache storage implementation (IndexedDB vs other)

</decisions>

<specifics>
## Specific Ideas

- Offline fillup should feel just like online fillup — same form, same flow
- The pending badge should be subtle but noticeable (not alarming)
- Sync should be seamless — user shouldn't need to think about it

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-pwa-offline*
*Context gathered: 2026-01-22*
