import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { canUnlinkOidc } from '@/lib/oidc'

/**
 * POST /api/auth/oidc/unlink
 *
 * Removes the OIDC identity from the current user's account.
 * Refused when the user has no password (it would lock them out).
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true, oidcSubject: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const guard = canUnlinkOidc({
    hasPassword: Boolean(user.passwordHash),
    oidcSubject: user.oidcSubject,
  })
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { oidcSubject: null, oidcIssuer: null },
  })

  return NextResponse.json({ success: true })
}
