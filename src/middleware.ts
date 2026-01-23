import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'

const { auth } = NextAuth(authConfig)

export default auth

export const config = {
  matcher: [
    // Match all routes except static files and API auth routes
    '/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|sw.js|icons|screenshots).*)',
  ],
}

