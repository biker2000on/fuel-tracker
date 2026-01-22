/**
 * IndexedDB operations for offline fillup queue and data caching
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

// Type for cached vehicle data
export interface CachedVehicle {
  id: string
  name: string
  year: number
  make: string
  model: string
  tankSize: number | null
  fuelType: string
  photoUrl: string | null
  groupId: string
  groupName: string
  createdAt: string
  updatedAt: string
}

// Type for cached fillup data
export interface CachedFillup {
  id: string
  date: string
  gallons: number
  totalCost: number
  pricePerGallon: number
  odometer: number
  mpg: number | null
  city: string | null
  state: string | null
}

const QUEUE_PREFIX = 'pending-fillup-'
const CACHED_VEHICLES_KEY = 'cached-vehicles'
const CACHED_FILLUPS_PREFIX = 'cached-fillups-'
const CACHE_TIMESTAMP_PREFIX = 'cache-timestamp-'
const MAX_CACHED_FILLUPS = 10

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

// =============================================================================
// Vehicle Caching
// =============================================================================

/**
 * Cache the full vehicle list for offline viewing
 */
export async function cacheVehicles(vehicles: CachedVehicle[]): Promise<void> {
  await set(CACHED_VEHICLES_KEY, vehicles)
  await setCacheTimestamp(CACHED_VEHICLES_KEY)
}

/**
 * Retrieve cached vehicles
 */
export async function getCachedVehicles(): Promise<CachedVehicle[] | null> {
  const vehicles = await get<CachedVehicle[]>(CACHED_VEHICLES_KEY)
  return vehicles || null
}

// =============================================================================
// Fillup Caching (per vehicle)
// =============================================================================

/**
 * Cache fillups for a specific vehicle (stores last N fillups)
 */
export async function cacheFillups(vehicleId: string, fillups: CachedFillup[]): Promise<void> {
  // Only cache the most recent fillups to limit storage
  const recentFillups = fillups.slice(0, MAX_CACHED_FILLUPS)
  const key = `${CACHED_FILLUPS_PREFIX}${vehicleId}`
  await set(key, recentFillups)
  await setCacheTimestamp(key)
}

/**
 * Retrieve cached fillups for a specific vehicle
 */
export async function getCachedFillups(vehicleId: string): Promise<CachedFillup[] | null> {
  const key = `${CACHED_FILLUPS_PREFIX}${vehicleId}`
  const fillups = await get<CachedFillup[]>(key)
  return fillups || null
}

// =============================================================================
// Cache Metadata
// =============================================================================

/**
 * Record when data was cached (for showing "Last updated X minutes ago")
 */
export async function setCacheTimestamp(key: string): Promise<void> {
  await set(`${CACHE_TIMESTAMP_PREFIX}${key}`, Date.now())
}

/**
 * Get the timestamp when data was cached
 */
export async function getCacheTimestamp(key: string): Promise<number | null> {
  const timestamp = await get<number>(`${CACHE_TIMESTAMP_PREFIX}${key}`)
  return timestamp || null
}

/**
 * Get the age of cached data in milliseconds
 */
export async function getCacheAge(key: string): Promise<number | null> {
  const timestamp = await getCacheTimestamp(key)
  if (timestamp === null) return null
  return Date.now() - timestamp
}
