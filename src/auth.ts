import NextAuth from 'next-auth'
import type { Provider } from 'next-auth/providers'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { authConfig } from '@/auth.config'
import {
  OIDC_PROVIDER_ID,
  OIDC_LINK_COOKIE,
  isOidcConfigured,
  getOidcProviderName,
  getOidcIssuer,
  verifyLinkToken,
  resolveOidcSignIn,
  type OidcClaims,
  type OidcUserCandidate,
} from '@/lib/oidc'

interface OidcProfile {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  preferred_username?: string
}

const USER_CANDIDATE_SELECT = {
  id: true,
  email: true,
  oidcSubject: true,
  oidcIssuer: true,
  passwordHash: true,
} as const

type DbCandidate = {
  id: string
  email: string
  oidcSubject: string | null
  oidcIssuer: string | null
  passwordHash: string | null
}

function toCandidate(user: DbCandidate | null): OidcUserCandidate | null {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    oidcSubject: user.oidcSubject,
    oidcIssuer: user.oidcIssuer,
    hasPassword: Boolean(user.passwordHash),
  }
}

const providers: Provider[] = [
  Credentials({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null
      }

      const email = credentials.email as string
      const password = credentials.password as string

      const user = await prisma.user.findUnique({
        where: { email },
      })

      if (!user || !user.passwordHash) {
        return null
      }

      const passwordMatch = await bcrypt.compare(password, user.passwordHash)

      if (!passwordMatch) {
        return null
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    },
  }),
]

if (isOidcConfigured()) {
  providers.push({
    id: OIDC_PROVIDER_ID,
    name: getOidcProviderName(),
    type: 'oidc',
    issuer: process.env.OIDC_ISSUER,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    checks: ['pkce', 'state'],
    profile(profile: OidcProfile) {
      return {
        id: profile.sub,
        email: profile.email ?? null,
        name: profile.name ?? profile.preferred_username ?? null,
      }
    },
  })
}

function toClaims(profile: OidcProfile): OidcClaims {
  return {
    sub: profile.sub,
    issuer: getOidcIssuer(),
    email: profile.email,
    emailVerified: profile.email_verified === true,
    name: profile.name ?? profile.preferred_username,
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== OIDC_PROVIDER_ID) {
        return true
      }
      if (!profile?.sub) {
        return false
      }

      const claims = toClaims(profile as unknown as OidcProfile)

      // Link mode: a logged-in user set a short-lived signed cookie before
      // starting the flow, asking to attach this identity to their account.
      let linkUserId: string | null = null
      try {
        const cookieStore = await cookies()
        linkUserId = verifyLinkToken(cookieStore.get(OIDC_LINK_COOKIE)?.value)
      } catch {
        linkUserId = null
      }

      const userBySubject = toCandidate(
        await prisma.user.findFirst({
          where: { oidcIssuer: claims.issuer, oidcSubject: claims.sub },
          select: USER_CANDIDATE_SELECT,
        })
      )

      const userByEmail = claims.email
        ? toCandidate(
            await prisma.user.findUnique({
              where: { email: claims.email },
              select: USER_CANDIDATE_SELECT,
            })
          )
        : null

      const linkUser = linkUserId
        ? toCandidate(
            await prisma.user.findUnique({
              where: { id: linkUserId },
              select: USER_CANDIDATE_SELECT,
            })
          )
        : null

      const result = resolveOidcSignIn({ claims, userBySubject, userByEmail, linkUser })

      // The link cookie is single-use; clear it regardless of outcome.
      if (linkUserId) {
        try {
          const cookieStore = await cookies()
          cookieStore.delete(OIDC_LINK_COOKIE)
        } catch {
          // Cookie mutation may be unavailable in some contexts; it expires on its own.
        }
      }

      switch (result.action) {
        case 'login':
        case 'link-already':
          return true

        case 'link':
        case 'auto-link':
          await prisma.user.update({
            where: { id: result.userId },
            data: {
              oidcSubject: claims.sub,
              oidcIssuer: claims.issuer,
              ...(claims.name ? { name: claims.name } : {}),
            },
          })
          return true

        case 'create':
          await prisma.user.create({
            data: {
              email: result.email,
              passwordHash: null,
              oidcSubject: claims.sub,
              oidcIssuer: claims.issuer,
              name: claims.name ?? null,
            },
          })
          return true

        case 'deny':
          console.warn(`OIDC sign-in denied for sub=${claims.sub}: ${result.reason}`)
          return false
      }
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === OIDC_PROVIDER_ID && profile?.sub) {
        // Map the OIDC identity to the local user resolved in signIn.
        const dbUser = await prisma.user.findFirst({
          where: { oidcIssuer: getOidcIssuer(), oidcSubject: profile.sub },
          select: { id: true, email: true, name: true },
        })
        if (dbUser) {
          token.id = dbUser.id
          token.email = dbUser.email
          token.name = dbUser.name
        }
        return token
      }
      if (user) {
        token.id = user.id
      }
      return token
    },
  },
})
