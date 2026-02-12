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
      kpiStats: {
        overview: { totalFillups: 0, totalGallons: 0, totalCost: 0, totalMiles: 0 },
        mpg: { average: null, best: null, worst: null, recent: null },
        costs: { averagePricePerGallon: null, averageCostPerFillup: null, costPerMile: null },
        frequency: { averageDaysBetweenFillups: null, averageMilesBetweenFillups: null },
      },
      monthlyMiles: [],
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
      kpiStats: {
        overview: { totalFillups: 0, totalGallons: 0, totalCost: 0, totalMiles: 0 },
        mpg: { average: null, best: null, worst: null, recent: null },
        costs: { averagePricePerGallon: null, averageCostPerFillup: null, costPerMile: null },
        frequency: { averageDaysBetweenFillups: null, averageMilesBetweenFillups: null },
      },
      monthlyMiles: [],
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
      isFull: true,
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

  // Build kpiStats from fillups (same logic as vehicle stats route)
  const kpiStats = {
    overview: {
      totalFillups: 0,
      totalGallons: 0,
      totalCost: 0,
      totalMiles: 0,
    },
    mpg: {
      average: null as number | null,
      best: null as number | null,
      worst: null as number | null,
      recent: null as number | null,
    },
    costs: {
      averagePricePerGallon: null as number | null,
      averageCostPerFillup: null as number | null,
      costPerMile: null as number | null,
    },
    frequency: {
      averageDaysBetweenFillups: null as number | null,
      averageMilesBetweenFillups: null as number | null,
    },
  }

  if (fillups.length > 0) {
    kpiStats.overview.totalFillups = fillups.length
    kpiStats.overview.totalGallons = Math.round(fillups.reduce((s, f) => s + f.gallons, 0) * 100) / 100
    kpiStats.overview.totalCost = Math.round(fillups.reduce((s, f) => s + f.totalCost, 0) * 100) / 100

    // Total miles: sum of (last - first odometer) per vehicle
    for (const [, vFillups] of fillupsByVehicle) {
      if (vFillups.length >= 2) {
        kpiStats.overview.totalMiles += vFillups[vFillups.length - 1].odometer - vFillups[0].odometer
      }
    }

    // MPG stats from full fillups with mpg (must match vehicle stats route: isFull && mpg > 0)
    const fillupsWithMpg = fillups.filter(f => f.isFull && f.mpg !== null && f.mpg > 0)
    if (fillupsWithMpg.length > 0) {
      const mpgValues = fillupsWithMpg.map(f => f.mpg as number)
      kpiStats.mpg.average = Math.round((mpgValues.reduce((s, v) => s + v, 0) / mpgValues.length) * 10) / 10
      kpiStats.mpg.best = Math.round(Math.max(...mpgValues) * 10) / 10
      kpiStats.mpg.worst = Math.round(Math.min(...mpgValues) * 10) / 10
      const recentMpg = fillupsWithMpg.slice(-5).map(f => f.mpg as number)
      kpiStats.mpg.recent = Math.round((recentMpg.reduce((s, v) => s + v, 0) / recentMpg.length) * 10) / 10
    }

    // Cost stats
    kpiStats.costs.averagePricePerGallon = Math.round((fillups.reduce((s, f) => s + f.pricePerGallon, 0) / fillups.length) * 1000) / 1000
    kpiStats.costs.averageCostPerFillup = Math.round((kpiStats.overview.totalCost / fillups.length) * 100) / 100
    if (kpiStats.overview.totalMiles > 0) {
      kpiStats.costs.costPerMile = Math.round((kpiStats.overview.totalCost / kpiStats.overview.totalMiles) * 100) / 100
    }

    // Frequency stats (need at least 2 fillups)
    if (fillups.length >= 2) {
      const firstDate = fillups[0].date.getTime()
      const lastDate = fillups[fillups.length - 1].date.getTime()
      const daysBetween = (lastDate - firstDate) / (1000 * 60 * 60 * 24)
      kpiStats.frequency.averageDaysBetweenFillups = Math.round((daysBetween / (fillups.length - 1)) * 10) / 10
      kpiStats.frequency.averageMilesBetweenFillups = Math.round(kpiStats.overview.totalMiles / (fillups.length - 1))
    }
  }

  // Build monthlyMiles: for each vehicle, compute miles per month
  interface MonthlyMilesPoint {
    month: string
    vehicleId: string
    vehicleName: string
    miles: number
  }

  const monthlyMilesRaw: MonthlyMilesPoint[] = []

  for (const [vId, vFillups] of fillupsByVehicle) {
    if (vFillups.length < 2) continue
    const vName = vehicleNameMap.get(vId) || ''

    for (let i = 1; i < vFillups.length; i++) {
      const prev = vFillups[i - 1]
      const curr = vFillups[i]
      const milesDriven = curr.odometer - prev.odometer
      if (milesDriven <= 0) continue

      const prevDate = prev.date
      const currDate = curr.date

      // Get all months in the range [prevDate, currDate]
      const startMonth = new Date(prevDate.getFullYear(), prevDate.getMonth(), 1)
      const endMonth = new Date(currDate.getFullYear(), currDate.getMonth(), 1)

      // Count months in range
      const months: string[] = []
      const iter = new Date(startMonth)
      while (iter <= endMonth) {
        months.push(`${iter.getFullYear()}-${String(iter.getMonth() + 1).padStart(2, '0')}`)
        iter.setMonth(iter.getMonth() + 1)
      }

      // Spread miles evenly across months in the gap
      const milesPerMonth = milesDriven / months.length
      for (const month of months) {
        monthlyMilesRaw.push({
          month,
          vehicleId: vId,
          vehicleName: vName,
          miles: Math.round(milesPerMonth * 10) / 10,
        })
      }
    }
  }

  // Aggregate by vehicle + month (a month may have multiple fillup segments)
  const monthlyMilesAgg = new Map<string, MonthlyMilesPoint>()
  for (const point of monthlyMilesRaw) {
    const key = `${point.vehicleId}-${point.month}`
    const existing = monthlyMilesAgg.get(key)
    if (existing) {
      existing.miles = Math.round((existing.miles + point.miles) * 10) / 10
    } else {
      monthlyMilesAgg.set(key, { ...point })
    }
  }

  const monthlyMiles = Array.from(monthlyMilesAgg.values())
    .sort((a, b) => a.month.localeCompare(b.month))

  // Assign colors to vehicles - always return ALL vehicles for the dropdown
  const vehiclesWithColors = vehicles.map((v, i) => ({
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
    kpiStats,
    monthlyMiles,
  })
}
