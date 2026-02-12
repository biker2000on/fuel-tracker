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
  const cursor = searchParams.get('cursor')
  const pageSizeParam = searchParams.get('pageSize')
  const limitParam = searchParams.get('limit')
  const startDateParam = searchParams.get('startDate')
  const endDateParam = searchParams.get('endDate')

  // Prefer pageSize over limit for new cursor-based pagination
  const pageSize = pageSizeParam
    ? parseInt(pageSizeParam, 10)
    : limitParam
      ? parseInt(limitParam, 10)
      : 20

  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
    return NextResponse.json(
      { error: 'pageSize must be a number between 1 and 100' },
      { status: 400 }
    )
  }

  // Validate date range parameters
  let startDate: Date | null = null
  let endDate: Date | null = null

  if (startDateParam) {
    startDate = new Date(startDateParam)
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: 'startDate must be a valid ISO date string' },
        { status: 400 }
      )
    }
  }

  if (endDateParam) {
    endDate = new Date(endDateParam)
    if (isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'endDate must be a valid ISO date string' },
        { status: 400 }
      )
    }
    // Set to end of day for inclusive filtering
    endDate.setHours(23, 59, 59, 999)
  }

  // Get all groups user is a member of
  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    select: { groupId: true }
  })

  if (memberships.length === 0) {
    return NextResponse.json({ fillups: [], nextCursor: null, hasMore: false })
  }

  const groupIds = memberships.map((m) => m.groupId)

  // Get vehicles for those groups
  const vehicles = await prisma.vehicle.findMany({
    where: { groupId: { in: groupIds } },
    select: { id: true, name: true }
  })

  if (vehicles.length === 0) {
    return NextResponse.json({ fillups: [], nextCursor: null, hasMore: false })
  }

  const vehicleIds = vehicles.map((v) => v.id)
  const vehicleNameMap = new Map(vehicles.map((v) => [v.id, v.name]))

  // Build where clause
  interface WhereClause {
    vehicleId: { in: string[] } | string
    date?: { gte?: Date; lte?: Date; lt?: Date }
    OR?: Array<{ date: { lt: Date } } | { date: Date; id: { lt: string } }>
  }

  const whereClause: WhereClause = {
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

  // Apply date range filter
  if (startDate || endDate) {
    whereClause.date = {}
    if (startDate) {
      whereClause.date.gte = startDate
    }
    if (endDate) {
      whereClause.date.lte = endDate
    }
  }

  // Apply cursor for pagination
  // Cursor format: "date_id" where date is ISO string and id is the fillup ID
  // This ensures proper ordering across different years
  if (cursor) {
    const [cursorDate, cursorId] = cursor.split('_')
    if (cursorDate && cursorId) {
      const cursorDateObj = new Date(cursorDate)
      // Get items where: date < cursorDate OR (date = cursorDate AND id < cursorId)
      whereClause.OR = [
        { date: { lt: cursorDateObj } },
        { date: cursorDateObj, id: { lt: cursorId } }
      ]
    }
  }

  // Fetch one more than pageSize to determine if there are more results
  const fillups = await prisma.fillup.findMany({
    where: whereClause,
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: pageSize + 1
  })

  // Determine if there are more results
  const hasMore = fillups.length > pageSize
  const results = hasMore ? fillups.slice(0, pageSize) : fillups
  // Cursor format: "date_id" for proper ordering across years
  const lastResult = results[results.length - 1]
  const nextCursor = hasMore && lastResult
    ? `${lastResult.date.toISOString()}_${lastResult.id}`
    : null

  const fillupsWithVehicleName = results.map((fillup) => ({
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

  return NextResponse.json({ fillups: fillupsWithVehicleName, nextCursor, hasMore })
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
    pricePerGallonRaw?: string
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

  // Validate optional pricePerGallonRaw (string version of price for decimal detection)
  if (body.pricePerGallonRaw !== undefined && body.pricePerGallonRaw !== null) {
    if (typeof body.pricePerGallonRaw !== 'string') {
      return NextResponse.json(
        { error: 'pricePerGallonRaw must be a string' },
        { status: 400 }
      )
    }
    // Verify it parses to a valid number close to pricePerGallon
    const rawParsed = parseFloat(body.pricePerGallonRaw)
    if (isNaN(rawParsed) || Math.abs(rawParsed - body.pricePerGallon) > 0.001) {
      return NextResponse.json(
        { error: 'pricePerGallonRaw must match pricePerGallon' },
        { status: 400 }
      )
    }
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

  // Fetch user's thousandths preference
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { defaultThousandths: true }
  })

  // Apply thousandths if user entered price with 2 or fewer decimal places
  let effectivePrice = body.pricePerGallon
  if (user?.defaultThousandths && user.defaultThousandths > 0) {
    // Use the raw string for decimal place detection (preserves trailing zeros)
    // Fall back to numeric toString() if raw string not provided (backward compat)
    const priceStr = body.pricePerGallonRaw ?? body.pricePerGallon.toString()
    const decimalIndex = priceStr.indexOf('.')
    const decimalPlaces = decimalIndex === -1 ? 0 : priceStr.length - decimalIndex - 1

    if (decimalPlaces <= 2) {
      effectivePrice = body.pricePerGallon + user.defaultThousandths
      // Round to avoid floating point errors (e.g., 2.09 + 0.009 = 2.0989999...)
      effectivePrice = Math.round(effectivePrice * 1000) / 1000
    }
  }

  // Calculate totalCost using effective price
  const totalCost = Math.round(body.gallons * effectivePrice * 100) / 100

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
        pricePerGallon: effectivePrice,
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
