'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { OfflineProvider, useOffline } from '@/contexts/OfflineContext'
import { ConnectionToast } from '@/components/ConnectionToast'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { ConflictResolver } from '@/components/ConflictResolver'

function OfflineUIComponents() {
  const { activeConflict, handleConflictResolution, dismissConflict } = useOffline()

  return (
    <>
      <ConnectionToast />
      <OfflineIndicator />
      {activeConflict && (
        <ConflictResolver
          conflict={activeConflict}
          onResolve={handleConflictResolution}
          onCancel={dismissConflict}
        />
      )}
    </>
  )
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <OfflineProvider>
          {children}
          <OfflineUIComponents />
        </OfflineProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
