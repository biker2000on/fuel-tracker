'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  addToQueue,
  getQueue,
  removeFromQueue,
  getQueueCount,
  type PendingFillup
} from '@/lib/offlineDb'

interface FillupData {
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

interface SyncResult {
  success: boolean
  pendingId: string
  error?: string
}

interface UseOfflineQueueReturn {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  lastSyncError: string | null
  queueFillup: (data: FillupData) => Promise<PendingFillup>
  syncQueue: () => Promise<SyncResult[]>
}

export function useOfflineQueue(): UseOfflineQueueReturn {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)

  // Track if sync is already in progress to prevent duplicate syncs
  const syncInProgress = useRef(false)

  // Update pending count from IndexedDB
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getQueueCount()
      setPendingCount(count)
    } catch {
      console.error('Failed to get pending count')
    }
  }, [])

  // Sync all queued fillups to the server
  const syncQueue = useCallback(async (): Promise<SyncResult[]> => {
    if (syncInProgress.current || !isOnline) {
      return []
    }

    syncInProgress.current = true
    setIsSyncing(true)
    setLastSyncError(null)

    const results: SyncResult[] = []

    try {
      const pendingFillups = await getQueue()

      for (const pending of pendingFillups) {
        try {
          const response = await fetch('/api/fillups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pending.data)
          })

          if (response.ok) {
            // Successfully synced - remove from queue
            await removeFromQueue(pending.id)
            results.push({ success: true, pendingId: pending.id })
          } else {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || `Server error: ${response.status}`
            results.push({
              success: false,
              pendingId: pending.id,
              error: errorMessage
            })
            // Keep in queue for retry later
            setLastSyncError(errorMessage)
          }
        } catch (error) {
          // Network error - keep in queue for retry
          const errorMessage = error instanceof Error
            ? error.message
            : 'Network error during sync'
          results.push({
            success: false,
            pendingId: pending.id,
            error: errorMessage
          })
          setLastSyncError(errorMessage)
        }
      }

      // Refresh count after sync
      await refreshPendingCount()
    } finally {
      syncInProgress.current = false
      setIsSyncing(false)
    }

    return results
  }, [isOnline, refreshPendingCount])

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Auto-sync when connection restored
      syncQueue()
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial count load
    refreshPendingCount()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncQueue, refreshPendingCount])

  // Queue a fillup for later sync
  const queueFillup = useCallback(async (data: FillupData): Promise<PendingFillup> => {
    const pending = await addToQueue(data)
    await refreshPendingCount()
    return pending
  }, [refreshPendingCount])

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncError,
    queueFillup,
    syncQueue
  }
}
