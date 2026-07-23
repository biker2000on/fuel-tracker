import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'

const { auth } = NextAuth(authConfig)

export default auth

export const config = {
  matcher: [
    // Match all routes except static files, API auth routes, and the
    // token-authenticated external API (does its own auth)
    '/((?!api/auth|api/v1|_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|sw.js|icons|screenshots).*)',
  ],
}

