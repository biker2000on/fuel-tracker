import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(
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

  // Can only calculate MPG for full tank fillups
  if (!fillup.isFull) {
    return NextResponse.json(
      { error: 'Cannot calculate MPG for partial fillups' },
      { status: 400 }
    )
  }

  // Find the most recent full fillup before this odometer reading
  const previousFillup = await prisma.fillup.findFirst({
    where: {
      vehicleId: fillup.vehicleId,
      isFull: true,
      odometer: { lt: fillup.odometer },
      id: { not: fillup.id } // Exclude current fillup
    },
    orderBy: { odometer: 'desc' }
  })

  if (!previousFillup) {
    return NextResponse.json(
      { error: 'No previous full fillup found for MPG calculation' },
      { status: 400 }
    )
  }

  // Calculate MPG
  const milesDriven = fillup.odometer - previousFillup.odometer
  if (milesDriven <= 0) {
    return NextResponse.json(
      { error: 'Invalid odometer readings - cannot calculate MPG' },
      { status: 400 }
    )
  }

  const mpg = Math.round((milesDriven / fillup.gallons) * 100) / 100

  try {
    const updatedFillup = await prisma.fillup.update({
      where: { id },
      data: { mpg },
      include: {
        vehicle: {
          select: { name: true }
        }
      }
    })

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
    console.error('Error recalculating MPG:', error)
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    )
  }
}
