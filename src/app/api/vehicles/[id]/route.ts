import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

const VALID_FUEL_TYPES = ['regular', 'premium', 'diesel', 'e85']

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id } = await context.params

  // Get vehicle with group info
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      group: { select: { name: true } }
    }
  })

  if (!vehicle) {
    return NextResponse.json(
      { error: 'Vehicle not found' },
      { status: 404 }
    )
  }

  // Verify user is member of the vehicle's group
  const membership = await prisma.membership.findUnique({
    where: {
      userId_groupId: {
        userId: session.user.id,
        groupId: vehicle.groupId
      }
    }
  })

  if (!membership) {
    return NextResponse.json(
      { error: 'You are not a member of this vehicle\'s group' },
      { status: 403 }
    )
  }

  return NextResponse.json({
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
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id } = await context.params

  let body: {
    name?: string
    year?: number
    make?: string
    model?: string
    tankSize?: number | null
    fuelType?: string
    photoUrl?: string | null
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    )
  }

  // Get vehicle to verify it exists
  const vehicle = await prisma.vehicle.findUnique({
    where: { id }
  })

  if (!vehicle) {
    return NextResponse.json(
      { error: 'Vehicle not found' },
      { status: 404 }
    )
  }

  // Verify user is member of the vehicle's group
  const membership = await prisma.membership.findUnique({
    where: {
      userId_groupId: {
        userId: session.user.id,
        groupId: vehicle.groupId
      }
    }
  })

  if (!membership) {
    return NextResponse.json(
      { error: 'You are not a member of this vehicle\'s group' },
      { status: 403 }
    )
  }

  // Build update data with validation
  const updateData: {
    name?: string
    year?: number
    make?: string
    model?: string
    tankSize?: number | null
    fuelType?: string
    photoUrl?: string | null
  } = {}

  // Validate and add fields if provided
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
    if (name.length > 50) {
      return NextResponse.json(
        { error: 'Name must be 50 characters or less' },
        { status: 400 }
      )
    }
    updateData.name = name
  }

  if (body.year !== undefined) {
    if (typeof body.year !== 'number') {
      return NextResponse.json(
        { error: 'Year must be a number' },
        { status: 400 }
      )
    }
    if (!Number.isInteger(body.year) || body.year < 1900 || body.year > 2100) {
      return NextResponse.json(
        { error: 'Year must be an integer between 1900 and 2100' },
        { status: 400 }
      )
    }
    updateData.year = body.year
  }

  if (body.make !== undefined) {
    if (typeof body.make !== 'string') {
      return NextResponse.json(
        { error: 'Make must be a string' },
        { status: 400 }
      )
    }
    const make = body.make.trim()
    if (make.length === 0) {
      return NextResponse.json(
        { error: 'Make cannot be empty' },
        { status: 400 }
      )
    }
    if (make.length > 50) {
      return NextResponse.json(
        { error: 'Make must be 50 characters or less' },
        { status: 400 }
      )
    }
    updateData.make = make
  }

  if (body.model !== undefined) {
    if (typeof body.model !== 'string') {
      return NextResponse.json(
        { error: 'Model must be a string' },
        { status: 400 }
      )
    }
    const model = body.model.trim()
    if (model.length === 0) {
      return NextResponse.json(
        { error: 'Model cannot be empty' },
        { status: 400 }
      )
    }
    if (model.length > 50) {
      return NextResponse.json(
        { error: 'Model must be 50 characters or less' },
        { status: 400 }
      )
    }
    updateData.model = model
  }

  if (body.tankSize !== undefined) {
    if (body.tankSize !== null && (typeof body.tankSize !== 'number' || body.tankSize <= 0)) {
      return NextResponse.json(
        { error: 'Tank size must be a positive number or null' },
        { status: 400 }
      )
    }
    updateData.tankSize = body.tankSize
  }

  if (body.fuelType !== undefined) {
    if (!VALID_FUEL_TYPES.includes(body.fuelType)) {
      return NextResponse.json(
        { error: `Fuel type must be one of: ${VALID_FUEL_TYPES.join(', ')}` },
        { status: 400 }
      )
    }
    updateData.fuelType = body.fuelType
  }

  if (body.photoUrl !== undefined) {
    if (body.photoUrl !== null && typeof body.photoUrl !== 'string') {
      return NextResponse.json(
        { error: 'Photo URL must be a string or null' },
        { status: 400 }
      )
    }
    updateData.photoUrl = body.photoUrl
  }

  // Check if there's anything to update
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update' },
      { status: 400 }
    )
  }

  try {
    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: updateData,
      include: {
        group: { select: { name: true } }
      }
    })

    return NextResponse.json({
      id: updatedVehicle.id,
      name: updatedVehicle.name,
      year: updatedVehicle.year,
      make: updatedVehicle.make,
      model: updatedVehicle.model,
      tankSize: updatedVehicle.tankSize,
      fuelType: updatedVehicle.fuelType,
      photoUrl: updatedVehicle.photoUrl,
      groupId: updatedVehicle.groupId,
      groupName: updatedVehicle.group.name,
      createdAt: updatedVehicle.createdAt.toISOString(),
      updatedAt: updatedVehicle.updatedAt.toISOString()
    })
  } catch (error) {
    console.error('Error updating vehicle:', error)
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id } = await context.params

  // Get vehicle to verify it exists
  const vehicle = await prisma.vehicle.findUnique({
    where: { id }
  })

  if (!vehicle) {
    return NextResponse.json(
      { error: 'Vehicle not found' },
      { status: 404 }
    )
  }

  // Verify user is member of the vehicle's group
  const membership = await prisma.membership.findUnique({
    where: {
      userId_groupId: {
        userId: session.user.id,
        groupId: vehicle.groupId
      }
    }
  })

  if (!membership) {
    return NextResponse.json(
      { error: 'You are not a member of this vehicle\'s group' },
      { status: 403 }
    )
  }

  try {
    await prisma.vehicle.delete({
      where: { id }
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting vehicle:', error)
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    )
  }
}
