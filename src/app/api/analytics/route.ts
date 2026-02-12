import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

const VEHICLE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
]

function getPeriodStartDate(period: string): Date | null {
  const now = new Date()
  switch (period) {
    case '3m':
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
    case '6m':
      return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
    case '12m':
      return new Date(now.getFullYear(), now.getMonth() - 12, now.getDate())
    case 'all':
      return null
    default:
      return new Date(now.getFullYear(), now.getMonth() - 12, now.getDate())
  }
}

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
  const period = searchParams.get('period') || '12m'

  // Get all groups user is a member of
  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    select: { groupId: true }
  })

  if (memberships.length === 0) {
    return NextResponse.json({
      priceHistory: [],
      mpgHistory: [],
      monthlySpending: [],
      costPerMile: [],
      vehicles: [],
    })
  }

  const groupIds = memberships.map((m) => m.groupId)

  // Get vehicles for those groups
  const vehicles = await prisma.vehicle.findMany({
    where: { groupId: { in: groupIds } },
    select: { id: true, name: true }
  })

  if (vehicles.length === 0) {
    return NextResponse.json({
      priceHistory: [],
      mpgHistory: [],
      monthlySpending: [],
      costPerMile: [],
      vehicles: [],
    })
  }

  const vehicleIds = vehicles.map((v) => v.id)
  const vehicleNameMap = new Map(vehicles.map((v) => [v.id, v.name]))

  // Filter by specific vehicle if requested
  let filteredVehicleIds = vehicleIds
  if (vehicleId) {
    if (!vehicleIds.includes(vehicleId)) {
      return NextResponse.json(
        { error: 'Vehicle not found or you do not have access' },
        { status: 404 }
      )
    }
    filteredVehicleIds = [vehicleId]
  }

  // Build date filter
  const periodStart = getPeriodStartDate(period)
  const dateFilter = periodStart ? { gte: periodStart } : undefined

  // Query fillups within the time period, ordered by date ASC
  const fillups = await prisma.fillup.findMany({
    where: {
      vehicleId: { in: filteredVehicleIds },
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      date: true,
      gallons: true,
      pricePerGallon: true,
      totalCost: true,
      odometer: true,
      mpg: true,
      vehicleId: true,
    },
  })

  // Build priceHistory
  const priceHistory = fillups.map((f) => ({
    date: f.date.toISOString().split('T')[0],
    pricePerGallon: f.pricePerGallon,
    vehicleId: f.vehicleId,
    vehicleName: vehicleNameMap.get(f.vehicleId) || '',
  }))

  // Build mpgHistory (only fillups with mpg)
  const mpgHistory = fillups
    .filter((f) => f.mpg !== null)
    .map((f) => ({
      date: f.date.toISOString().split('T')[0],
      mpg: f.mpg!,
      vehicleId: f.vehicleId,
      vehicleName: vehicleNameMap.get(f.vehicleId) || '',
    }))

  // Build monthlySpending
  const monthlyMap = new Map<string, { totalCost: number; gallons: number; fillupCount: number }>()
  for (const f of fillups) {
    const month = f.date.toISOString().substring(0, 7) // "YYYY-MM"
    const existing = monthlyMap.get(month)
    if (existing) {
      existing.totalCost += f.totalCost
      existing.gallons += f.gallons
      existing.fillupCount += 1
    } else {
      monthlyMap.set(month, {
        totalCost: f.totalCost,
        gallons: f.gallons,
        fillupCount: 1,
      })
    }
  }
  const monthlySpending = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      totalCost: Math.round(data.totalCost * 100) / 100,
      gallons: Math.round(data.gallons * 1000) / 1000,
      fillupCount: data.fillupCount,
    }))

  // Build costPerMile: for each vehicle, calculate cost-per-mile between consecutive fillups
  const costPerMile: Array<{
    date: string
    costPerMile: number
    vehicleId: string
    vehicleName: string
  }> = []

  // Group fillups by vehicle
  const fillupsByVehicle = new Map<string, typeof fillups>()
  for (const f of fillups) {
    const existing = fillupsByVehicle.get(f.vehicleId)
    if (existing) {
      existing.push(f)
    } else {
      fillupsByVehicle.set(f.vehicleId, [f])
    }
  }

  for (const [vId, vFillups] of fillupsByVehicle) {
    for (let i = 1; i < vFillups.length; i++) {
      const prev = vFillups[i - 1]
      const curr = vFillups[i]
      const milesDriven = curr.odometer - prev.odometer
      if (milesDriven > 0) {
        costPerMile.push({
          date: curr.date.toISOString().split('T')[0],
          costPerMile: Math.round((curr.totalCost / milesDriven) * 1000) / 1000,
          vehicleId: vId,
          vehicleName: vehicleNameMap.get(vId) || '',
        })
      }
    }
  }

  // Sort costPerMile by date
  costPerMile.sort((a, b) => a.date.localeCompare(b.date))

  // Assign colors to vehicles
  const vehiclesWithColors = vehicles
    .filter((v) => filteredVehicleIds.includes(v.id))
    .map((v, i) => ({
      id: v.id,
      name: v.name,
      color: VEHICLE_COLORS[i % VEHICLE_COLORS.length],
    }))

  return NextResponse.json({
    priceHistory,
    mpgHistory,
    monthlySpending,
    costPerMile,
    vehicles: vehiclesWithColors,
  })
}
