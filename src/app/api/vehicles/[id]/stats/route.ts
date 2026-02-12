import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface StatsResponse {
  overview: {
    totalFillups: number
    totalGallons: number
    totalCost: number
    totalMiles: number
    firstFillup: string | null
    lastFillup: string | null
  }
  mpg: {
    average: number | null
    best: number | null
    worst: number | null
    recent: number | null
  }
  costs: {
    averagePricePerGallon: number | null
    averageCostPerFillup: number | null
    costPerMile: number | null
  }
  frequency: {
    averageDaysBetweenFillups: number | null
    averageMilesBetweenFillups: number | null
  }
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

  // Parse optional date range filters
  const url = new URL(request.url)
  const startDateParam = url.searchParams.get('startDate')
  const endDateParam = url.searchParams.get('endDate')

  // Build date filter for Prisma query
  const dateFilter: { gte?: Date; lte?: Date } = {}
  if (startDateParam) {
    const startDate = new Date(startDateParam)
    if (!isNaN(startDate.getTime())) {
      dateFilter.gte = startDate
    }
  }
  if (endDateParam) {
    const endDate = new Date(endDateParam)
    if (!isNaN(endDate.getTime())) {
      // Set to end of day to include the entire end date
      endDate.setHours(23, 59, 59, 999)
      dateFilter.lte = endDate
    }
  }

  // Fetch all fillups for this vehicle, ordered by date
  const fillups = await prisma.fillup.findMany({
    where: {
      vehicleId: id,
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
    },
    orderBy: { date: 'asc' }
  })

  // Initialize stats with null/zero values
  const stats: StatsResponse = {
    overview: {
      totalFillups: 0,
      totalGallons: 0,
      totalCost: 0,
      totalMiles: 0,
      firstFillup: null,
      lastFillup: null
    },
    mpg: {
      average: null,
      best: null,
      worst: null,
      recent: null
    },
    costs: {
      averagePricePerGallon: null,
      averageCostPerFillup: null,
      costPerMile: null
    },
    frequency: {
      averageDaysBetweenFillups: null,
      averageMilesBetweenFillups: null
    }
  }

  // Handle 0 fillups case
  if (fillups.length === 0) {
    return NextResponse.json(stats)
  }

  // Calculate overview stats
  stats.overview.totalFillups = fillups.length
  stats.overview.totalGallons = fillups.reduce((sum, f) => sum + f.gallons, 0)
  stats.overview.totalCost = fillups.reduce((sum, f) => sum + f.totalCost, 0)
  stats.overview.firstFillup = fillups[0].date.toISOString()
  stats.overview.lastFillup = fillups[fillups.length - 1].date.toISOString()

  // Calculate total miles (difference between first and last odometer)
  const firstOdometer = fillups[0].odometer
  const lastOdometer = fillups[fillups.length - 1].odometer
  stats.overview.totalMiles = lastOdometer - firstOdometer

  // Round totals for cleaner display
  stats.overview.totalGallons = Math.round(stats.overview.totalGallons * 100) / 100
  stats.overview.totalCost = Math.round(stats.overview.totalCost * 100) / 100

  // Calculate MPG stats - only from full fillups with MPG values
  const fillupsWithMpg = fillups.filter(f => f.isFull && f.mpg !== null && f.mpg > 0)

  if (fillupsWithMpg.length > 0) {
    const mpgValues = fillupsWithMpg.map(f => f.mpg as number)
    stats.mpg.average = Math.round((mpgValues.reduce((sum, v) => sum + v, 0) / mpgValues.length) * 10) / 10
    stats.mpg.best = Math.round(Math.max(...mpgValues) * 10) / 10
    stats.mpg.worst = Math.round(Math.min(...mpgValues) * 10) / 10

    // Recent MPG: average of last 5 fillups with MPG
    const recentFillups = fillupsWithMpg.slice(-5)
    const recentMpgValues = recentFillups.map(f => f.mpg as number)
    stats.mpg.recent = Math.round((recentMpgValues.reduce((sum, v) => sum + v, 0) / recentMpgValues.length) * 10) / 10
  }

  // Calculate cost stats
  stats.costs.averagePricePerGallon = Math.round((fillups.reduce((sum, f) => sum + f.pricePerGallon, 0) / fillups.length) * 1000) / 1000
  stats.costs.averageCostPerFillup = Math.round((stats.overview.totalCost / fillups.length) * 100) / 100

  if (stats.overview.totalMiles > 0) {
    stats.costs.costPerMile = Math.round((stats.overview.totalCost / stats.overview.totalMiles) * 100) / 100
  }

  // Calculate frequency stats (need at least 2 fillups)
  if (fillups.length >= 2) {
    // Average days between fillups
    const firstDate = fillups[0].date.getTime()
    const lastDate = fillups[fillups.length - 1].date.getTime()
    const daysBetween = (lastDate - firstDate) / (1000 * 60 * 60 * 24)
    stats.frequency.averageDaysBetweenFillups = Math.round((daysBetween / (fillups.length - 1)) * 10) / 10

    // Average miles between fillups
    stats.frequency.averageMilesBetweenFillups = Math.round(stats.overview.totalMiles / (fillups.length - 1))
  }

  return NextResponse.json(stats)
}
