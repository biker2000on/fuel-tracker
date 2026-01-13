import { mkdir, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { createId } from '@paralleldrive/cuid2'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'vehicles')
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate file type and size
 */
export function validateFile(file: File): ValidationResult {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: jpeg, png, webp`
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: 5MB`
    }
  }

  return { valid: true }
}

/**
 * Get file extension from mime type
 */
function getExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  }
  return extensions[mimeType] || 'jpg'
}

/**
 * Save a vehicle photo to the uploads directory
 * @param vehicleId The ID of the vehicle
 * @param file The uploaded file
 * @returns The URL path to the saved file
 */
export async function saveVehiclePhoto(vehicleId: string, file: File): Promise<string> {
  // Ensure upload directory exists
  await mkdir(UPLOAD_DIR, { recursive: true })

  // Generate unique filename
  const extension = getExtension(file.type)
  const filename = `${vehicleId}-${createId()}.${extension}`
  const filePath = path.join(UPLOAD_DIR, filename)

  // Convert File to Buffer and write
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  // Return URL path (not filesystem path)
  return `/uploads/vehicles/${filename}`
}

/**
 * Delete a vehicle photo from the uploads directory
 * @param photoUrl The URL path of the photo (e.g., /uploads/vehicles/filename.jpg)
 */
export async function deleteVehiclePhoto(photoUrl: string): Promise<void> {
  if (!photoUrl || !photoUrl.startsWith('/uploads/vehicles/')) {
    return
  }

  // Extract filename from URL path
  const filename = photoUrl.replace('/uploads/vehicles/', '')
  const filePath = path.join(UPLOAD_DIR, filename)

  try {
    await unlink(filePath)
  } catch (error) {
    // File might not exist, ignore errors
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Error deleting photo:', error)
    }
  }
}
