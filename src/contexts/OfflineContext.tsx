'use client'

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

interface OfflineContextValue {
  isOnline: boolean
  wasOffline: boolean
  pendingCount: number
  isSyncing: boolean
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined)

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { isOnline, wasOffline } = useNetworkStatus()

  // pendingCount and isSyncing will be wired to sync engine in Plan 11-03
  // For now, default to 0 and false
  const pendingCount = 0
  const isSyncing = false

  return (
    <OfflineContext.Provider value={{ isOnline, wasOffline, pendingCount, isSyncing }}>
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
