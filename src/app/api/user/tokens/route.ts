import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { generateApiToken, hashApiToken } from '@/lib/apiAuth'

/** GET /api/user/tokens - list the current user's API tokens (no secrets). */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tokens = await prisma.apiToken.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
  })

  return NextResponse.json({
    tokens: tokens.map((t) => ({
      id: t.id,
      name: t.name,
      createdAt: t.createdAt.toISOString(),
      lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
    })),
  })
}

/**
 * POST /api/user/tokens - create a token. The plaintext token is returned
 * exactly once in this response and never stored.
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = (body.name || '').trim()
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (name.length > 50) {
    return NextResponse.json({ error: 'Name must be 50 characters or less' }, { status: 400 })
  }

  const token = generateApiToken()
  const created = await prisma.apiToken.create({
    data: {
      name,
      tokenHash: hashApiToken(token),
      userId: session.user.id,
    },
    select: { id: true, name: true, createdAt: true },
  })

  return NextResponse.json(
    {
      id: created.id,
      name: created.name,
      createdAt: created.createdAt.toISOString(),
      token, // shown once
    },
    { status: 201 }
  )
}
