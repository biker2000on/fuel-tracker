/**
 * IndexedDB operations for offline fillup queue
 * Uses idb-keyval for simple key-value storage
 */

import { get, set, del, keys } from 'idb-keyval'

// Type for a pending fillup stored in the queue
export interface PendingFillup {
  id: string
  createdAt: string // ISO string for when it was queued
  data: {
    vehicleId: string
    date: string
    gallons: number
    pricePerGallon: number
    odometer: number
    isFull: boolean
    notes: string | null
    latitude: number | null
    longitude: number | null
    city: string | null
    state: string | null
    country: string | null
  }
}

const QUEUE_PREFIX = 'pending-fillup-'

/**
 * Generate a unique ID for a pending fillup
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Add a fillup to the offline queue
 */
export async function addToQueue(fillupData: PendingFillup['data']): Promise<PendingFillup> {
  const pendingFillup: PendingFillup = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    data: fillupData
  }

  await set(`${QUEUE_PREFIX}${pendingFillup.id}`, pendingFillup)
  return pendingFillup
}

/**
 * Get all pending fillups from the queue
 */
export async function getQueue(): Promise<PendingFillup[]> {
  const allKeys = await keys()
  const queueKeys = allKeys.filter(key =>
    typeof key === 'string' && key.startsWith(QUEUE_PREFIX)
  )

  const pendingFillups: PendingFillup[] = []

  for (const key of queueKeys) {
    const item = await get<PendingFillup>(key as string)
    if (item) {
      pendingFillups.push(item)
    }
  }

  // Sort by creation time (oldest first for FIFO processing)
  return pendingFillups.sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
}

/**
 * Remove a specific fillup from the queue
 */
export async function removeFromQueue(id: string): Promise<void> {
  await del(`${QUEUE_PREFIX}${id}`)
}

/**
 * Clear all pending fillups from the queue
 */
export async function clearQueue(): Promise<void> {
  const allKeys = await keys()
  const queueKeys = allKeys.filter(key =>
    typeof key === 'string' && key.startsWith(QUEUE_PREFIX)
  )

  for (const key of queueKeys) {
    await del(key as string)
  }
}

/**
 * Get the count of pending fillups
 */
export async function getQueueCount(): Promise<number> {
  const allKeys = await keys()
  return allKeys.filter(key =>
    typeof key === 'string' && key.startsWith(QUEUE_PREFIX)
  ).length
}
