import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

interface RecentFillup {
  id: string
  date: string
  gallons: number
  totalCost: number
  mpg: number | null
  vehicleId: string
  vehicleName: string
  city: string | null
  state: string | null
}

interface VehicleSummary {
  id: string
  name: string
  year: number
  make: string
  model: string
  photoUrl: string | null
  lastFillup: string | null
  averageMpg: number | null
  recentMpg: number | null
  totalFillups: number
}

interface DashboardTotals {
  totalVehicles: number
  totalFillupsThisMonth: number
  totalSpentThisMonth: number
}

interface DashboardResponse {
  recentFillups: RecentFillup[]
  vehicleSummaries: VehicleSummary[]
  totals: DashboardTotals
}

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
    const emptyResponse: DashboardResponse = {
      recentFillups: [],
      vehicleSummaries: [],
      totals: {
        totalVehicles: 0,
        totalFillupsThisMonth: 0,
        totalSpentThisMonth: 0
      }
    }
    return NextResponse.json(emptyResponse)
  }

  const groupIds = memberships.map((m) => m.groupId)

  // Get all vehicles for those groups
  const vehicles = await prisma.vehicle.findMany({
    where: { groupId: { in: groupIds } },
    select: {
      id: true,
      name: true,
      year: true,
      make: true,
      model: true,
      photoUrl: true
    }
  })

  if (vehicles.length === 0) {
    const emptyResponse: DashboardResponse = {
      recentFillups: [],
      vehicleSummaries: [],
      totals: {
        totalVehicles: 0,
        totalFillupsThisMonth: 0,
        totalSpentThisMonth: 0
      }
    }
    return NextResponse.json(emptyResponse)
  }

  const vehicleIds = vehicles.map((v) => v.id)
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]))

  // Get last 10 fillups across all vehicles
  const recentFillups = await prisma.fillup.findMany({
    where: { vehicleId: { in: vehicleIds } },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: 10
  })

  const recentFillupsResponse: RecentFillup[] = recentFillups.map((fillup) => {
    const vehicle = vehicleMap.get(fillup.vehicleId)
    return {
      id: fillup.id,
      date: fillup.date.toISOString(),
      gallons: fillup.gallons,
      totalCost: fillup.totalCost,
      mpg: fillup.mpg,
      vehicleId: fillup.vehicleId,
      vehicleName: vehicle?.name || 'Unknown Vehicle',
      city: fillup.city,
      state: fillup.state
    }
  })

  // Get per-vehicle aggregations
  const vehicleSummaries: VehicleSummary[] = await Promise.all(
    vehicles.map(async (vehicle) => {
      // Get all fillups for this vehicle to compute stats
      const vehicleFillups = await prisma.fillup.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { date: 'desc' },
        select: {
          date: true,
          mpg: true
        }
      })

      const totalFillups = vehicleFillups.length
      const lastFillup = vehicleFillups.length > 0 ? vehicleFillups[0].date.toISOString() : null

      // Calculate average MPG from all fillups with mpg data
      const fillupsWithMpg = vehicleFillups.filter((f) => f.mpg !== null)
      const averageMpg = fillupsWithMpg.length > 0
        ? Math.round((fillupsWithMpg.reduce((sum, f) => sum + (f.mpg || 0), 0) / fillupsWithMpg.length) * 100) / 100
        : null

      // Recent MPG is the most recent fillup's MPG
      const recentMpg = vehicleFillups.length > 0 && vehicleFillups[0].mpg !== null
        ? vehicleFillups[0].mpg
        : null

      return {
        id: vehicle.id,
        name: vehicle.name,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        photoUrl: vehicle.photoUrl,
        lastFillup,
        averageMpg,
        recentMpg,
        totalFillups
      }
    })
  )

  // Calculate monthly totals
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const monthlyFillups = await prisma.fillup.findMany({
    where: {
      vehicleId: { in: vehicleIds },
      date: { gte: startOfMonth }
    },
    select: {
      totalCost: true
    }
  })

  const totals: DashboardTotals = {
    totalVehicles: vehicles.length,
    totalFillupsThisMonth: monthlyFillups.length,
    totalSpentThisMonth: Math.round(monthlyFillups.reduce((sum, f) => sum + f.totalCost, 0) * 100) / 100
  }

  const response: DashboardResponse = {
    recentFillups: recentFillupsResponse,
    vehicleSummaries,
    totals
  }

  return NextResponse.json(response)
}
