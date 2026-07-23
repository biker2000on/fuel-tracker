import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

interface RouteContext {
  params: Promise<{ id: string }>
}

/** DELETE /api/user/tokens/[id] - revoke one of the current user's tokens. */
export async function DELETE(request: Request, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

  const token = await prisma.apiToken.findUnique({
    where: { id },
    select: { id: true, userId: true },
  })

  if (!token || token.userId !== session.user.id) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  }

  await prisma.apiToken.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
