import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { generateInviteCode } from '@/lib/utils'

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
    joinedAt: membership.joinedAt.toISOString(),
    // Include invite code only for owners
    ...(membership.role === 'owner' && { inviteCode: membership.group.inviteCode })
  }))

  return NextResponse.json({ groups })
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    )
  }

  // Validate name
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json(
      { error: 'Name is required' },
      { status: 400 }
    )
  }

  const name = body.name.trim()
  if (name.length === 0) {
    return NextResponse.json(
      { error: 'Name is required' },
      { status: 400 }
    )
  }

  if (name.length > 50) {
    return NextResponse.json(
      { error: 'Name must be 50 characters or less' },
      { status: 400 }
    )
  }

  try {
    // Generate unique invite code with retry on collision
    let inviteCode = generateInviteCode()
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      const existing = await prisma.group.findUnique({
        where: { inviteCode }
      })
      if (!existing) break
      inviteCode = generateInviteCode()
      attempts++
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique invite code' },
        { status: 500 }
      )
    }

    // Create group and membership in transaction
    const group = await prisma.$transaction(async (tx) => {
      const newGroup = await tx.group.create({
        data: {
          name,
          inviteCode,
        }
      })
      await tx.membership.create({
        data: {
          userId: session.user!.id!,
          groupId: newGroup.id,
          role: 'owner'
        }
      })
      return newGroup
    })

    return NextResponse.json(
      {
        id: group.id,
        name: group.name,
        inviteCode: group.inviteCode,
        createdAt: group.createdAt.toISOString()
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating group:', error)
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    )
  }
}
