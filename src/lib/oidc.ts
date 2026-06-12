/**
 * OIDC (PocketID / generic OpenID Connect) integration helpers.
 *
 * SSO is entirely disabled unless OIDC_ISSUER, OIDC_CLIENT_ID and
 * OIDC_CLIENT_SECRET are set. The provider is registered with NextAuth in
 * src/auth.ts; account resolution (login / auto-link / link mode / create)
 * lives in resolveOidcSignIn below so it is testable without NextAuth.
 */

import { createHmac, timingSafeEqual } from 'crypto'

export const OIDC_PROVIDER_ID = 'pocketid'
export const OIDC_LINK_COOKIE = 'fuel-tracker-oidc-link'
export const OIDC_LINK_TTL_SECONDS = 600 // 10 minutes to complete the flow

/** True when all required OIDC env vars are present. */
export function isOidcConfigured(): boolean {
  return Boolean(
    process.env.OIDC_ISSUER &&
    process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_CLIENT_SECRET
  )
}

/** Display name for the provider button ("Sign in with {name}"). */
export function getOidcProviderName(): string {
  return process.env.OIDC_PROVIDER_NAME || 'PocketID'
}

export function getOidcIssuer(): string {
  return process.env.OIDC_ISSUER || ''
}

// ---------------------------------------------------------------------------
// Link-mode cookie: a short-lived HMAC-signed token carrying the userId of the
// already-logged-in user who wants to attach an OIDC identity to their account.
// ---------------------------------------------------------------------------

function linkSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return secret
}

function signLinkPayload(payload: string): string {
  return createHmac('sha256', linkSecret()).update(payload).digest('base64url')
}

/** Create the signed link-cookie value for a user. */
export function createLinkToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + OIDC_LINK_TTL_SECONDS
  const payload = `${userId}.${exp}`
  return `${payload}.${signLinkPayload(payload)}`
}

/** Verify a link-cookie value; returns the userId or null. */
export function verifyLinkToken(token: string | undefined): string | null {
  if (!token) return null
  const lastDot = token.lastIndexOf('.')
  if (lastDot <= 0) return null
  const payload = token.slice(0, lastDot)
  const sig = token.slice(lastDot + 1)
  const expected = signLinkPayload(payload)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  const [userId, expStr] = payload.split('.')
  const exp = parseInt(expStr, 10)
  if (!userId || isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return null
  return userId
}

// ---------------------------------------------------------------------------
// Pure account-resolution logic (mirrors the gnucash-web rules, adapted to
// email-keyed accounts).
// ---------------------------------------------------------------------------

export interface OidcClaims {
  sub: string
  issuer: string
  email?: string
  /** Only `true` counts as verified; absent/false emails are never auto-linked. */
  emailVerified?: boolean
  name?: string
}

export interface OidcUserCandidate {
  id: string
  email: string
  oidcSubject: string | null
  oidcIssuer: string | null
  hasPassword: boolean
}

export interface ResolveOidcInput {
  claims: OidcClaims
  /** User whose (oidcIssuer, oidcSubject) matches the claims, if any. */
  userBySubject: OidcUserCandidate | null
  /** User whose email matches the OIDC email, if any. */
  userByEmail: OidcUserCandidate | null
  /** Link mode: the logged-in user requesting to attach this identity. */
  linkUser?: OidcUserCandidate | null
}

export type ResolveOidcAction =
  | { action: 'login'; userId: string }
  | { action: 'auto-link'; userId: string }
  | { action: 'link'; userId: string }
  | { action: 'link-already'; userId: string }
  | { action: 'deny'; reason: string }
  | { action: 'create'; email: string }

export function hasVerifiedEmail(claims: OidcClaims): boolean {
  return Boolean(claims.email) && claims.emailVerified === true
}

export function resolveOidcSignIn(input: ResolveOidcInput): ResolveOidcAction {
  const { claims, userBySubject, userByEmail, linkUser } = input

  // ---- Link mode: attach this identity to the logged-in user ----
  if (linkUser) {
    if (userBySubject) {
      if (userBySubject.id === linkUser.id) {
        return { action: 'link-already', userId: linkUser.id }
      }
      return { action: 'deny', reason: 'This identity is already linked to another account' }
    }
    if (linkUser.oidcSubject && linkUser.oidcSubject !== claims.sub) {
      return { action: 'deny', reason: 'Your account is already linked to a different identity' }
    }
    return { action: 'link', userId: linkUser.id }
  }

  // ---- Existing user with matching (issuer, subject): log in ----
  if (userBySubject) {
    return { action: 'login', userId: userBySubject.id }
  }

  // ---- Migration path: verified email matches an existing account ----
  if (hasVerifiedEmail(claims) && userByEmail) {
    if (userByEmail.oidcSubject) {
      // The email owner is bound to a *different* OIDC identity; emails are
      // unique so we cannot create a new account either. Refuse the login.
      return { action: 'deny', reason: 'This email is already linked to a different identity' }
    }
    return { action: 'auto-link', userId: userByEmail.id }
  }

  // ---- New user: requires a verified email (email is the account key) ----
  if (!hasVerifiedEmail(claims)) {
    return { action: 'deny', reason: 'Your identity provider did not supply a verified email' }
  }
  if (userByEmail) {
    // Unverified-email duplicate guard is handled above; this covers the
    // race where the email exists but was not matched as verified.
    return { action: 'deny', reason: 'An account with this email already exists' }
  }
  return { action: 'create', email: claims.email! }
}

/**
 * Guard for unlinking: a user may only remove their OIDC identity when a
 * password remains, otherwise they would be locked out.
 */
export function canUnlinkOidc(user: { hasPassword: boolean; oidcSubject: string | null }):
  | { ok: true }
  | { ok: false; reason: string } {
  if (!user.oidcSubject) {
    return { ok: false, reason: 'No identity provider is linked to this account' }
  }
  if (!user.hasPassword) {
    return { ok: false, reason: 'Set a password before unlinking, or you would be locked out' }
  }
  return { ok: true }
}
