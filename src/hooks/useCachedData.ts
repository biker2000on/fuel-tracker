'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  cacheVehicles,
  getCachedVehicles,
  cacheFillups,
  getCachedFillups,
  getCacheAge,
  type CachedVehicle,
  type CachedFillup
} from '@/lib/offlineDb'
import { useOffline } from '@/contexts/OfflineContext'

interface UseCachedDataOptions {
  vehicleId?: string  // for vehicle-specific fillups
}

interface UseCachedDataReturn {
  vehicles: CachedVehicle[] | null
  fillups: CachedFillup[] | null
  isFromCache: boolean
  cacheAge: number | null  // milliseconds since cache
  isLoading: boolean
  error: string | null
  refreshCache: () => Promise<void>
}

const CACHED_VEHICLES_KEY = 'cached-vehicles'
const CACHED_FILLUPS_PREFIX = 'cached-fillups-'

export function useCachedData(options: UseCachedDataOptions = {}): UseCachedDataReturn {
  const { vehicleId } = options
  const { isOnline } = useOffline()

  const [vehicles, setVehicles] = useState<CachedVehicle[] | null>(null)
  const [fillups, setFillups] = useState<CachedFillup[] | null>(null)
  const [isFromCache, setIsFromCache] = useState(false)
  const [cacheAge, setCacheAge] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Track if fetch is in progress to prevent duplicate requests
  const fetchInProgress = useRef(false)

  // Fetch vehicles from network, fall back to cache if offline
  const fetchVehicles = useCallback(async (): Promise<CachedVehicle[] | null> => {
    if (!isOnline) {
      // Offline - use cache
      const cached = await getCachedVehicles()
      if (cached) {
        const age = await getCacheAge(CACHED_VEHICLES_KEY)
        setCacheAge(age)
        setIsFromCache(true)
      }
      return cached
    }

    try {
      // Online - try network first
      const response = await fetch('/api/vehicles')
      if (!response.ok) {
        throw new Error('Failed to fetch vehicles')
      }
      const data = await response.json()

      // Cache the fresh data
      const vehicleList: CachedVehicle[] = data.vehicles || data
      await cacheVehicles(vehicleList)
      setIsFromCache(false)
      setCacheAge(null)

      return vehicleList
    } catch (err) {
      // Network error - fall back to cache
      const cached = await getCachedVehicles()
      if (cached) {
        const age = await getCacheAge(CACHED_VEHICLES_KEY)
        setCacheAge(age)
        setIsFromCache(true)
        return cached
      }
      throw err
    }
  }, [isOnline])

  // Fetch fillups from network, fall back to cache if offline
  const fetchFillups = useCallback(async (vId: string): Promise<CachedFillup[] | null> => {
    const cacheKey = `${CACHED_FILLUPS_PREFIX}${vId}`

    if (!isOnline) {
      // Offline - use cache
      const cached = await getCachedFillups(vId)
      if (cached) {
        const age = await getCacheAge(cacheKey)
        setCacheAge(age)
        setIsFromCache(true)
      }
      return cached
    }

    try {
      // Online - try network first (get more fillups for caching, display limited)
      const response = await fetch(`/api/fillups?vehicleId=${vId}&limit=10`)
      if (!response.ok) {
        throw new Error('Failed to fetch fillups')
      }
      const data = await response.json()

      // Cache the fresh data
      const fillupList: CachedFillup[] = data.fillups || data
      await cacheFillups(vId, fillupList)
      setIsFromCache(false)
      setCacheAge(null)

      return fillupList
    } catch (err) {
      // Network error - fall back to cache
      const cached = await getCachedFillups(vId)
      if (cached) {
        const age = await getCacheAge(cacheKey)
        setCacheAge(age)
        setIsFromCache(true)
        return cached
      }
      throw err
    }
  }, [isOnline])

  // Main data loading effect
  useEffect(() => {
    async function loadData() {
      if (fetchInProgress.current) return
      fetchInProgress.current = true

      setIsLoading(true)
      setError(null)

      try {
        // Always fetch vehicles
        const vehicleData = await fetchVehicles()
        setVehicles(vehicleData)

        // Fetch fillups if vehicleId is provided
        if (vehicleId) {
          const fillupData = await fetchFillups(vehicleId)
          setFillups(fillupData)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
        fetchInProgress.current = false
      }
    }

    loadData()
  }, [vehicleId, fetchVehicles, fetchFillups])

  // Refresh cache (force re-fetch from network)
  const refreshCache = useCallback(async () => {
    if (!isOnline) {
      setError('Cannot refresh while offline')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const vehicleData = await fetchVehicles()
      setVehicles(vehicleData)

      if (vehicleId) {
        const fillupData = await fetchFillups(vehicleId)
        setFillups(fillupData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data')
    } finally {
      setIsLoading(false)
    }
  }, [isOnline, vehicleId, fetchVehicles, fetchFillups])

  return {
    vehicles,
    fillups,
    isFromCache,
    cacheAge,
    isLoading,
    error,
    refreshCache
  }
}
