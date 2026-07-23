import { NextResponse } from 'next/server'
import { authenticateApiRequest } from '@/lib/apiAuth'
import { prisma } from '@/lib/db'

/**
 * GET /api/v1/me
 *
 * Token verification endpoint: returns the user the token belongs to.
 * Useful as a connection test when linking external apps.
 */
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, name: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
  })
}
