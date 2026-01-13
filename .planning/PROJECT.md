# Fuel Tracker

## What This Is

A Progressive Web App for tracking fuel consumption across multiple vehicles. Mobile-first design with location auto-detection for logging fillups quickly at the pump. Supports multi-user access with family groups for sharing cars between household members.

## Core Value

Quick fillup entry — fast, frictionless logging from the phone at the pump. If the entry flow has friction, the app fails.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User authentication with account creation and login
- [ ] Family groups for sharing cars between users
- [ ] Vehicle profiles with year/make/model, photo, tank size, fuel type
- [ ] Fillup entry: date, gallons, price, odometer, car's MPG estimate, full/partial, notes
- [ ] Auto-detect location (city, state, country) and GPS coordinates via device
- [ ] PWA with offline capability and mobile-optimized UI
- [ ] Per-vehicle fillup history and fuel economy tracking
- [ ] Dashboard showing recent fillups and MPG trends

### Out of Scope

- Social features — no sharing stats publicly, no leaderboards, no comparing with other users
- Cost projections — no budget forecasting, price alerts, or cheapest station finder
- Maintenance tracking — no oil changes, tire rotations, or service reminders (potential future milestone)

## Context

This is a personal/family tool for tracking fuel economy across multiple vehicles. The primary use case is standing at the gas pump and quickly logging the fillup before driving away. Location detection should minimize manual entry. Family members should be able to log fillups for shared household vehicles.

## Constraints

- **Tech stack**: Next.js with App Router, Prisma ORM, PostgreSQL
- **Deployment**: Self-hosted Docker container
- **Auth**: Multi-user with family group sharing
- **Platform**: PWA, mobile-first but functional on desktop
- **Location**: Browser Geolocation API for auto-detecting fillup location

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js + Prisma + PostgreSQL | User preference, proven stack for full-stack apps | — Pending |
| Self-hosted Docker | User infrastructure preference | — Pending |
| Family groups over simple multi-user | Enables car sharing between household members | — Pending |
| PWA over native app | Cross-platform, installable, no app store overhead | — Pending |

---
*Last updated: 2026-01-13 after initialization*
