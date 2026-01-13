'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useParams, useSearchParams } from 'next/navigation'

interface Fillup {
  id: string
  date: string
  gallons: number
  pricePerGallon: number
  totalCost: number
  odometer: number
  mpg: number | null
  isFull: boolean
  notes: string | null
  city: string | null
  state: string | null
}

interface Vehicle {
  id: string
  name: string
  year: number
  make: string
  model: string
}

function VehicleFillupsContent() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const vehicleId = params.id as string
  const showSuccess = searchParams.get('success') === '1'

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [fillups, setFillups] = useState<Fillup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedFillupId, setExpandedFillupId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState(showSuccess ? 'Fillup logged successfully!' : '')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      fetchVehicle()
      fetchFillups()
    }
  }, [status, router, vehicleId])

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  async function fetchVehicle() {
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}`)
      if (response.ok) {
        const data = await response.json()
        setVehicle(data)
      } else if (response.status === 404) {
        setError('Vehicle not found')
      }
    } catch {
      setError('Failed to load vehicle')
    }
  }

  async function fetchFillups() {
    try {
      const response = await fetch(`/api/fillups?vehicleId=${vehicleId}&limit=50`)
      if (response.ok) {
        const data = await response.json()
        setFillups(data.fillups)
      }
    } catch {
      setError('Failed to load fillups')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete(fillupId: string) {
    if (!confirm('Delete this fillup? This cannot be undone.')) {
      return
    }

    setDeletingId(fillupId)
    try {
      const response = await fetch(`/api/fillups/${fillupId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setFillups(fillups.filter(f => f.id !== fillupId))
        setExpandedFillupId(null)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete fillup')
      }
    } catch {
      setError('Failed to delete fillup')
    } finally {
      setDeletingId(null)
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
  const totalFillups = fillups.length
  const totalGallons = fillups.reduce((sum, f) => sum + f.gallons, 0)
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/vehicles/${vehicleId}`}
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            &larr; Back to {vehicle?.name || 'Vehicle'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            Fillup History
          </h1>
          {vehicle && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          )}
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
            {successMessage}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Add Fillup Button */}
        <div className="mb-6">
          <Link
            href={`/fillups/new?vehicleId=${vehicleId}`}
            className="inline-block py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transition-colors"
          >
            Add Fillup
          </Link>
        </div>

        {/* Stats Summary */}
        {fillups.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalFillups}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Fillups
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalGallons.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Total Gal
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {averageMpg ? averageMpg.toFixed(1) : '--'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Avg MPG
              </p>
            </div>
          </div>
        )}

        {/* Fillup List */}
        {fillups.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No fillups yet. Log your first fillup!
            </p>
            <Link
              href={`/fillups/new?vehicleId=${vehicleId}`}
              className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
            >
              Log Fillup
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {fillups.map((fillup) => {
              const isExpanded = expandedFillupId === fillup.id
              const location = formatLocation(fillup.city, fillup.state)

              return (
                <div
                  key={fillup.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
                >
                  {/* Main Card Content */}
                  <button
                    type="button"
                    onClick={() => setExpandedFillupId(isExpanded ? null : fillup.id)}
                    className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatDate(fillup.date)}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {fillup.gallons.toFixed(1)} gal &bull; ${fillup.totalCost.toFixed(2)}
                        </p>
                        {location && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {location}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {fillup.mpg && (
                          <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                            {fillup.mpg.toFixed(1)} MPG
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {fillup.odometer.toLocaleString()} mi
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Price/gal</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            ${fillup.pricePerGallon.toFixed(3)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Full tank</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {fillup.isFull ? 'Yes' : 'No'}
                          </p>
                        </div>
                      </div>

                      {fillup.notes && (
                        <div className="mb-4">
                          <p className="text-gray-500 dark:text-gray-400 text-sm">Notes</p>
                          <p className="text-gray-900 dark:text-white text-sm">{fillup.notes}</p>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Link
                          href={`/fillups/${fillup.id}/edit`}
                          className="flex-1 py-2 px-3 text-center text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(fillup.id)}
                          disabled={deletingId === fillup.id}
                          className="flex-1 py-2 px-3 text-center text-sm bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-md transition-colors disabled:opacity-50"
                        >
                          {deletingId === fillup.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="text-gray-500">Loading...</div>
    </div>
  )
}

export default function VehicleFillupsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VehicleFillupsContent />
    </Suspense>
  )
}
