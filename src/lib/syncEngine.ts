/**
 * Sync engine with retry, exponential backoff, and conflict detection
 * for offline fillup queue
 */

import { getQueue, removeFromQueue, type PendingFillup } from './offlineDb'

export interface SyncResult {
  success: boolean
  pendingId: string
  error?: string
  retryCount: number
  conflict?: Conflict  // Present if sync blocked by conflict
}

export interface SyncOptions {
  maxRetries?: number   // default: 3
  baseDelay?: number    // default: 1000ms
  maxDelay?: number     // default: 30000ms
  checkConflicts?: boolean  // default: true
}

// Conflict detection types
export interface ServerFillup {
  id: string
  date: string
  gallons: number
  odometer: number
  createdAt: string
}

export interface Conflict {
  pendingFillup: PendingFillup
  serverFillups: ServerFillup[]
  reason: 'odometer_overlap' | 'potential_duplicate'
}

export type ConflictResolution = 'keep_mine' | 'keep_server' | 'keep_both'

const DEFAULT_OPTIONS: Required<SyncOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  checkConflicts: true
}

/**
 * Calculate backoff delay with exponential formula
 * Formula: min(baseDelay * 2^attempt, maxDelay)
 */
function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = baseDelay * Math.pow(2, attempt)
  return Math.min(delay, maxDelay)
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if an error is retryable (network error or 5xx server error)
 */
function isRetryableError(error: unknown, statusCode?: number): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }
  // 5xx server errors are retryable
  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return true
  }
  // Generic network errors
  if (error instanceof Error && (
    error.message.includes('network') ||
    error.message.includes('Network') ||
    error.message.includes('Failed to fetch')
  )) {
    return true
  }
  return false
}

/**
 * Check if a pending fillup conflicts with server data
 * Conflict occurs if server has newer fillups that might affect MPG calculation
 */
export async function checkForConflicts(
  pending: PendingFillup
): Promise<Conflict | null> {
  try {
    // Get fillups from server since the pending fillup was queued
    const since = encodeURIComponent(pending.createdAt)
    const response = await fetch(
      `/api/fillups?vehicleId=${pending.data.vehicleId}&since=${since}&limit=10`
    )

    if (!response.ok) {
      // If we can't check for conflicts, proceed without blocking
      return null
    }

    const data = await response.json()
    const serverFillups: ServerFillup[] = data.fillups || []

    if (serverFillups.length === 0) {
      // No new fillups on server since queuing - no conflict
      return null
    }

    // Check for odometer conflicts
    // If server has fillups with odometer readings near our pending fillup's odometer,
    // this could indicate a duplicate or conflicting entry
    const conflictingFillups = serverFillups.filter(sf => {
      const odometerDiff = Math.abs(sf.odometer - pending.data.odometer)
      // Consider it a conflict if odometers are within 50 miles
      // (likely same fillup entered from another device)
      if (odometerDiff < 50) {
        return true
      }
      // Also conflict if dates match closely
      const pendingDate = new Date(pending.data.date).getTime()
      const serverDate = new Date(sf.date).getTime()
      const oneDayMs = 24 * 60 * 60 * 1000
      if (Math.abs(pendingDate - serverDate) < oneDayMs && odometerDiff < 200) {
        return true
      }
      return false
    })

    if (conflictingFillups.length > 0) {
      // Check if it's likely a duplicate
      const isDuplicate = conflictingFillups.some(sf => {
        const odometerMatch = Math.abs(sf.odometer - pending.data.odometer) < 5
        const gallonsMatch = Math.abs(sf.gallons - pending.data.gallons) < 0.5
        return odometerMatch && gallonsMatch
      })

      return {
        pendingFillup: pending,
        serverFillups: conflictingFillups,
        reason: isDuplicate ? 'potential_duplicate' : 'odometer_overlap'
      }
    }

    return null
  } catch {
    // If conflict check fails, don't block sync
    return null
  }
}

/**
 * Resolve a conflict based on user's choice
 */
export async function resolveConflict(
  conflict: Conflict,
  resolution: ConflictResolution
): Promise<SyncResult> {
  const pending = conflict.pendingFillup

  switch (resolution) {
    case 'keep_mine':
      // Proceed with sync - server will recalculate MPG
      return syncSingleFillup(pending, { checkConflicts: false })

    case 'keep_server':
      // Remove from queue, don't sync
      await removeFromQueue(pending.id)
      return {
        success: true,
        pendingId: pending.id,
        retryCount: 0
      }

    case 'keep_both':
      // Sync the pending fillup as-is
      return syncSingleFillup(pending, { checkConflicts: false })

    default:
      return {
        success: false,
        pendingId: pending.id,
        error: 'Invalid resolution',
        retryCount: 0
      }
  }
}

/**
 * Sync a single fillup to the server with retry logic
 */
export async function syncSingleFillup(
  pending: PendingFillup,
  options?: SyncOptions
): Promise<SyncResult> {
  const opts = { ...DEFAULT_OPTIONS, checkConflicts: true, ...options }
  let lastError: string | undefined
  let retryCount = 0

  // Check for conflicts before syncing (unless explicitly disabled)
  if (opts.checkConflicts) {
    const conflict = await checkForConflicts(pending)
    if (conflict) {
      return {
        success: false,
        pendingId: pending.id,
        error: 'Conflict detected - requires resolution',
        retryCount: 0,
        conflict
      }
    }
  }

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const response = await fetch('/api/fillups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending.data)
      })

      if (response.ok) {
        return {
          success: true,
          pendingId: pending.id,
          retryCount
        }
      }

      // 4xx client errors - don't retry
      if (response.status >= 400 && response.status < 500) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          pendingId: pending.id,
          error: errorData.error || `Client error: ${response.status}`,
          retryCount
        }
      }

      // 5xx server errors - retry with backoff
      if (response.status >= 500) {
        lastError = `Server error: ${response.status}`
        if (attempt < opts.maxRetries) {
          const delay = calculateBackoff(attempt, opts.baseDelay, opts.maxDelay)
          await sleep(delay)
          retryCount++
        }
        continue
      }

      // Other unexpected status codes
      lastError = `Unexpected response: ${response.status}`

    } catch (error) {
      // Network errors - retry with backoff if retryable
      const errorMessage = error instanceof Error ? error.message : 'Network error during sync'
      lastError = errorMessage

      if (isRetryableError(error) && attempt < opts.maxRetries) {
        const delay = calculateBackoff(attempt, opts.baseDelay, opts.maxDelay)
        await sleep(delay)
        retryCount++
        continue
      }

      // Non-retryable error
      return {
        success: false,
        pendingId: pending.id,
        error: errorMessage,
        retryCount
      }
    }
  }

  // Exhausted all retries
  return {
    success: false,
    pendingId: pending.id,
    error: lastError || 'Max retries exceeded',
    retryCount
  }
}

/**
 * Sync all pending fillups from the queue
 * Processes sequentially to maintain order
 */
export async function syncPendingFillups(
  options?: SyncOptions
): Promise<{ results: SyncResult[]; syncedCount: number }> {
  const pendingFillups = await getQueue()
  const results: SyncResult[] = []
  let syncedCount = 0

  // Process sequentially to maintain chronological order
  for (const pending of pendingFillups) {
    const result = await syncSingleFillup(pending, options)
    results.push(result)

    if (result.success) {
      // Remove successfully synced item from queue
      await removeFromQueue(pending.id)
      syncedCount++
    }
    // Failed items remain in queue for later retry
  }

  return { results, syncedCount }
}
