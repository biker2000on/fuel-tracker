---
phase: 12
plan: 01
subsystem: fillups
tags: [mpg, recalculation, api, ui]
dependency-graph:
  requires: [05-fillup-entry, 11.1-infinite-scroll]
  provides: [mpg-recalculation-on-edit, manual-mpg-recalculate]
  affects: [data-accuracy, fillup-editing]
tech-stack:
  added: []
  patterns: [cascade-update, manual-trigger-endpoint]
key-files:
  created:
    - src/app/api/fillups/[id]/recalculate/route.ts
  modified:
    - src/app/api/fillups/[id]/route.ts
    - src/app/vehicles/[id]/fillups/page.tsx
decisions:
  - decision: Cascade MPG recalculation on odometer change
    rationale: Next fillup's MPG depends on current fillup's odometer
  - decision: Exclude current fillup when finding previous for calculation
    rationale: Prevents self-reference in MPG calculation
metrics:
  duration: ~8min
  completed: 2026-01-22
---

# Phase 12 Plan 01: MPG Recalculation Summary

**One-liner:** Automatic MPG recalculation on fillup edit with cascade to next fillup, plus manual recalculate button for full tank entries.

## What Was Built

### 1. PATCH Endpoint MPG Recalculation

Updated `/api/fillups/[id]` PATCH handler to:
- Detect when gallons, odometer, or isFull fields change
- Recalculate current fillup's MPG using previous full fillup
- Cascade recalculation to next fillup when odometer changes
- Handle edge cases: partial fillups (null MPG), no previous fillup

### 2. Manual Recalculate Endpoint

Created POST `/api/fillups/[id]/recalculate`:
- Authenticates user and verifies group membership
- Validates fillup is a full tank (400 if partial)
- Finds previous full fillup by odometer
- Calculates and updates MPG
- Returns full fillup data including new MPG

### 3. Recalculate MPG Button

Added UI button in fillup expanded details:
- Only appears for synced, full tank fillups
- Shows loading state during recalculation
- Updates fillup list with new MPG on success
- Displays success/error messages

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 78f6818 | feat | Add MPG recalculation to PATCH endpoint |
| 0ebe9ac | feat | Create manual recalculate endpoint |
| 4026e66 | feat | Add Recalculate MPG button to fillup details |

## Technical Details

**MPG Calculation Formula:**
```
MPG = (current_odometer - previous_full_fillup_odometer) / gallons
```

**Cascade Logic:**
When odometer changes on a fillup:
1. Recalculate current fillup's MPG
2. Find next full fillup (odometer > current)
3. Find that fillup's previous full fillup
4. Recalculate next fillup's MPG

**Edge Cases Handled:**
- Partial fillups always have null MPG
- First fillup (no previous) has null MPG
- Odometer order determines "previous/next", not date

## Deviations from Plan

None - plan executed exactly as written.

## Verification Performed

- Build passes with no TypeScript errors
- New endpoint `/api/fillups/[id]/recalculate` listed in build output
- All modified files type-check correctly

## Next Phase Readiness

Phase 12 is now complete. Ready for Phase 13 (Profile Page) or any additional v1.1 polish items.
