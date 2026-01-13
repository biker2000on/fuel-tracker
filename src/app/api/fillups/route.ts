import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const vehicleId = searchParams.get('vehicleId')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : 50

  if (isNaN(limit) || limit < 1 || limit > 500) {
    return NextResponse.json(
      { error: 'Limit must be a number between 1 and 500' },
      { status: 400 }
    )
  }

  // Get all groups user is a member of
  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    select: { groupId: true }
  })

  if (memberships.length === 0) {
    return NextResponse.json({ fillups: [] })
  }

  const groupIds = memberships.map((m) => m.groupId)

  // Get vehicles for those groups
  const vehicles = await prisma.vehicle.findMany({
    where: { groupId: { in: groupIds } },
    select: { id: true, name: true }
  })

  if (vehicles.length === 0) {
    return NextResponse.json({ fillups: [] })
  }

  const vehicleIds = vehicles.map((v) => v.id)
  const vehicleNameMap = new Map(vehicles.map((v) => [v.id, v.name]))

  // Build where clause
  const whereClause: { vehicleId: { in: string[] } | string } = {
    vehicleId: { in: vehicleIds }
  }

  // Filter by specific vehicle if requested
  if (vehicleId) {
    if (!vehicleIds.includes(vehicleId)) {
      return NextResponse.json(
        { error: 'Vehicle not found or you do not have access' },
        { status: 404 }
      )
    }
    whereClause.vehicleId = vehicleId
  }

  const fillups = await prisma.fillup.findMany({
    where: whereClause,
    orderBy: { date: 'desc' },
    take: limit
  })

  const fillupsWithVehicleName = fillups.map((fillup) => ({
    id: fillup.id,
    date: fillup.date.toISOString(),
    gallons: fillup.gallons,
    pricePerGallon: fillup.pricePerGallon,
    totalCost: fillup.totalCost,
    odometer: fillup.odometer,
    mpg: fillup.mpg,
    isFull: fillup.isFull,
    notes: fillup.notes,
    latitude: fillup.latitude,
    longitude: fillup.longitude,
    city: fillup.city,
    state: fillup.state,
    country: fillup.country,
    vehicleId: fillup.vehicleId,
    vehicleName: vehicleNameMap.get(fillup.vehicleId) || null,
    userId: fillup.userId,
    createdAt: fillup.createdAt.toISOString(),
    updatedAt: fillup.updatedAt.toISOString()
  }))

  return NextResponse.json({ fillups: fillupsWithVehicleName })
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
    vehicleId?: string
    date?: string
    gallons?: number
    pricePerGallon?: number
    odometer?: number
    isFull?: boolean
    notes?: string
    latitude?: number
    longitude?: number
    city?: string
    state?: string
    country?: string
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
  if (!body.vehicleId || typeof body.vehicleId !== 'string') {
    return NextResponse.json(
      { error: 'Vehicle ID is required' },
      { status: 400 }
    )
  }

  if (!body.date || typeof body.date !== 'string') {
    return NextResponse.json(
      { error: 'Date is required' },
      { status: 400 }
    )
  }

  const parsedDate = new Date(body.date)
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json(
      { error: 'Date must be a valid ISO date string' },
      { status: 400 }
    )
  }

  if (typeof body.gallons !== 'number' || body.gallons <= 0) {
    return NextResponse.json(
      { error: 'Gallons must be a positive number' },
      { status: 400 }
    )
  }

  if (typeof body.pricePerGallon !== 'number' || body.pricePerGallon <= 0) {
    return NextResponse.json(
      { error: 'Price per gallon must be a positive number' },
      { status: 400 }
    )
  }

  if (typeof body.odometer !== 'number' || !Number.isInteger(body.odometer) || body.odometer <= 0) {
    return NextResponse.json(
      { error: 'Odometer must be a positive integer' },
      { status: 400 }
    )
  }

  // Validate optional fields
  if (body.isFull !== undefined && typeof body.isFull !== 'boolean') {
    return NextResponse.json(
      { error: 'isFull must be a boolean' },
      { status: 400 }
    )
  }

  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string') {
      return NextResponse.json(
        { error: 'Notes must be a string' },
        { status: 400 }
      )
    }
    if (body.notes.length > 500) {
      return NextResponse.json(
        { error: 'Notes must be 500 characters or less' },
        { status: 400 }
      )
    }
  }

  if (body.latitude !== undefined && body.latitude !== null) {
    if (typeof body.latitude !== 'number' || body.latitude < -90 || body.latitude > 90) {
      return NextResponse.json(
        { error: 'Latitude must be a number between -90 and 90' },
        { status: 400 }
      )
    }
  }

  if (body.longitude !== undefined && body.longitude !== null) {
    if (typeof body.longitude !== 'number' || body.longitude < -180 || body.longitude > 180) {
      return NextResponse.json(
        { error: 'Longitude must be a number between -180 and 180' },
        { status: 400 }
      )
    }
  }

  // Verify vehicle exists and user has access
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: body.vehicleId },
    select: { id: true, name: true, groupId: true }
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

  // Calculate totalCost
  const totalCost = Math.round(body.gallons * body.pricePerGallon * 100) / 100

  // Calculate MPG if previous fillup exists and both are full tanks
  let mpg: number | null = null
  const isFull = body.isFull !== undefined ? body.isFull : true

  if (isFull) {
    // Find the most recent full fillup before this odometer reading
    const previousFillup = await prisma.fillup.findFirst({
      where: {
        vehicleId: body.vehicleId,
        isFull: true,
        odometer: { lt: body.odometer }
      },
      orderBy: { odometer: 'desc' }
    })

    if (previousFillup) {
      const milesDriven = body.odometer - previousFillup.odometer
      if (milesDriven > 0) {
        mpg = Math.round((milesDriven / body.gallons) * 100) / 100
      }
    }
  }

  try {
    const fillup = await prisma.fillup.create({
      data: {
        date: parsedDate,
        gallons: body.gallons,
        pricePerGallon: body.pricePerGallon,
        totalCost,
        odometer: body.odometer,
        mpg,
        isFull,
        notes: body.notes ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        country: body.country ?? null,
        vehicleId: body.vehicleId,
        userId: session.user.id
      }
    })

    return NextResponse.json(
      {
        id: fillup.id,
        date: fillup.date.toISOString(),
        gallons: fillup.gallons,
        pricePerGallon: fillup.pricePerGallon,
        totalCost: fillup.totalCost,
        odometer: fillup.odometer,
        mpg: fillup.mpg,
        isFull: fillup.isFull,
        notes: fillup.notes,
        latitude: fillup.latitude,
        longitude: fillup.longitude,
        city: fillup.city,
        state: fillup.state,
        country: fillup.country,
        vehicleId: fillup.vehicleId,
        vehicleName: vehicle.name,
        userId: fillup.userId,
        createdAt: fillup.createdAt.toISOString(),
        updatedAt: fillup.updatedAt.toISOString()
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating fillup:', error)
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    )
  }
}
