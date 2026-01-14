# Roadmap: Fuel Tracker

## Overview

Build a mobile-first PWA for quick fuel tracking at the pump. Start with foundation and auth, add family group sharing for household vehicles, then implement the core fillup entry flow with location detection. Finish with history views and PWA polish for offline capability.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation** - Project setup with Next.js, Prisma, PostgreSQL, Docker
- [x] **Phase 2: Authentication** - User registration, login, session management
- [x] **Phase 3: Family Groups** - Group creation, member management, shared access
- [x] **Phase 4: Vehicle Management** - Vehicle profiles with photos and specifications
- [x] **Phase 5: Fillup Entry** - Core fillup logging with location auto-detection
- [x] **Phase 6: History & Analytics** - Fillup history, MPG calculations, trends
- [x] **Phase 7: PWA Polish** - Offline capability, install prompts, mobile optimization
- [ ] **Phase 8: CSV Import** - Import historical fillup records from CSV files

## Phase Details

### Phase 1: Foundation
**Goal**: Working Next.js app with Prisma, PostgreSQL, and Docker deployment ready
**Depends on**: Nothing (first phase)
**Research**: Unlikely (established patterns)
**Plans**: TBD

Plans:
- [x] 01-01: Next.js project with App Router and Tailwind
- [x] 01-02: Prisma setup with PostgreSQL and base schema
- [x] 01-03: Docker configuration for self-hosted deployment

### Phase 2: Authentication
**Goal**: Users can register, login, and maintain sessions
**Depends on**: Phase 1
**Research**: Likely (auth library choice)
**Research topics**: NextAuth.js vs custom auth, session strategy, credential storage
**Plans**: TBD

Plans:
- [x] 02-01: Auth library setup and user model
- [x] 02-02: Registration and login flows
- [x] 02-03: Protected routes and session handling

### Phase 3: Family Groups
**Goal**: Users can create/join family groups and share vehicles
**Depends on**: Phase 2
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [x] 03-01: Group model and membership relationships
- [x] 03-02: Group creation and invite system
- [x] 03-03: Group-based access control for vehicles

### Phase 4: Vehicle Management
**Goal**: Users can add vehicles with full profiles and photos
**Depends on**: Phase 3
**Research**: Unlikely (standard CRUD)
**Plans**: TBD

Plans:
- [x] 04-01: Vehicle model and CRUD operations
- [x] 04-02: Vehicle photo upload and storage
- [x] 04-03: Vehicle list and detail views

### Phase 5: Fillup Entry
**Goal**: Quick fillup logging with automatic location detection
**Depends on**: Phase 4
**Research**: Likely (geolocation APIs)
**Research topics**: Browser Geolocation API, reverse geocoding service options, offline location handling
**Plans**: TBD

Plans:
- [x] 05-01: Fillup model and entry form
- [x] 05-02: Location auto-detection and geocoding
- [x] 05-03: Quick-entry UX optimization

### Phase 6: History & Analytics
**Goal**: View fillup history and track fuel economy trends
**Depends on**: Phase 5
**Research**: Unlikely (internal aggregation)
**Plans**: TBD

Plans:
- [x] 06-01: Per-vehicle fillup history views
- [x] 06-02: MPG calculations and statistics
- [x] 06-03: Dashboard with trends and recent activity

### Phase 7: PWA Polish
**Goal**: Full PWA with offline capability and optimized mobile experience
**Depends on**: Phase 6
**Research**: Likely (service worker patterns)
**Research topics**: next-pwa configuration, service worker caching strategies, offline form submission
**Plans**: TBD

Plans:
- [x] 07-01: PWA manifest and service worker setup
- [x] 07-02: Offline capability and sync
- [x] 07-03: Mobile UI polish and install prompts

### Phase 8: CSV Import
**Goal**: Import historical fillup records from CSV files for users migrating from paper records
**Depends on**: Phase 5 (Fillup model must exist)
**Research**: Unlikely (standard file parsing)
**Plans**: TBD

Plans:
- [ ] 08-01: CSV import API with validation and bulk create
- [ ] 08-02: CSV import UI with preview and vehicle selection

**Context:**
Users have handwritten fuel records (paper logs, receipts) that can be converted to CSV via external AI tools (scanning PDFs/images). This phase provides the import mechanism for that CSV data.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-01-13 |
| 2. Authentication | 3/3 | Complete | 2026-01-13 |
| 3. Family Groups | 3/3 | Complete | 2026-01-13 |
| 4. Vehicle Management | 3/3 | Complete | 2026-01-13 |
| 5. Fillup Entry | 3/3 | Complete | 2026-01-13 |
| 6. History & Analytics | 3/3 | Complete | 2026-01-13 |
| 7. PWA Polish | 3/3 | Complete | 2026-01-14 |
| 8. CSV Import | 0/2 | Not started | - |
