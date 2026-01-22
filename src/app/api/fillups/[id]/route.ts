import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id } = await params

  const fillup = await prisma.fillup.findUnique({
    where: { id },
    include: {
      vehicle: {
        select: { name: true, groupId: true }
      }
    }
  })

  if (!fillup) {
    return NextResponse.json(
      { error: 'Fillup not found' },
      { status: 404 }
    )
  }

  // Verify user is member of the vehicle's group
  const membership = await prisma.membership.findUnique({
    where: {
      userId_groupId: {
        userId: session.user.id,
        groupId: fillup.vehicle.groupId
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
    vehicleName: fillup.vehicle.name,
    userId: fillup.userId,
    createdAt: fillup.createdAt.toISOString(),
    updatedAt: fillup.updatedAt.toISOString()
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id } = await params

  let body: {
    date?: string
    gallons?: number
    pricePerGallon?: number
    odometer?: number
    isFull?: boolean
    notes?: string | null
    latitude?: number | null
    longitude?: number | null
    city?: string | null
    state?: string | null
    country?: string | null
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    )
  }

  const fillup = await prisma.fillup.findUnique({
    where: { id },
    include: {
      vehicle: {
        select: { name: true, groupId: true }
      }
    }
  })

  if (!fillup) {
    return NextResponse.json(
      { error: 'Fillup not found' },
      { status: 404 }
    )
  }

  // Verify user is member of the vehicle's group
  const membership = await prisma.membership.findUnique({
    where: {
      userId_groupId: {
        userId: session.user.id,
        groupId: fillup.vehicle.groupId
      }
    }
  })

  if (!membership) {
    return NextResponse.json(
      { error: 'You are not a member of this vehicle\'s group' },
      { status: 403 }
    )
  }

  // Build update data
  const updateData: {
    date?: Date
    gallons?: number
    pricePerGallon?: number
    totalCost?: number
    odometer?: number
    mpg?: number | null
    isFull?: boolean
    notes?: string | null
    latitude?: number | null
    longitude?: number | null
    city?: string | null
    state?: string | null
    country?: string | null
  } = {}

  // Validate and add each field if provided
  if (body.date !== undefined) {
    const parsedDate = new Date(body.date)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: 'Date must be a valid ISO date string' },
        { status: 400 }
      )
    }
    updateData.date = parsedDate
  }

  if (body.gallons !== undefined) {
    if (typeof body.gallons !== 'number' || body.gallons <= 0) {
      return NextResponse.json(
        { error: 'Gallons must be a positive number' },
        { status: 400 }
      )
    }
    updateData.gallons = body.gallons
  }

  if (body.pricePerGallon !== undefined) {
    if (typeof body.pricePerGallon !== 'number' || body.pricePerGallon <= 0) {
      return NextResponse.json(
        { error: 'Price per gallon must be a positive number' },
        { status: 400 }
      )
    }
    updateData.pricePerGallon = body.pricePerGallon
  }

  if (body.odometer !== undefined) {
    if (typeof body.odometer !== 'number' || !Number.isInteger(body.odometer) || body.odometer <= 0) {
      return NextResponse.json(
        { error: 'Odometer must be a positive integer' },
        { status: 400 }
      )
    }
    updateData.odometer = body.odometer
  }

  if (body.isFull !== undefined) {
    if (typeof body.isFull !== 'boolean') {
      return NextResponse.json(
        { error: 'isFull must be a boolean' },
        { status: 400 }
      )
    }
    updateData.isFull = body.isFull
  }

  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== 'string') {
      return NextResponse.json(
        { error: 'Notes must be a string or null' },
        { status: 400 }
      )
    }
    if (body.notes !== null && body.notes.length > 500) {
      return NextResponse.json(
        { error: 'Notes must be 500 characters or less' },
        { status: 400 }
      )
    }
    updateData.notes = body.notes
  }

  if (body.latitude !== undefined) {
    if (body.latitude !== null && (typeof body.latitude !== 'number' || body.latitude < -90 || body.latitude > 90)) {
      return NextResponse.json(
        { error: 'Latitude must be a number between -90 and 90 or null' },
        { status: 400 }
      )
    }
    updateData.latitude = body.latitude
  }

  if (body.longitude !== undefined) {
    if (body.longitude !== null && (typeof body.longitude !== 'number' || body.longitude < -180 || body.longitude > 180)) {
      return NextResponse.json(
        { error: 'Longitude must be a number between -180 and 180 or null' },
        { status: 400 }
      )
    }
    updateData.longitude = body.longitude
  }

  if (body.city !== undefined) {
    updateData.city = body.city
  }

  if (body.state !== undefined) {
    updateData.state = body.state
  }

  if (body.country !== undefined) {
    updateData.country = body.country
  }

  // Recalculate totalCost if gallons or pricePerGallon changes
  const finalGallons = updateData.gallons ?? fillup.gallons
  const finalPricePerGallon = updateData.pricePerGallon ?? fillup.pricePerGallon
  if (updateData.gallons !== undefined || updateData.pricePerGallon !== undefined) {
    updateData.totalCost = Math.round(finalGallons * finalPricePerGallon * 100) / 100
  }

  // Recalculate MPG if gallons, odometer, or isFull changes
  const mpgFieldsChanged = updateData.gallons !== undefined ||
                            updateData.odometer !== undefined ||
                            updateData.isFull !== undefined

  const finalOdometer = updateData.odometer ?? fillup.odometer
  const finalIsFull = updateData.isFull ?? fillup.isFull
  const odometerChanged = updateData.odometer !== undefined && updateData.odometer !== fillup.odometer

  if (mpgFieldsChanged) {
    // If the fillup will be a full tank, calculate MPG
    if (finalIsFull) {
      // Find the most recent full fillup before this odometer reading
      const previousFillup = await prisma.fillup.findFirst({
        where: {
          vehicleId: fillup.vehicleId,
          isFull: true,
          odometer: { lt: finalOdometer },
          id: { not: fillup.id } // Exclude current fillup
        },
        orderBy: { odometer: 'desc' }
      })

      if (previousFillup) {
        const milesDriven = finalOdometer - previousFillup.odometer
        if (milesDriven > 0) {
          updateData.mpg = Math.round((milesDriven / finalGallons) * 100) / 100
        } else {
          updateData.mpg = null
        }
      } else {
        updateData.mpg = null
      }
    } else {
      // Partial fillup - no MPG calculation
      updateData.mpg = null
    }
  }

  try {
    const updatedFillup = await prisma.fillup.update({
      where: { id },
      data: updateData,
      include: {
        vehicle: {
          select: { name: true }
        }
      }
    })

    // If odometer changed, recalculate MPG for the next full fillup
    if (odometerChanged) {
      // Find the next full fillup with odometer > updated fillup's odometer
      const nextFillup = await prisma.fillup.findFirst({
        where: {
          vehicleId: updatedFillup.vehicleId,
          isFull: true,
          odometer: { gt: updatedFillup.odometer }
        },
        orderBy: { odometer: 'asc' }
      })

      if (nextFillup) {
        // Find the previous full fillup for the next fillup (could be the one we just updated)
        const previousForNext = await prisma.fillup.findFirst({
          where: {
            vehicleId: updatedFillup.vehicleId,
            isFull: true,
            odometer: { lt: nextFillup.odometer }
          },
          orderBy: { odometer: 'desc' }
        })

        if (previousForNext) {
          const milesDriven = nextFillup.odometer - previousForNext.odometer
          const newMpg = milesDriven > 0
            ? Math.round((milesDriven / nextFillup.gallons) * 100) / 100
            : null

          await prisma.fillup.update({
            where: { id: nextFillup.id },
            data: { mpg: newMpg }
          })
        } else {
          // No previous full fillup, set mpg to null
          await prisma.fillup.update({
            where: { id: nextFillup.id },
            data: { mpg: null }
          })
        }
      }
    }

    return NextResponse.json({
      id: updatedFillup.id,
      date: updatedFillup.date.toISOString(),
      gallons: updatedFillup.gallons,
      pricePerGallon: updatedFillup.pricePerGallon,
      totalCost: updatedFillup.totalCost,
      odometer: updatedFillup.odometer,
      mpg: updatedFillup.mpg,
      isFull: updatedFillup.isFull,
      notes: updatedFillup.notes,
      latitude: updatedFillup.latitude,
      longitude: updatedFillup.longitude,
      city: updatedFillup.city,
      state: updatedFillup.state,
      country: updatedFillup.country,
      vehicleId: updatedFillup.vehicleId,
      vehicleName: updatedFillup.vehicle.name,
      userId: updatedFillup.userId,
      createdAt: updatedFillup.createdAt.toISOString(),
      updatedAt: updatedFillup.updatedAt.toISOString()
    })
  } catch (error) {
    console.error('Error updating fillup:', error)
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id } = await params

  const fillup = await prisma.fillup.findUnique({
    where: { id },
    include: {
      vehicle: {
        select: { groupId: true }
      }
    }
  })

  if (!fillup) {
    return NextResponse.json(
      { error: 'Fillup not found' },
      { status: 404 }
    )
  }

  // Verify user is member of the vehicle's group
  const membership = await prisma.membership.findUnique({
    where: {
      userId_groupId: {
        userId: session.user.id,
        groupId: fillup.vehicle.groupId
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
    await prisma.fillup.delete({
      where: { id }
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting fillup:', error)
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    )
  }
}
