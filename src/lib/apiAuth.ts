/**
 * Bearer-token authentication for the read-only external API (/api/v1).
 *
 * Tokens look like "ft_<hex>" and are stored as sha256 hashes; users create
 * and revoke them from the profile page. These routes never use the browser
 * session - external consumers (e.g. gnucash-web) authenticate with
 * "Authorization: Bearer ft_..." (or "X-API-Key: ft_...").
 */

import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/db'

export const API_TOKEN_PREFIX = 'ft_'

/** Generate a new plaintext token. Shown to the user exactly once. */
export function generateApiToken(): string {
  return `${API_TOKEN_PREFIX}${randomBytes(24).toString('hex')}`
}

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface ApiAuthResult {
  userId: string
  tokenId: string
}

/**
 * Authenticate a request against the ApiToken table.
 * Returns null when no valid token is presented.
 */
export async function authenticateApiRequest(request: Request): Promise<ApiAuthResult | null> {
  const authHeader = request.headers.get('authorization')
  let token: string | null = null

  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim()
  } else {
    token = request.headers.get('x-api-key')?.trim() ?? null
  }

  if (!token || !token.startsWith(API_TOKEN_PREFIX)) {
    return null
  }

  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash: hashApiToken(token) },
    select: { id: true, userId: true },
  })

  if (!apiToken) {
    return null
  }

  // Best-effort usage timestamp; failures must not break the request.
  prisma.apiToken
    .update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  return { userId: apiToken.userId, tokenId: apiToken.id }
}

/** Group-scoped vehicle ids visible to a user (same visibility as the UI). */
export async function getVisibleVehicleIds(userId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { groupId: true },
  })
  if (memberships.length === 0) return []

  const vehicles = await prisma.vehicle.findMany({
    where: { groupId: { in: memberships.map((m) => m.groupId) } },
    select: { id: true },
  })
  return vehicles.map((v) => v.id)
}
