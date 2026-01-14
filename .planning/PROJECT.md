# Fuel Tracker

## What This Is

A Progressive Web App for tracking fuel consumption across multiple vehicles. Mobile-first design with location auto-detection for logging fillups quickly at the pump. Supports multi-user access with family groups for sharing cars between household members.

## Core Value

Quick fillup entry — fast, frictionless logging from the phone at the pump. If the entry flow has friction, the app fails.

## Requirements

### Validated

- ✓ User authentication with account creation and login — v1.0
- ✓ Family groups for sharing cars between users — v1.0
- ✓ Vehicle profiles with year/make/model, photo, tank size, fuel type — v1.0
- ✓ Fillup entry: date, gallons, price, odometer, MPG calculation, full/partial, notes — v1.0
- ✓ Auto-detect location (city, state, country) via GPS and reverse geocoding — v1.0
- ✓ PWA with offline capability and mobile-optimized UI — v1.0
- ✓ Per-vehicle fillup history and fuel economy tracking — v1.0
- ✓ Dashboard showing recent fillups and MPG trends — v1.0
- ✓ CSV import for historical fillup records — v1.0

### Active

(None — all v1.0 requirements shipped)

### Out of Scope

- Social features — no sharing stats publicly, no leaderboards, no comparing with other users
- Cost projections — no budget forecasting, price alerts, or cheapest station finder
- Maintenance tracking — no oil changes, tire rotations, or service reminders (potential future milestone)

## Context

**Current state:** v1.0 MVP shipped with ~19,800 LOC TypeScript.

**Tech stack:**
- Next.js 16 with App Router
- Prisma 7 with PostgreSQL
- Auth.js v5 (NextAuth)
- Tailwind CSS 4
- Serwist for PWA/service worker

**Deployment:** Docker container with docker-compose, images on GHCR.

## Constraints

- **Tech stack**: Next.js with App Router, Prisma ORM, PostgreSQL
- **Deployment**: Self-hosted Docker container
- **Auth**: Multi-user with family group sharing
- **Platform**: PWA, mobile-first but functional on desktop
- **Location**: Browser Geolocation API + OpenStreetMap Nominatim for reverse geocoding

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js + Prisma + PostgreSQL | User preference, proven stack for full-stack apps | ✓ Good |
| Self-hosted Docker | User infrastructure preference | ✓ Good |
| Family groups over simple multi-user | Enables car sharing between household members | ✓ Good |
| PWA over native app | Cross-platform, installable, no app store overhead | ✓ Good |
| Auth.js v5 with Edge-compatible config | Prisma not available in Edge runtime, separate config needed | ✓ Good |
| Prisma 7.x with driver adapters | Required for PostgreSQL connection in newer Prisma | ✓ Good |
| Serwist for service worker | Modern fork of next-pwa, better maintained | ✓ Good |
| OpenStreetMap Nominatim | Free, no API key required for reverse geocoding | ✓ Good |
| IndexedDB for offline queue | Reliable offline storage for pending fillups | ✓ Good |

---
*Last updated: 2026-01-14 after v1.0 milestone*
