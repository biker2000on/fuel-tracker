'use client'

import { useOffline } from '@/contexts/OfflineContext'

export function OfflineIndicator() {
  const { isOnline } = useOffline()

  // Only render when offline
  if (isOnline) {
    return null
  }

  return (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 shadow-md dark:bg-amber-900 dark:text-amber-100">
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
        />
        <line x1="4" y1="4" x2="20" y2="20" strokeWidth={2} strokeLinecap="round" />
      </svg>
      <span>Offline</span>
    </div>
  )
}
