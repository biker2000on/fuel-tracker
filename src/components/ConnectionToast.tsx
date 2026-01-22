'use client'

import { useEffect, useState, useRef } from 'react'
import { useOffline } from '@/contexts/OfflineContext'

type ToastType = 'offline' | 'online' | 'synced'

export function ConnectionToast() {
  const { isOnline, wasOffline, lastSyncedCount, clearSyncNotification } = useOffline()
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [toastType, setToastType] = useState<ToastType>('online')
  const previousOnlineRef = useRef<boolean | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handle connection status changes
  useEffect(() => {
    // Skip the initial render - only show toast on actual changes
    if (previousOnlineRef.current === null) {
      previousOnlineRef.current = isOnline
      return
    }

    // Only react to actual changes
    if (previousOnlineRef.current === isOnline) {
      return
    }

    previousOnlineRef.current = isOnline

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (!isOnline) {
      // Going offline
      setMessage("You're offline")
      setToastType('offline')
      setVisible(true)
    } else if (wasOffline) {
      // Coming back online (and was previously offline)
      setMessage('Back online')
      setToastType('online')
      setVisible(true)
    }

    // Auto-dismiss after 3 seconds
    timeoutRef.current = setTimeout(() => {
      setVisible(false)
    }, 3000)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isOnline, wasOffline])

  // Handle sync completion notification
  useEffect(() => {
    if (lastSyncedCount !== null && lastSyncedCount > 0) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Show sync success message
      const fillupWord = lastSyncedCount === 1 ? 'fillup' : 'fillups'
      setMessage(`${lastSyncedCount} ${fillupWord} synced`)
      setToastType('synced')
      setVisible(true)

      // Auto-dismiss after 3 seconds and clear notification
      timeoutRef.current = setTimeout(() => {
        setVisible(false)
        clearSyncNotification()
      }, 3000)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [lastSyncedCount, clearSyncNotification])

  if (!visible) {
    return null
  }

  // Style based on toast type
  const getToastStyles = () => {
    switch (toastType) {
      case 'offline':
        return 'bg-amber-500 text-amber-950 dark:bg-amber-600 dark:text-amber-50'
      case 'online':
        return 'bg-green-500 text-green-950 dark:bg-green-600 dark:text-green-50'
      case 'synced':
        return 'bg-blue-500 text-blue-950 dark:bg-blue-600 dark:text-blue-50'
    }
  }

  const getToastIcon = () => {
    switch (toastType) {
      case 'offline':
        return (
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a5 5 0 000-7.072M9.172 14.828a5 5 0 010-7.072m-3.536 10.608a9 9 0 010-12.728"
            />
            <line x1="4" y1="4" x2="20" y2="20" strokeWidth={2} strokeLinecap="round" />
          </svg>
        )
      case 'online':
        return (
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
            />
          </svg>
        )
      case 'synced':
        return (
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )
    }
  }

  return (
    <div
      className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 animate-fade-in-up rounded-lg px-4 py-3 shadow-lg ${getToastStyles()}`}
    >
      <div className="flex items-center gap-2">
        {getToastIcon()}
        <span className="font-medium">{message}</span>
      </div>
    </div>
  )
}
