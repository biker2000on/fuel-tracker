/**
 * Sync engine with retry and exponential backoff for offline fillup queue
 */

import { getQueue, removeFromQueue, type PendingFillup } from './offlineDb'

export interface SyncResult {
  success: boolean
  pendingId: string
  error?: string
  retryCount: number
}

export interface SyncOptions {
  maxRetries?: number   // default: 3
  baseDelay?: number    // default: 1000ms
  maxDelay?: number     // default: 30000ms
}

const DEFAULT_OPTIONS: Required<SyncOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000
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
 * Sync a single fillup to the server with retry logic
 */
export async function syncSingleFillup(
  pending: PendingFillup,
  options?: SyncOptions
): Promise<SyncResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: string | undefined
  let retryCount = 0

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
