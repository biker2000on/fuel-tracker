import { NextResponse } from 'next/server'
import { authenticateApiRequest } from '@/lib/apiAuth'
import { prisma } from '@/lib/db'

/**
 * GET /api/v1/vehicles
 *
 * Read-only list of all vehicles visible to the token's user (their groups),
 * including retired vehicles (flagged via retiredAt).
 */
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: auth.userId },
    select: { groupId: true },
  })

  if (memberships.length === 0) {
    return NextResponse.json({ vehicles: [] })
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { groupId: { in: memberships.map((m) => m.groupId) } },
    include: { group: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    vehicles: vehicles.map((v) => ({
      id: v.id,
      name: v.name,
      year: v.year,
      make: v.make,
      model: v.model,
      tankSize: v.tankSize,
      fuelType: v.fuelType,
      retiredAt: v.retiredAt ? v.retiredAt.toISOString() : null,
      groupId: v.groupId,
      groupName: v.group.name,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    })),
  })
}
