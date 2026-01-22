'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  addToQueue,
  getQueue,
  getQueueCount,
  type PendingFillup
} from '@/lib/offlineDb'
import { syncPendingFillups, type SyncResult, type SyncOptions } from '@/lib/syncEngine'

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

interface UseOfflineQueueOptions {
  onSyncComplete?: (syncedCount: number, results: SyncResult[]) => void
}

interface UseOfflineQueueReturn {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  lastSyncError: string | null
  lastSyncTime: Date | null
  queueFillup: (data: FillupData) => Promise<PendingFillup>
  syncQueue: (options?: SyncOptions) => Promise<{ syncedCount: number; results: SyncResult[] }>
  getPendingFillups: () => Promise<PendingFillup[]>
  refreshPendingCount: () => Promise<void>
}

export function useOfflineQueue(options?: UseOfflineQueueOptions): UseOfflineQueueReturn {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  // Track if sync is already in progress to prevent duplicate syncs
  const syncInProgress = useRef(false)
  // Track previous online state for detecting reconnection
  const wasOfflineRef = useRef(false)

  // Update pending count from IndexedDB
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getQueueCount()
      setPendingCount(count)
    } catch {
      console.error('Failed to get pending count')
    }
  }, [])

  // Get all pending fillups for UI display
  const getPendingFillups = useCallback(async (): Promise<PendingFillup[]> => {
    try {
      return await getQueue()
    } catch {
      console.error('Failed to get pending fillups')
      return []
    }
  }, [])

  // Sync all queued fillups to the server using syncEngine
  const syncQueue = useCallback(async (
    syncOptions?: SyncOptions
  ): Promise<{ syncedCount: number; results: SyncResult[] }> => {
    if (syncInProgress.current || !isOnline) {
      return { syncedCount: 0, results: [] }
    }

    syncInProgress.current = true
    setIsSyncing(true)
    setLastSyncError(null)

    try {
      const { results, syncedCount } = await syncPendingFillups(syncOptions)

      // Check for any errors in results
      const failedResults = results.filter(r => !r.success)
      if (failedResults.length > 0) {
        setLastSyncError(failedResults[0].error || 'Some fillups failed to sync')
      }

      // Update last sync time
      setLastSyncTime(new Date())

      // Refresh count after sync
      await refreshPendingCount()

      // Call completion callback if provided
      if (options?.onSyncComplete && syncedCount > 0) {
        options.onSyncComplete(syncedCount, results)
      }

      return { syncedCount, results }
    } finally {
      syncInProgress.current = false
      setIsSyncing(false)
    }
  }, [isOnline, refreshPendingCount, options])

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Auto-sync when connection restored (if was offline)
      if (wasOfflineRef.current) {
        syncQueue()
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      wasOfflineRef.current = true
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
    lastSyncTime,
    queueFillup,
    syncQueue,
    getPendingFillups,
    refreshPendingCount
  }
}
