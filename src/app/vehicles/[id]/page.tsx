'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useOffline } from '@/contexts/OfflineContext'
import {
  getCachedVehicles,
  cacheFillups,
  getCachedFillups,
  getCacheAge,
  type CachedVehicle,
  type CachedFillup
} from '@/lib/offlineDb'

interface Vehicle {
  id: string
  name: string
  year: number
  make: string
  model: string
  tankSize: number | null
  fuelType: string
  photoUrl: string | null
  groupId: string
  groupName: string
  createdAt: string
  updatedAt: string
}

interface Fillup {
  id: string
  date: string
  gallons: number
  totalCost: number
  mpg: number | null
  city: string | null
  state: string | null
}

interface VehicleStats {
  overview: {
    totalFillups: number
    totalGallons: number
    totalCost: number
    totalMiles: number
    firstFillup: string | null
    lastFillup: string | null
  }
  mpg: {
    average: number | null
    best: number | null
    worst: number | null
    recent: number | null
  }
  costs: {
    averagePricePerGallon: number | null
    averageCostPerFillup: number | null
    costPerMile: number | null
  }
  frequency: {
    averageDaysBetweenFillups: number | null
    averageMilesBetweenFillups: number | null
  }
}

const FUEL_TYPE_LABELS: Record<string, string> = {
  regular: 'Regular',
  premium: 'Premium',
  diesel: 'Diesel',
  e85: 'E85',
}

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { status } = useSession()
  const router = useRouter()
  const { isOnline } = useOffline()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [fillups, setFillups] = useState<Fillup[]>([])
  const [totalFillupCount, setTotalFillupCount] = useState(0)
  const [stats, setStats] = useState<VehicleStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingFillups, setIsLoadingFillups] = useState(true)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isFromCache, setIsFromCache] = useState(false)
  const [cacheAge, setCacheAge] = useState<number | null>(null)

  // Load cached vehicle data
  const loadCachedVehicle = useCallback(async () => {
    const cachedVehicles = await getCachedVehicles()
    if (cachedVehicles) {
      const cachedVehicle = cachedVehicles.find(v => v.id === id)
      if (cachedVehicle) {
        // Convert CachedVehicle to Vehicle type
        setVehicle({
          ...cachedVehicle,
          groupId: cachedVehicle.groupId || '',
          groupName: cachedVehicle.groupName || 'Unknown'
        })
        setIsFromCache(true)
        const age = await getCacheAge('cached-vehicles')
        setCacheAge(age)
        return true
      }
    }
    return false
  }, [id])

  // Load cached fillups
  const loadCachedFillups = useCallback(async () => {
    const cachedFillups = await getCachedFillups(id)
    if (cachedFillups) {
      // Convert CachedFillup to Fillup type
      const fillupsData: Fillup[] = cachedFillups.map(f => ({
        id: f.id,
        date: f.date,
        gallons: f.gallons,
        totalCost: f.totalCost,
        mpg: f.mpg,
        city: f.city,
        state: f.state
      }))
      setFillups(fillupsData)
      setTotalFillupCount(cachedFillups.length)
      setIsFromCache(true)
      const age = await getCacheAge(`cached-fillups-${id}`)
      if (age !== null) setCacheAge(age)
      return true
    }
    return false
  }, [id])

  const fetchVehicle = useCallback(async () => {
    try {
      const response = await fetch(`/api/vehicles/${id}`)
      if (!response.ok) {
        if (response.status === 404) {
          setError('Vehicle not found')
        } else if (response.status === 403) {
          setError('You do not have access to this vehicle')
        } else {
          throw new Error('Failed to fetch vehicle')
        }
        setIsLoading(false)
        return
      }
      const data = await response.json()
      setVehicle(data)
      setIsFromCache(false)
      setCacheAge(null)
    } catch {
      // If network fails and we're offline, try cache
      if (!isOnline) {
        const loaded = await loadCachedVehicle()
        if (!loaded) {
          setError('Vehicle not available offline')
        }
      } else {
        setError('Failed to load vehicle')
      }
    } finally {
      setIsLoading(false)
    }
  }, [id, isOnline, loadCachedVehicle])

  const fetchFillups = useCallback(async () => {
    try {
      const response = await fetch(`/api/fillups?vehicleId=${id}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        const fillupList = data.fillups || []
        setFillups(fillupList.slice(0, 3)) // Display first 3
        setTotalFillupCount(fillupList.length)
        setIsFromCache(false)

        // Cache the fillups for offline use
        if (fillupList.length > 0) {
          const fillupsToCache: CachedFillup[] = fillupList.map((f: Fillup & { pricePerGallon?: number; odometer?: number }) => ({
            id: f.id,
            date: f.date,
            gallons: f.gallons,
            totalCost: f.totalCost,
            pricePerGallon: f.pricePerGallon || f.totalCost / f.gallons,
            odometer: f.odometer || 0,
            mpg: f.mpg,
            city: f.city,
            state: f.state
          }))
          await cacheFillups(id, fillupsToCache)
        }
      }
    } catch {
      // If network fails and we're offline, try cache
      if (!isOnline) {
        await loadCachedFillups()
      }
      // Silently fail otherwise - fillups are supplementary
    } finally {
      setIsLoadingFillups(false)
    }
  }, [id, isOnline, loadCachedFillups])

  const fetchStats = useCallback(async () => {
    // Stats require network - not cached
    if (!isOnline) {
      setIsLoadingStats(false)
      return
    }

    try {
      const response = await fetch(`/api/vehicles/${id}/stats`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch {
      // Silently fail - stats are supplementary
    } finally {
      setIsLoadingStats(false)
    }
  }, [id, isOnline])

  useEffect(() => {
    if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      if (isOnline) {
        fetchVehicle()
        fetchFillups()
        fetchStats()
      } else {
        // Offline - load from cache
        loadCachedVehicle().then(loaded => {
          if (!loaded) {
            setError('Vehicle not available offline')
          }
          setIsLoading(false)
        })
        loadCachedFillups().then(() => {
          setIsLoadingFillups(false)
        })
        setIsLoadingStats(false)
      }
    }
  }, [status, router, isOnline, fetchVehicle, fetchFillups, fetchStats, loadCachedVehicle, loadCachedFillups])

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

  function getMpgColor(mpg: number, best: number | null, worst: number | null): string {
    if (!best || !worst || best === worst) return 'text-gray-900 dark:text-white'
    const range = best - worst
    const position = (mpg - worst) / range
    if (position >= 0.7) return 'text-green-600 dark:text-green-400'
    if (position <= 0.3) return 'text-red-600 dark:text-red-400'
    return 'text-yellow-600 dark:text-yellow-400'
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/vehicles/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.push('/vehicles')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete vehicle')
        setShowDeleteConfirm(false)
      }
    } catch {
      setError('An error occurred. Please try again.')
      setShowDeleteConfirm(false)
    } finally {
      setIsDeleting(false)
    }
  }

  function formatDate(dateString: string): string {
    // Parse as local date to avoid timezone shift
    const datePart = dateString.split('T')[0]
    const [year, month, day] = datePart.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  function formatLocation(city: string | null, state: string | null): string | null {
    if (city && state) return `${city}, ${state}`
    if (city) return city
    if (state) return state
    return null
  }

  // Calculate stats
  const fillupsWithMpg = fillups.filter(f => f.mpg !== null)
  const averageMpg = fillupsWithMpg.length > 0
    ? fillupsWithMpg.reduce((sum, f) => sum + (f.mpg || 0), 0) / fillupsWithMpg.length
    : null

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <Link
              href="/vehicles"
              className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              &larr; Back to Vehicles
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              {error || 'Vehicle not found'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6">
          <Link
            href="/vehicles"
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            &larr; Back to Vehicles
          </Link>
        </div>

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
                    ? `Last updated ${formatCacheAge(cacheAge)}. Statistics unavailable offline.`
                    : 'Statistics unavailable offline.'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          {/* Photo */}
          <div className="aspect-video relative bg-gray-100 dark:bg-gray-700">
            {vehicle.photoUrl ? (
              <Image
                src={vehicle.photoUrl}
                alt={vehicle.name}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  className="w-20 h-20 text-gray-400 dark:text-gray-500"
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

          {/* Vehicle Details */}
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {vehicle.name}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>

            {/* Log Fillup - Primary Action */}
            <div className="mt-4">
              <Link
                href={`/fillups/new?vehicleId=${id}`}
                className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold rounded-lg shadow-sm transition-colors"
              >
                Log Fillup
              </Link>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Group</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {vehicle.groupName}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Fuel Type</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {FUEL_TYPE_LABELS[vehicle.fuelType] || vehicle.fuelType}
                </span>
              </div>

              {vehicle.tankSize && (
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Tank Size</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {vehicle.tankSize} gallons
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              {isOnline ? (
                <>
                  <Link
                    href={`/vehicles/${id}/edit`}
                    className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-md text-center transition-colors"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/import?vehicleId=${id}`}
                    className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-md text-center transition-colors"
                  >
                    Import
                  </Link>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex-1 py-2 px-4 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-200 font-medium rounded-md transition-colors"
                  >
                    Delete
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  Edit, Import, and Delete require network connection
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Statistics
          </h2>

          {isFromCache ? (
            <div className="text-center py-6">
              <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">
                Statistics not available offline
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Connect to view full statistics
              </p>
            </div>
          ) : isLoadingStats ? (
            <div className="space-y-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          ) : !stats || stats.overview.totalFillups === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500 dark:text-gray-400">
                No fillup data yet - log your first fillup to see statistics
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Fuel Economy Card */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                  Fuel Economy
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-2xl font-bold ${stats.mpg.average ? getMpgColor(stats.mpg.average, stats.mpg.best, stats.mpg.worst) : 'text-gray-400'}`}>
                      {stats.mpg.average ? `${stats.mpg.average} MPG` : '--'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Average</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${stats.mpg.recent ? getMpgColor(stats.mpg.recent, stats.mpg.best, stats.mpg.worst) : 'text-gray-400'}`}>
                      {stats.mpg.recent ? `${stats.mpg.recent} MPG` : '--'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Recent (last 5)</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {stats.mpg.best ? `${stats.mpg.best} MPG` : '--'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Best</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                      {stats.mpg.worst ? `${stats.mpg.worst} MPG` : '--'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Worst</p>
                  </div>
                </div>
              </div>

              {/* Costs Card */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                  Costs
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${stats.overview.totalCost.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Spent</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.costs.costPerMile ? `$${stats.costs.costPerMile.toFixed(2)}` : '--'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Per Mile</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      {stats.costs.averagePricePerGallon ? `$${stats.costs.averagePricePerGallon.toFixed(3)}` : '--'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Avg $/Gallon</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      {stats.costs.averageCostPerFillup ? `$${stats.costs.averageCostPerFillup.toFixed(2)}` : '--'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Avg Fillup</p>
                  </div>
                </div>
              </div>

              {/* Activity Card */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                  Activity
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.overview.totalFillups}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Fillups</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.overview.totalMiles.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Miles Tracked</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      {stats.frequency.averageDaysBetweenFillups ? `${stats.frequency.averageDaysBetweenFillups} days` : '--'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Avg Between Fillups</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      {stats.frequency.averageMilesBetweenFillups ? `${stats.frequency.averageMilesBetweenFillups.toLocaleString()} mi` : '--'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Avg Miles/Fillup</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fillups Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Fillups
            </h2>
            <Link
              href={`/vehicles/${id}/fillups`}
              className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              View All
            </Link>
          </div>

          {/* Stats */}
          {totalFillupCount > 0 && (
            <div className="flex gap-6 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalFillupCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Total
                </p>
              </div>
              {averageMpg && (
                <div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {averageMpg.toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Avg MPG
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Recent Fillups */}
          {isLoadingFillups ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading fillups...</p>
          ) : fillups.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                No fillups yet
              </p>
              <Link
                href={`/fillups/new?vehicleId=${id}`}
                className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
              >
                Log your first fillup
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {fillups.map((fillup) => {
                const location = formatLocation(fillup.city, fillup.state)
                return (
                  <Link
                    key={fillup.id}
                    href={`/vehicles/${id}/fillups`}
                    className="flex items-center justify-between py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded -mx-2 px-2 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatDate(fillup.date)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {fillup.gallons.toFixed(1)} gal - ${fillup.totalCost.toFixed(2)}
                        {location && ` - ${location}`}
                      </p>
                    </div>
                    {fillup.mpg && (
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {fillup.mpg.toFixed(1)} MPG
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Delete Vehicle?
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete &quot;{vehicle.name}&quot;? This will also delete all {totalFillupCount} fillup{totalFillupCount !== 1 ? 's' : ''}. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-sm transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-md transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
