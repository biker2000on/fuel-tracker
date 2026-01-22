'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { OfflineProvider } from '@/contexts/OfflineContext'
import { ConnectionToast } from '@/components/ConnectionToast'
import { OfflineIndicator } from '@/components/OfflineIndicator'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <OfflineProvider>
          {children}
          <ConnectionToast />
          <OfflineIndicator />
        </OfflineProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
