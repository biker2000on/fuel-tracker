'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useOffline } from '@/contexts/OfflineContext'
import {
  cacheVehicles,
  getCachedVehicles,
  getCacheAge,
  type CachedVehicle
} from '@/lib/offlineDb'

interface RecentFillup {
  id: string
  date: string
  gallons: number
  totalCost: number
  mpg: number | null
  vehicleId: string
  vehicleName: string
  city: string | null
  state: string | null
}

interface VehicleSummary {
  id: string
  name: string
  year: number
  make: string
  model: string
  photoUrl: string | null
  lastFillup: string | null
  averageMpg: number | null
  recentMpg: number | null
  totalFillups: number
}

interface DashboardTotals {
  totalVehicles: number
  totalFillupsThisMonth: number
  totalSpentThisMonth: number
}

interface DashboardData {
  recentFillups: RecentFillup[]
  vehicleSummaries: VehicleSummary[]
  totals: DashboardTotals
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { isOnline } = useOffline()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [cachedVehicles, setCachedVehicles] = useState<CachedVehicle[] | null>(null)
  const [isFromCache, setIsFromCache] = useState(false)
  const [cacheAge, setCacheAge] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadCachedData = useCallback(async () => {
    const cached = await getCachedVehicles()
    if (cached) {
      setCachedVehicles(cached)
      const age = await getCacheAge('cached-vehicles')
      setCacheAge(age)
      setIsFromCache(true)
    }
    setIsLoading(false)
  }, [])

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard')
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }
      const data = await response.json()
      setDashboardData(data)
      setIsFromCache(false)
      setCacheAge(null)

      // Cache the vehicle data for offline use
      if (data.vehicleSummaries && data.vehicleSummaries.length > 0) {
        const vehiclesToCache: CachedVehicle[] = data.vehicleSummaries.map((v: VehicleSummary) => ({
          id: v.id,
          name: v.name,
          year: v.year,
          make: v.make,
          model: v.model,
          tankSize: null,
          fuelType: 'regular',
          photoUrl: v.photoUrl,
          groupId: '',
          groupName: '',
          createdAt: '',
          updatedAt: ''
        }))
        await cacheVehicles(vehiclesToCache)
      }
    } catch {
      // If network fails and we have cached data, use it
      if (!isOnline) {
        await loadCachedData()
      } else {
        setError('Failed to load dashboard')
      }
    } finally {
      setIsLoading(false)
    }
  }, [isOnline, loadCachedData])

  useEffect(() => {
    if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
      router.push('/login')
      return
    }
    if (status === 'unauthenticated' && !isOnline) {
      loadCachedData()
      return
    }

    if (status === 'authenticated') {
      if (isOnline) {
        fetchDashboardData()
      } else {
        loadCachedData()
      }
    }
  }, [status, router, isOnline, fetchDashboardData, loadCachedData])

  function formatCacheAge(ms: number | null): string {
    if (ms === null) return ''
    const minutes = Math.floor(ms / 60000)
    if (minutes < 1) return 'just now'
    if (minutes === 1) return '1 minute ago'
    if (minutes < 60) return `${minutes} minutes ago`
    const hours = Math.floor(minutes / 60)
    if (hours === 1) return '1 hour ago'
    if (hours < 24) return `${hours} hours ago`
    const days = Math.floor(hours / 24)
    if (days === 1) return '1 day ago'
    return `${days} days ago`
  }

  function formatDate(dateString: string): string {
    // Parse as local date to avoid timezone shift
    const datePart = dateString.split('T')[0]
    const [year, month, day] = datePart.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  function formatLocation(city: string | null, state: string | null): string | null {
    if (city && state) return `${city}, ${state}`
    if (city) return city
    if (state) return state
    return null
  }

  function getMpgColorClass(recentMpg: number | null, averageMpg: number | null): string {
    if (recentMpg === null || averageMpg === null) return 'text-gray-500 dark:text-gray-400'
    if (recentMpg >= averageMpg) return 'text-green-600 dark:text-green-400'
    return 'text-red-600 dark:text-red-400'
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  const userName = session?.user?.name || 'there'

  // Determine if we have any vehicles to show (from dashboard or cache)
  const hasVehicles = dashboardData?.totals?.totalVehicles && dashboardData.totals.totalVehicles > 0 ||
    (isFromCache && cachedVehicles && cachedVehicles.length > 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Offline/Cache Notice */}
        {isFromCache && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Showing cached data
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  {cacheAge !== null
                    ? `Last updated ${formatCacheAge(cacheAge)}. Some features may be limited while offline.`
                    : 'Some features may be limited while offline.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Welcome, {userName}!
              </h1>
              {dashboardData && dashboardData.totals.totalVehicles > 0 && !isFromCache && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  This month: {dashboardData.totals.totalFillupsThisMonth} fillup{dashboardData.totals.totalFillupsThisMonth !== 1 ? 's' : ''}, ${dashboardData.totals.totalSpentThisMonth.toFixed(2)} spent
                </p>
              )}
              {isFromCache && cachedVehicles && cachedVehicles.length > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {cachedVehicles.length} vehicle{cachedVehicles.length !== 1 ? 's' : ''} available offline
                </p>
              )}
              </div>
              {/* Profile link - visible on desktop only (mobile uses bottom nav) */}
              <Link
                href="/profile"
                className="hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-label="Profile"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </Link>
            </div>
            {hasVehicles && (
              <Link
                href="/fillups/new"
                className="inline-flex items-center justify-center py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
              >
                Log Fillup
              </Link>
            )}
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Activity
            </h2>
            {dashboardData && dashboardData.recentFillups.length > 0 && (
              <Link
                href="/vehicles"
                className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                View All
              </Link>
            )}
          </div>

          {!dashboardData || dashboardData.recentFillups.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No recent activity - log your first fillup!
              </p>
              {dashboardData && dashboardData.totals.totalVehicles > 0 ? (
                <Link
                  href="/fillups/new"
                  className="inline-block py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
                >
                  Log Fillup
                </Link>
              ) : (
                <Link
                  href="/vehicles/new"
                  className="inline-block py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
                >
                  Add Vehicle First
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {dashboardData.recentFillups.map((fillup) => {
                const location = formatLocation(fillup.city, fillup.state)
                return (
                  <Link
                    key={fillup.id}
                    href={`/vehicles/${fillup.vehicleId}/fillups`}
                    className="flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {fillup.vehicleName}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(fillup.date)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {fillup.gallons.toFixed(1)} gal - ${fillup.totalCost.toFixed(2)}
                        {location && ` - ${location}`}
                      </p>
                    </div>
                    {fillup.mpg !== null && (
                      <div className="ml-4 text-right flex-shrink-0">
                        <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                          {fillup.mpg.toFixed(1)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">MPG</p>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Vehicle Overview Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Vehicle Overview
            </h2>
            {(dashboardData?.vehicleSummaries?.length || (isFromCache && cachedVehicles?.length)) && (
              <Link
                href="/vehicles"
                className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Manage
              </Link>
            )}
          </div>

          {/* Show cached vehicles when offline */}
          {isFromCache && cachedVehicles && cachedVehicles.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {cachedVehicles.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  href={`/vehicles/${vehicle.id}`}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Vehicle Photo */}
                  <div className="aspect-video relative bg-gray-200 dark:bg-gray-600">
                    {vehicle.photoUrl ? (
                      <Image
                        src={vehicle.photoUrl}
                        alt={vehicle.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                          className="w-10 h-10 text-gray-400 dark:text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Vehicle Info (cached - limited data) */}
                  <div className="p-3">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate text-sm">
                      {vehicle.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 italic">
                      View for cached fillups
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : !dashboardData || dashboardData.vehicleSummaries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {isFromCache ? 'No cached vehicles available' : 'No vehicles yet'}
              </p>
              {!isFromCache && (
                <Link
                  href="/vehicles/new"
                  className="inline-block py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
                >
                  Add Your First Vehicle
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboardData.vehicleSummaries.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  href={`/vehicles/${vehicle.id}`}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Vehicle Photo */}
                  <div className="aspect-video relative bg-gray-200 dark:bg-gray-600">
                    {vehicle.photoUrl ? (
                      <Image
                        src={vehicle.photoUrl}
                        alt={vehicle.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                          className="w-10 h-10 text-gray-400 dark:text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Vehicle Info */}
                  <div className="p-3">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate text-sm">
                      {vehicle.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>

                    {/* MPG Stats */}
                    <div className="mt-2 flex items-baseline gap-2">
                      {vehicle.recentMpg !== null ? (
                        <>
                          <span className={`text-lg font-bold ${getMpgColorClass(vehicle.recentMpg, vehicle.averageMpg)}`}>
                            {vehicle.recentMpg.toFixed(1)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            recent MPG
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          No MPG data yet
                        </span>
                      )}
                    </div>

                    {vehicle.averageMpg !== null && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Avg: {vehicle.averageMpg.toFixed(1)} MPG
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
