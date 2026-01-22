# Roadmap: Fuel Tracker

## Milestones

- [v1.0 MVP](milestones/v1.0-ROADMAP.md) — Phases 1-8 (shipped 2026-01-14)
- **v1.1 Polish & Reliability** — Phases 9-13 (in progress)

## Completed Milestones

<details>
<summary>v1.0 MVP (Phases 1-8) — SHIPPED 2026-01-14</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-01-13
- [x] Phase 2: Authentication (3/3 plans) — completed 2026-01-13
- [x] Phase 3: Family Groups (3/3 plans) — completed 2026-01-13
- [x] Phase 4: Vehicle Management (3/3 plans) — completed 2026-01-13
- [x] Phase 5: Fillup Entry (3/3 plans) — completed 2026-01-13
- [x] Phase 6: History & Analytics (3/3 plans) — completed 2026-01-13
- [x] Phase 7: PWA Polish (3/3 plans) — completed 2026-01-14
- [x] Phase 8: CSV Import (2/2 plans) — completed 2026-01-14

**Total:** 8 phases, 23 plans

[Full details →](milestones/v1.0-ROADMAP.md)

</details>

### v1.1 Polish & Reliability (In Progress)

**Milestone Goal:** Fix UI issues, add theme system, fix PWA/offline functionality, and add profile management.

#### Phase 9: UI/Layout Fixes

**Goal**: Fix fillup button covered by bottom menu, vehicles icon appearance on mobile, and other layout issues
**Depends on**: v1.0 complete
**Completed**: 2026-01-22

Plans:
- [x] 09-01: UI/Layout Fixes — fixed button positioning, vehicles icon

#### Phase 10: Theme System

**Goal**: Add user-selectable dark/light theme with persistence, unify color scheme across all pages
**Depends on**: Phase 9
**Completed**: 2026-01-22

Plans:
- [x] 10-01: Theme infrastructure — context, localStorage, CSS variables
- [x] 10-02: Theme toggle and dark mode styles across all pages

#### Phase 11: PWA & Offline

**Goal**: Fix install prompt not appearing, enable offline fillup queuing with automatic sync when back online
**Depends on**: Phase 10
**Completed**: 2026-01-22

Plans:
- [x] 11-01: Profile page with PWA install button
- [x] 11-02: Offline context and connection status indicators
- [x] 11-03: Enhanced sync engine with retry/backoff and pending fillup display
- [x] 11-04: Data caching for offline viewing and conflict resolution

#### Phase 11.1: Infinite Scroll on Vehicles Fillups Page (INSERTED)

**Goal**: Add infinite scroll to vehicles fillups page for better performance with large fillup histories
**Depends on**: Phase 11
**Completed**: 2026-01-22

Plans:
- [x] 11.1-01: Infinite scroll with IntersectionObserver and accessibility enhancements

#### Phase 12: MPG Recalculation

**Goal**: Recompute MPG on edit for current and next fillups, add manual recompute button
**Depends on**: Phase 11.1
**Completed**: 2026-01-22

Plans:
- [x] 12-01: MPG recalculation on edit and manual recalculate button

#### Phase 13: Profile Page

**Goal**: Build profile page with theme preference, first/last name, email display, and password change option
**Depends on**: Phase 12
**Research**: Unlikely (internal CRUD patterns)
**Plans**: TBD

Plans:
- [ ] 13-01: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-01-13 |
| 2. Authentication | v1.0 | 3/3 | Complete | 2026-01-13 |
| 3. Family Groups | v1.0 | 3/3 | Complete | 2026-01-13 |
| 4. Vehicle Management | v1.0 | 3/3 | Complete | 2026-01-13 |
| 5. Fillup Entry | v1.0 | 3/3 | Complete | 2026-01-13 |
| 6. History & Analytics | v1.0 | 3/3 | Complete | 2026-01-13 |
| 7. PWA Polish | v1.0 | 3/3 | Complete | 2026-01-14 |
| 8. CSV Import | v1.0 | 2/2 | Complete | 2026-01-14 |
| 9. UI/Layout Fixes | v1.1 | 1/1 | Complete | 2026-01-22 |
| 10. Theme System | v1.1 | 2/2 | Complete | 2026-01-22 |
| 11. PWA & Offline | v1.1 | 4/4 | Complete | 2026-01-22 |
| 11.1 Infinite Scroll | v1.1 | 1/1 | Complete | 2026-01-22 |
| 12. MPG Recalculation | v1.1 | 1/1 | Complete | 2026-01-22 |
| 13. Profile Page | v1.1 | 0/? | Not started | - |
