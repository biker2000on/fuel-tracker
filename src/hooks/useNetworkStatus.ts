'use client'

import { useState, useEffect, useRef } from 'react'

interface NetworkStatus {
  isOnline: boolean
  wasOffline: boolean
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [wasOffline, setWasOffline] = useState<boolean>(false)
  const previousOnlineRef = useRef<boolean>(isOnline)

  useEffect(() => {
    const handleOnline = () => {
      // Track that user was previously offline (for "back online" detection)
      if (!previousOnlineRef.current) {
        setWasOffline(true)
      }
      setIsOnline(true)
      previousOnlineRef.current = true
    }

    const handleOffline = () => {
      setIsOnline(false)
      previousOnlineRef.current = false
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, wasOffline }
}
