import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { saveVehiclePhoto, deleteVehiclePhoto, validateFile } from '@/lib/upload'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/vehicles/[id]/photo
 * Upload a photo for a vehicle
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id } = await context.params

  // Get vehicle
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

  // Parse form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: 'Invalid form data' },
      { status: 400 }
    )
  }

  const file = formData.get('photo')

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'No photo provided' },
      { status: 400 }
    )
  }

  // Validate file
  const validation = validateFile(file)
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    )
  }

  try {
    // Delete old photo if exists
    if (vehicle.photoUrl) {
      await deleteVehiclePhoto(vehicle.photoUrl)
    }

    // Save new photo
    const photoUrl = await saveVehiclePhoto(id, file)

    // Update vehicle in database
    await prisma.vehicle.update({
      where: { id },
      data: { photoUrl }
    })

    return NextResponse.json({ photoUrl })
  } catch (error) {
    console.error('Error uploading photo:', error)
    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/vehicles/[id]/photo
 * Remove the photo from a vehicle
 */
export async function DELETE(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id } = await context.params

  // Get vehicle
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

  try {
    // Delete file if exists
    if (vehicle.photoUrl) {
      await deleteVehiclePhoto(vehicle.photoUrl)
    }

    // Clear photoUrl in database
    await prisma.vehicle.update({
      where: { id },
      data: { photoUrl: null }
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting photo:', error)
    return NextResponse.json(
      { error: 'Failed to delete photo' },
      { status: 500 }
    )
  }
}
