import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { parseCSV } from '@/lib/csvParser'

interface ValidationError {
  row: number
  field: string
  message: string
}

interface ParsedFillup {
  date: Date
  gallons: number
  pricePerGallon: number
  totalCost: number
  odometer: number
  isFull: boolean
  notes: string | null
  city: string | null
  state: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
}

const MAX_ROWS = 1000

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
    csv?: string
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
      { error: 'vehicleId is required' },
      { status: 400 }
    )
  }

  if (!body.csv || typeof body.csv !== 'string') {
    return NextResponse.json(
      { error: 'csv is required' },
      { status: 400 }
    )
  }

  // Verify vehicle exists and user has access
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: body.vehicleId },
    select: { id: true, groupId: true }
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
      { error: 'You do not have access to this vehicle' },
      { status: 403 }
    )
  }

  // Parse CSV
  const rows = parseCSV(body.csv)

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'CSV is empty or invalid' },
      { status: 400 }
    )
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `CSV contains ${rows.length} rows, maximum is ${MAX_ROWS}` },
      { status: 400 }
    )
  }

  // Validate each row
  const errors: ValidationError[] = []
  const parsedRows: ParsedFillup[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // Account for header row and 1-based indexing

    // Required: date
    if (!row.date || row.date.trim() === '') {
      errors.push({ row: rowNum, field: 'date', message: 'is required' })
    } else {
      const parsedDate = new Date(row.date)
      if (isNaN(parsedDate.getTime())) {
        errors.push({ row: rowNum, field: 'date', message: 'must be a valid ISO date (YYYY-MM-DD)' })
      }
    }

    // Required: gallons
    if (!row.gallons || row.gallons.trim() === '') {
      errors.push({ row: rowNum, field: 'gallons', message: 'is required' })
    } else {
      const gallons = parseFloat(row.gallons)
      if (isNaN(gallons) || gallons <= 0) {
        errors.push({ row: rowNum, field: 'gallons', message: 'must be a positive number' })
      }
    }

    // Required: pricePerGallon
    if (!row.pricePerGallon || row.pricePerGallon.trim() === '') {
      errors.push({ row: rowNum, field: 'pricePerGallon', message: 'is required' })
    } else {
      const price = parseFloat(row.pricePerGallon)
      if (isNaN(price) || price <= 0) {
        errors.push({ row: rowNum, field: 'pricePerGallon', message: 'must be a positive number' })
      }
    }

    // Required: odometer
    if (!row.odometer || row.odometer.trim() === '') {
      errors.push({ row: rowNum, field: 'odometer', message: 'is required' })
    } else {
      const odometer = parseInt(row.odometer, 10)
      if (isNaN(odometer) || odometer <= 0 || !Number.isInteger(parseFloat(row.odometer))) {
        errors.push({ row: rowNum, field: 'odometer', message: 'must be a positive integer' })
      }
    }

    // Optional: isFull (default true)
    let isFull = true
    if (row.isFull !== undefined && row.isFull.trim() !== '') {
      const isFullLower = row.isFull.toLowerCase().trim()
      if (isFullLower === 'true' || isFullLower === '1' || isFullLower === 'yes') {
        isFull = true
      } else if (isFullLower === 'false' || isFullLower === '0' || isFullLower === 'no') {
        isFull = false
      } else {
        errors.push({ row: rowNum, field: 'isFull', message: 'must be true/false, yes/no, or 1/0' })
      }
    }

    // Optional: latitude
    let latitude: number | null = null
    if (row.latitude !== undefined && row.latitude.trim() !== '') {
      const lat = parseFloat(row.latitude)
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errors.push({ row: rowNum, field: 'latitude', message: 'must be a number between -90 and 90' })
      } else {
        latitude = lat
      }
    }

    // Optional: longitude
    let longitude: number | null = null
    if (row.longitude !== undefined && row.longitude.trim() !== '') {
      const lng = parseFloat(row.longitude)
      if (isNaN(lng) || lng < -180 || lng > 180) {
        errors.push({ row: rowNum, field: 'longitude', message: 'must be a number between -180 and 180' })
      } else {
        longitude = lng
      }
    }

    // If no errors for this row, add to parsed rows
    // Only build parsed row if the required fields are valid
    const hasRequiredFieldErrors = errors.some(
      e => e.row === rowNum && ['date', 'gallons', 'pricePerGallon', 'odometer'].includes(e.field)
    )

    if (!hasRequiredFieldErrors) {
      const gallons = parseFloat(row.gallons)
      const pricePerGallon = parseFloat(row.pricePerGallon)
      const totalCost = Math.round(gallons * pricePerGallon * 100) / 100

      parsedRows.push({
        date: new Date(row.date),
        gallons,
        pricePerGallon,
        totalCost,
        odometer: parseInt(row.odometer, 10),
        isFull,
        notes: row.notes?.trim() || null,
        city: row.city?.trim() || null,
        state: row.state?.trim() || null,
        country: row.country?.trim() || null,
        latitude,
        longitude
      })
    }
  }

  // Return validation errors if any
  if (errors.length > 0) {
    return NextResponse.json(
      { success: false, errors },
      { status: 400 }
    )
  }

  // Sort by odometer ascending for proper MPG calculation
  parsedRows.sort((a, b) => a.odometer - b.odometer)

  // Get existing fillups for this vehicle to calculate MPG properly
  const existingFillups = await prisma.fillup.findMany({
    where: {
      vehicleId: body.vehicleId,
      isFull: true
    },
    orderBy: { odometer: 'asc' },
    select: { odometer: true, gallons: true }
  })

  // Build a combined list of all full fillups (existing + new) for MPG calculation
  interface FillupForMpg {
    odometer: number
    gallons: number
    isNew: boolean
    index?: number
  }

  const allFillups: FillupForMpg[] = [
    ...existingFillups.map(f => ({ odometer: f.odometer, gallons: f.gallons, isNew: false })),
    ...parsedRows
      .filter(r => r.isFull)
      .map((r, idx) => ({ odometer: r.odometer, gallons: r.gallons, isNew: true, index: idx }))
  ]
  allFillups.sort((a, b) => a.odometer - b.odometer)

  // Calculate MPG for each new fillup
  const mpgMap = new Map<number, number | null>()

  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i]

    if (!row.isFull) {
      mpgMap.set(i, null)
      continue
    }

    // Find the previous full fillup (from either existing or new rows)
    let previousOdometer: number | null = null

    for (const fillup of allFillups) {
      if (fillup.odometer < row.odometer) {
        previousOdometer = fillup.odometer
      } else {
        break
      }
    }

    if (previousOdometer !== null) {
      const milesDriven = row.odometer - previousOdometer
      if (milesDriven > 0) {
        mpgMap.set(i, Math.round((milesDriven / row.gallons) * 100) / 100)
      } else {
        mpgMap.set(i, null)
      }
    } else {
      mpgMap.set(i, null)
    }
  }

  // Create fillups in a transaction
  try {
    const created = await prisma.$transaction(
      parsedRows.map((row, index) =>
        prisma.fillup.create({
          data: {
            date: row.date,
            gallons: row.gallons,
            pricePerGallon: row.pricePerGallon,
            totalCost: row.totalCost,
            odometer: row.odometer,
            mpg: mpgMap.get(index) ?? null,
            isFull: row.isFull,
            notes: row.notes,
            city: row.city,
            state: row.state,
            country: row.country,
            latitude: row.latitude,
            longitude: row.longitude,
            vehicleId: body.vehicleId!,
            userId: session.user.id
          }
        })
      )
    )

    return NextResponse.json(
      { success: true, imported: created.length, skipped: 0 },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error importing fillups:', error)
    return NextResponse.json(
      { error: 'Database error while importing fillups' },
      { status: 500 }
    )
  }
}
