'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import type { SyncResult, SyncOptions, Conflict, ConflictResolution } from '@/lib/syncEngine'
import { resolveConflict } from '@/lib/syncEngine'

interface OfflineContextValue {
  isOnline: boolean
  wasOffline: boolean
  pendingCount: number
  isSyncing: boolean
  syncQueue: (options?: SyncOptions) => Promise<{ syncedCount: number; results: SyncResult[] }>
  refreshPendingCount: () => Promise<void>
  // Sync notification state
  lastSyncedCount: number | null
  clearSyncNotification: () => void
  // Conflict handling
  activeConflict: Conflict | null
  handleConflictResolution: (resolution: ConflictResolution) => Promise<void>
  dismissConflict: () => void
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined)

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { isOnline, wasOffline } = useNetworkStatus()
  const [lastSyncedCount, setLastSyncedCount] = useState<number | null>(null)
  const [activeConflict, setActiveConflict] = useState<Conflict | null>(null)

  // Handle sync completion - show notification when items synced after coming back online
  const handleSyncComplete = useCallback((syncedCount: number, results: SyncResult[]) => {
    if (wasOffline && syncedCount > 0) {
      setLastSyncedCount(syncedCount)
    }
    // Check for conflicts in results
    const conflictResult = results.find(r => r.conflict)
    if (conflictResult?.conflict) {
      setActiveConflict(conflictResult.conflict)
    }
  }, [wasOffline])

  const clearSyncNotification = useCallback(() => {
    setLastSyncedCount(null)
  }, [])

  const dismissConflict = useCallback(() => {
    setActiveConflict(null)
  }, [])

  const {
    pendingCount,
    isSyncing,
    syncQueue,
    refreshPendingCount
  } = useOfflineQueue({
    onSyncComplete: handleSyncComplete
  })

  const handleConflictResolution = useCallback(async (resolution: ConflictResolution) => {
    if (!activeConflict) return

    await resolveConflict(activeConflict, resolution)
    setActiveConflict(null)
    await refreshPendingCount()

    // Try syncing remaining items
    await syncQueue({ checkConflicts: true })
  }, [activeConflict, refreshPendingCount, syncQueue])

  return (
    <OfflineContext.Provider value={{
      isOnline,
      wasOffline,
      pendingCount,
      isSyncing,
      syncQueue,
      refreshPendingCount,
      lastSyncedCount,
      clearSyncNotification,
      activeConflict,
      handleConflictResolution,
      dismissConflict
    }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOffline() {
  const context = useContext(OfflineContext)
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider')
  }
  return context
}
