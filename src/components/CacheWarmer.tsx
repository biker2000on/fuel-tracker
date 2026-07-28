'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

/**
 * Asks the service worker to warm its offline caches (core pages + API data)
 * once the user is authenticated and online. The SW throttles repeat requests,
 * so posting on every app load is cheap.
 */
export function CacheWarmer() {
  const { status } = useSession()

  useEffect(() => {
    if (status !== 'authenticated') return
    if (
      typeof navigator === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !navigator.onLine
    ) {
      return
    }

    navigator.serviceWorker.ready
      .then((registration) => {
        registration.active?.postMessage({ type: 'WARM_CACHE' })
      })
      .catch(() => {})
  }, [status])

  return null
}
