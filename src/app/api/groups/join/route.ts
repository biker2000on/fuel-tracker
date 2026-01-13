import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  let body: { inviteCode?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    )
  }

  // Validate inviteCode
  if (!body.inviteCode || typeof body.inviteCode !== 'string') {
    return NextResponse.json(
      { error: 'Invite code is required' },
      { status: 400 }
    )
  }

  // Normalize to uppercase and validate format
  const inviteCode = body.inviteCode.trim().toUpperCase()

  // Validate: 8 chars, uppercase alphanumeric (matching generateInviteCode charset)
  const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/
  if (!validChars.test(inviteCode)) {
    return NextResponse.json(
      { error: 'Invalid invite code format' },
      { status: 400 }
    )
  }

  try {
    // Find group by invite code
    const group = await prisma.group.findUnique({
      where: { inviteCode },
      include: {
        _count: { select: { members: true } }
      }
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 404 }
      )
    }

    // Check if user is already a member
    const existing = await prisma.membership.findUnique({
      where: {
        userId_groupId: {
          userId: session.user.id,
          groupId: group.id
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Already a member of this group' },
        { status: 409 }
      )
    }

    // Create membership
    await prisma.membership.create({
      data: {
        userId: session.user.id,
        groupId: group.id,
        role: 'member'
      }
    })

    return NextResponse.json(
      {
        id: group.id,
        name: group.name,
        role: 'member',
        memberCount: group._count.members + 1
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error joining group:', error)
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    )
  }
}
