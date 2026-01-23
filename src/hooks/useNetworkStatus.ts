'use client'

import { useState, useEffect, useRef } from 'react'

interface NetworkStatus {
  isOnline: boolean
  wasOffline: boolean
}

export function useNetworkStatus(): NetworkStatus {
  // Initialize to true to avoid hydration mismatch - SSR always assumes online
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [wasOffline, setWasOffline] = useState<boolean>(false)
  const previousOnlineRef = useRef<boolean>(true)
  const mountedRef = useRef<boolean>(false)

  // Set correct initial value after mount to avoid hydration mismatch
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      const online = navigator.onLine
      setIsOnline(online)
      previousOnlineRef.current = online
    }
  }, [])

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
