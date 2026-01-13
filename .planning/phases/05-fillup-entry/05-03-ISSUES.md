# UAT Issues: Phase 05 Plan 03

**Tested:** 2026-01-13
**Source:** .planning/phases/05-fillup-entry/05-03-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

### UAT-001: Fillup edit page does not exist

**Discovered:** 2026-01-13
**Phase/Plan:** 05-03
**Severity:** Major
**Feature:** Per-vehicle fillup list - edit functionality
**Description:** The Edit button in the expanded fillup card links to `/fillups/[id]/edit` but that page does not exist. Clicking Edit results in a 404.
**Expected:** Edit page loads with pre-populated fillup data for editing
**Actual:** 404 page not found
**Repro:**
1. Go to /vehicles/[id]/fillups
2. Click on a fillup card to expand it
3. Click "Edit" button

### UAT-002: Location detection missing city

**Discovered:** 2026-01-13
**Phase/Plan:** 05-03
**Severity:** Minor
**Feature:** Quick fillup entry form - location auto-detection
**Description:** Reverse geocoding returns state and country but not city name.
**Expected:** Location badge shows "City, State" (e.g., "Denver, Colorado")
**Actual:** Location badge shows only "State, Country" (e.g., "Colorado, United States")
**Repro:**
1. Go to /fillups/new
2. Allow location access
3. Observe location badge

## Resolved Issues

[None yet]

---

*Phase: 05-fillup-entry*
*Plan: 03*
*Tested: 2026-01-13*
