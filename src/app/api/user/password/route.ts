import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

interface PasswordChangeBody {
  currentPassword: string
  newPassword: string
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  let body: PasswordChangeBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    )
  }

  // Validate required fields
  if (!body.currentPassword || !body.newPassword) {
    return NextResponse.json(
      { error: 'Current password and new password are required' },
      { status: 400 }
    )
  }

  // Validate new password length (same as registration: 8+ chars)
  if (body.newPassword.length < 8) {
    return NextResponse.json(
      { error: 'New password must be at least 8 characters' },
      { status: 400 }
    )
  }

  // Get user from database to verify current password
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true }
  })

  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    )
  }

  // Verify current password
  const passwordMatch = await bcrypt.compare(body.currentPassword, user.passwordHash)

  if (!passwordMatch) {
    return NextResponse.json(
      { error: 'Current password is incorrect' },
      { status: 400 }
    )
  }

  // Hash new password with 10 salt rounds (same as registration)
  const newPasswordHash = await bcrypt.hash(body.newPassword, 10)

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newPasswordHash }
    })

    return NextResponse.json({ message: 'Password updated successfully' })
  } catch (error) {
    console.error('Error updating password:', error)
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    )
  }
}
