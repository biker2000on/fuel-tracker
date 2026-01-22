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
import type { SyncResult, SyncOptions } from '@/lib/syncEngine'

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
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined)

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { isOnline, wasOffline } = useNetworkStatus()
  const [lastSyncedCount, setLastSyncedCount] = useState<number | null>(null)

  // Handle sync completion - show notification when items synced after coming back online
  const handleSyncComplete = useCallback((syncedCount: number) => {
    if (wasOffline && syncedCount > 0) {
      setLastSyncedCount(syncedCount)
    }
  }, [wasOffline])

  const clearSyncNotification = useCallback(() => {
    setLastSyncedCount(null)
  }, [])

  const {
    pendingCount,
    isSyncing,
    syncQueue,
    refreshPendingCount
  } = useOfflineQueue({
    onSyncComplete: handleSyncComplete
  })

  return (
    <OfflineContext.Provider value={{
      isOnline,
      wasOffline,
      pendingCount,
      isSyncing,
      syncQueue,
      refreshPendingCount,
      lastSyncedCount,
      clearSyncNotification
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
