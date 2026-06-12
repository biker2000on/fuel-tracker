import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  isOidcConfigured,
  createLinkToken,
  OIDC_LINK_COOKIE,
  OIDC_LINK_TTL_SECONDS,
} from '@/lib/oidc'

/**
 * POST /api/auth/oidc/link
 *
 * Arms account-linking mode: sets a short-lived signed cookie carrying the
 * logged-in user's id. The client then starts the normal OIDC sign-in flow;
 * the signIn callback sees the cookie and attaches the identity to this
 * account instead of resolving a new login.
 */
export async function POST() {
  if (!isOidcConfigured()) {
    return NextResponse.json({ error: 'OIDC is not configured' }, { status: 404 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(OIDC_LINK_COOKIE, createLinkToken(session.user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: OIDC_LINK_TTL_SECONDS,
    path: '/',
  })
  return response
}
