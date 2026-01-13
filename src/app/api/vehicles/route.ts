import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

const VALID_FUEL_TYPES = ['regular', 'premium', 'diesel', 'e85']

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Get all groups user is a member of
  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    select: { groupId: true }
  })

  if (memberships.length === 0) {
    return NextResponse.json({ vehicles: [] })
  }

  const groupIds = memberships.map((m) => m.groupId)

  // Get all vehicles for those groups
  const vehicles = await prisma.vehicle.findMany({
    where: { groupId: { in: groupIds } },
    include: {
      group: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  const vehiclesWithGroup = vehicles.map((vehicle) => ({
    id: vehicle.id,
    name: vehicle.name,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    tankSize: vehicle.tankSize,
    fuelType: vehicle.fuelType,
    photoUrl: vehicle.photoUrl,
    groupId: vehicle.groupId,
    groupName: vehicle.group.name,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString()
  }))

  return NextResponse.json({ vehicles: vehiclesWithGroup })
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  let body: {
    name?: string
    year?: number
    make?: string
    model?: string
    groupId?: string
    tankSize?: number
    fuelType?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    )
  }

  // Validate required fields
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

  if (!body.year || typeof body.year !== 'number') {
    return NextResponse.json(
      { error: 'Year is required and must be a number' },
      { status: 400 }
    )
  }

  if (!Number.isInteger(body.year) || body.year < 1900 || body.year > 2100) {
    return NextResponse.json(
      { error: 'Year must be an integer between 1900 and 2100' },
      { status: 400 }
    )
  }

  if (!body.make || typeof body.make !== 'string') {
    return NextResponse.json(
      { error: 'Make is required' },
      { status: 400 }
    )
  }

  const make = body.make.trim()
  if (make.length === 0) {
    return NextResponse.json(
      { error: 'Make is required' },
      { status: 400 }
    )
  }

  if (make.length > 50) {
    return NextResponse.json(
      { error: 'Make must be 50 characters or less' },
      { status: 400 }
    )
  }

  if (!body.model || typeof body.model !== 'string') {
    return NextResponse.json(
      { error: 'Model is required' },
      { status: 400 }
    )
  }

  const model = body.model.trim()
  if (model.length === 0) {
    return NextResponse.json(
      { error: 'Model is required' },
      { status: 400 }
    )
  }

  if (model.length > 50) {
    return NextResponse.json(
      { error: 'Model must be 50 characters or less' },
      { status: 400 }
    )
  }

  if (!body.groupId || typeof body.groupId !== 'string') {
    return NextResponse.json(
      { error: 'Group ID is required' },
      { status: 400 }
    )
  }

  // Validate tankSize if provided
  if (body.tankSize !== undefined && body.tankSize !== null) {
    if (typeof body.tankSize !== 'number' || body.tankSize <= 0) {
      return NextResponse.json(
        { error: 'Tank size must be a positive number' },
        { status: 400 }
      )
    }
  }

  // Validate fuelType if provided
  const fuelType = body.fuelType || 'regular'
  if (!VALID_FUEL_TYPES.includes(fuelType)) {
    return NextResponse.json(
      { error: `Fuel type must be one of: ${VALID_FUEL_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  // Verify user is member of the group
  const membership = await prisma.membership.findUnique({
    where: {
      userId_groupId: {
        userId: session.user.id,
        groupId: body.groupId
      }
    }
  })

  if (!membership) {
    return NextResponse.json(
      { error: 'You are not a member of this group' },
      { status: 403 }
    )
  }

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        name,
        year: body.year,
        make,
        model,
        tankSize: body.tankSize ?? null,
        fuelType,
        groupId: body.groupId
      },
      include: {
        group: { select: { name: true } }
      }
    })

    return NextResponse.json(
      {
        id: vehicle.id,
        name: vehicle.name,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        tankSize: vehicle.tankSize,
        fuelType: vehicle.fuelType,
        photoUrl: vehicle.photoUrl,
        groupId: vehicle.groupId,
        groupName: vehicle.group.name,
        createdAt: vehicle.createdAt.toISOString(),
        updatedAt: vehicle.updatedAt.toISOString()
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating vehicle:', error)
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    )
  }
}
