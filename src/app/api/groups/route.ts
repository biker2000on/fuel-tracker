import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: {
      group: {
        include: {
          _count: { select: { members: true } }
        }
      }
    }
  })

  const groups = memberships.map((membership) => ({
    id: membership.group.id,
    name: membership.group.name,
    role: membership.role,
    memberCount: membership.group._count.members,
    joinedAt: membership.joinedAt.toISOString()
  }))

  return NextResponse.json({ groups })
}
