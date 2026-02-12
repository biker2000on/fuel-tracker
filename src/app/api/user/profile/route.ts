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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      defaultThousandths: true,
      createdAt: true
    }
  })

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    defaultThousandths: user.defaultThousandths,
    createdAt: user.createdAt.toISOString()
  })
}

export async function PATCH(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  let body: { name?: string; defaultThousandths?: number }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    )
  }

  const updateData: { name?: string; defaultThousandths?: number } = {}

  // Validate name if provided
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Name must be a string' },
        { status: 400 }
      )
    }

    const name = body.name.trim()

    if (name.length === 0) {
      return NextResponse.json(
        { error: 'Name cannot be empty' },
        { status: 400 }
      )
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Name must be 100 characters or less' },
        { status: 400 }
      )
    }

    updateData.name = name
  }

  // Validate defaultThousandths if provided
  if (body.defaultThousandths !== undefined) {
    if (typeof body.defaultThousandths !== 'number') {
      return NextResponse.json(
        { error: 'defaultThousandths must be a number' },
        { status: 400 }
      )
    }
    if (body.defaultThousandths < 0 || body.defaultThousandths > 0.009) {
      return NextResponse.json(
        { error: 'defaultThousandths must be between 0 and 0.009' },
        { status: 400 }
      )
    }
    // Round to 3 decimal places to avoid floating point issues
    updateData.defaultThousandths = Math.round(body.defaultThousandths * 1000) / 1000
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update' },
      { status: 400 }
    )
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        defaultThousandths: true,
        updatedAt: true
      }
    })

    // Retroactive adjustment of historical fillups
    let adjustedFillups = 0

    if (updateData.defaultThousandths !== undefined && updateData.defaultThousandths > 0) {
      const newThousandths = updateData.defaultThousandths

      // Get all fillups by this user
      const fillups = await prisma.fillup.findMany({
        where: { userId: session.user.id },
        select: { id: true, pricePerGallon: true, gallons: true }
      })

      // Filter to round-cent prices (no thousandths already applied)
      const updates = fillups
        .filter(f => Math.round(f.pricePerGallon * 100) / 100 === f.pricePerGallon)
        .map(f => {
          const newPrice = Math.round((f.pricePerGallon + newThousandths) * 1000) / 1000
          const newTotalCost = Math.round(f.gallons * newPrice * 100) / 100
          return prisma.fillup.update({
            where: { id: f.id },
            data: { pricePerGallon: newPrice, totalCost: newTotalCost }
          })
        })

      // Execute all updates in a transaction for atomicity
      if (updates.length > 0) {
        await prisma.$transaction(updates)
        adjustedFillups = updates.length
      }
    }

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      defaultThousandths: updatedUser.defaultThousandths,
      updatedAt: updatedUser.updatedAt.toISOString(),
      adjustedFillups
    })
  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    )
  }
}
