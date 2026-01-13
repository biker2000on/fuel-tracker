'use client'

import { useState, useEffect, use } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      fetchVehicle()
      fetchFillups()
      fetchStats()
    }
  }, [status, router, id])

  async function fetchVehicle() {
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
    } catch {
      setError('Failed to load vehicle')
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchFillups() {
    try {
      const response = await fetch(`/api/fillups?vehicleId=${id}&limit=3`)
      if (response.ok) {
        const data = await response.json()
        setFillups(data.fillups)
        // Also fetch full count
        const countResponse = await fetch(`/api/fillups?vehicleId=${id}&limit=500`)
        if (countResponse.ok) {
          const countData = await countResponse.json()
          setTotalFillupCount(countData.fillups.length)
        }
      }
    } catch {
      // Silently fail - fillups are supplementary
    } finally {
      setIsLoadingFillups(false)
    }
  }

  async function fetchStats() {
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
    const date = new Date(dateString)
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
              <Link
                href={`/vehicles/${id}/edit`}
                className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-md text-center transition-colors"
              >
                Edit
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-1 py-2 px-4 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-200 font-medium rounded-md transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Statistics
          </h2>

          {isLoadingStats ? (
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
