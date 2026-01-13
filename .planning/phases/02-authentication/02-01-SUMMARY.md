# Plan 02-01 Summary: Auth.js Setup and User Model

## Status: COMPLETE

**Started:** 2026-01-13
**Completed:** 2026-01-13

## Tasks Completed

### Task 1: Install and configure Auth.js v5 with credentials provider
- Installed `next-auth@beta`, `bcrypt`, and `@types/bcrypt` dependencies
- Created `src/auth.ts` with Auth.js v5 configuration:
  - CredentialsProvider for email/password authentication
  - JWT session strategy with 30-day maxAge
  - Callbacks for jwt and session to include user ID
  - Custom signIn page pointing to `/login`
- Created `src/app/api/auth/[...nextauth]/route.ts` exporting GET and POST handlers
- Created `src/types/next-auth.d.ts` for TypeScript session type extension
- Updated `.env.example` with AUTH_SECRET template
- **Commit:** `754a0f6` - feat(02-01): install and configure auth.js v5 with credentials provider

### Task 2: Extend User model with passwordHash for credential auth
- Added `passwordHash` field to User model in `prisma/schema.prisma`
- Field is required String type for storing bcrypt hashes
- Regenerated Prisma client types with `npx prisma generate`
- **Commit:** `084bc90` - feat(02-01): extend user model with passwordHash for credential auth

## Files Created/Modified

### Created
- `src/auth.ts` - Auth.js configuration with CredentialsProvider
- `src/app/api/auth/[...nextauth]/route.ts` - API route handler
- `src/types/next-auth.d.ts` - TypeScript type declarations for session extension

### Modified
- `package.json` - Added next-auth, bcrypt, @types/bcrypt dependencies
- `package-lock.json` - Updated lock file
- `.env.example` - Added AUTH_SECRET template
- `prisma/schema.prisma` - Added passwordHash field to User model

## Verification Results

- [x] `npm run build` succeeds without errors
- [x] `npx prisma validate` passes
- [x] Auth.js config exports NextAuth handlers
- [x] AUTH_SECRET in .env and .env.example
- [x] No TypeScript errors
- [x] User type includes passwordHash field

## Technical Notes

- Using Auth.js v5 (next-auth@5.0.0-beta.30)
- JWT session strategy (no database sessions) - simpler for self-hosted deployment
- CredentialsProvider queries User directly via Prisma client
- No @auth/prisma-adapter needed since we're not storing sessions in database
- bcrypt for password hashing (will be used in registration flow in 02-02)
- Prisma client at `@/generated/prisma/client` (from Phase 1)

## Dependencies for Future Plans

- **02-02** (Registration/Login): Will implement actual registration form that uses bcrypt to hash passwords and stores in User.passwordHash
- **02-03** (Protected Routes): Will use the `auth()` function exported from src/auth.ts

## Deviations

None. Implementation followed the plan exactly.

## Next Plan

02-02: Registration and login flows
