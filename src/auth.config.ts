import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAuthPage = nextUrl.pathname.startsWith('/login') ||
                         nextUrl.pathname.startsWith('/register')

      if (isAuthPage) {
        // Redirect logged-in users away from auth pages
        if (isLoggedIn) return Response.redirect(new URL('/', nextUrl))
        return true
      }

      // Require login for other pages
      return isLoggedIn
    },
  },
  pages: {
    signIn: '/login',
  },
  providers: [], // Providers added in auth.ts
} satisfies NextAuthConfig
