import { NextResponse } from 'next/server'
import { authenticateApiRequest, getVisibleVehicleIds } from '@/lib/apiAuth'
import { prisma } from '@/lib/db'

const MAX_LIMIT = 500
const DEFAULT_LIMIT = 100

/**
 * GET /api/v1/fillups
 *
 * Read-only fillup export for external consumers (e.g. gnucash-web).
 *
 * Query params:
 * - vehicleId  restrict to one vehicle (must be visible to the token's user)
 * - since      ISO date/datetime, inclusive lower bound on fillup date
 * - until      ISO date/datetime, exclusive upper bound on fillup date
 * - updatedSince ISO date/datetime, filter on updatedAt (for incremental sync)
 * - limit      page size, default 100, max 500
 * - cursor     opaque cursor from the previous page (nextCursor)
 *
 * Ordered oldest-first by (date, id) so incremental consumers can page
 * forward deterministically. Response: { fillups: [...], nextCursor }.
 */
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const vehicleId = url.searchParams.get('vehicleId')
  const since = url.searchParams.get('since')
  const until = url.searchParams.get('until')
  const updatedSince = url.searchParams.get('updatedSince')
  const cursor = url.searchParams.get('cursor')

  let limit = parseInt(url.searchParams.get('limit') || `${DEFAULT_LIMIT}`, 10)
  if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT
  if (limit > MAX_LIMIT) limit = MAX_LIMIT

  function parseDate(value: string | null, label: string): Date | null | NextResponse {
    if (!value) return null
    const d = new Date(value)
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: `Invalid ${label} date` }, { status: 400 })
    }
    return d
  }

  const sinceDate = parseDate(since, 'since')
  if (sinceDate instanceof NextResponse) return sinceDate
  const untilDate = parseDate(until, 'until')
  if (untilDate instanceof NextResponse) return untilDate
  const updatedSinceDate = parseDate(updatedSince, 'updatedSince')
  if (updatedSinceDate instanceof NextResponse) return updatedSinceDate

  const visibleVehicleIds = await getVisibleVehicleIds(auth.userId)
  if (visibleVehicleIds.length === 0) {
    return NextResponse.json({ fillups: [], nextCursor: null })
  }

  if (vehicleId && !visibleVehicleIds.includes(vehicleId)) {
    return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
  }

  const where = {
    vehicleId: vehicleId ? vehicleId : { in: visibleVehicleIds },
    ...(sinceDate || untilDate
      ? { date: { ...(sinceDate ? { gte: sinceDate } : {}), ...(untilDate ? { lt: untilDate } : {}) } }
      : {}),
    ...(updatedSinceDate ? { updatedAt: { gte: updatedSinceDate } } : {}),
  }

  const fillups = await prisma.fillup.findMany({
    where,
    include: { vehicle: { select: { name: true } } },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = fillups.length > limit
  const page = hasMore ? fillups.slice(0, limit) : fillups

  return NextResponse.json({
    fillups: page.map((f) => ({
      id: f.id,
      date: f.date.toISOString(),
      gallons: f.gallons,
      pricePerGallon: f.pricePerGallon,
      totalCost: f.totalCost,
      odometer: f.odometer,
      mpg: f.mpg,
      isFull: f.isFull,
      notes: f.notes,
      latitude: f.latitude,
      longitude: f.longitude,
      city: f.city,
      state: f.state,
      country: f.country,
      vehicleId: f.vehicleId,
      vehicleName: f.vehicle.name,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  })
}
