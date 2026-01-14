'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

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
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      fetchDashboardData()
    }
  }, [status, router])

  async function fetchDashboardData() {
    try {
      const response = await fetch('/api/dashboard')
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }
      const data = await response.json()
      setDashboardData(data)
    } catch {
      setError('Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Welcome, {userName}!
              </h1>
              {dashboardData && dashboardData.totals.totalVehicles > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  This month: {dashboardData.totals.totalFillupsThisMonth} fillup{dashboardData.totals.totalFillupsThisMonth !== 1 ? 's' : ''}, ${dashboardData.totals.totalSpentThisMonth.toFixed(2)} spent
                </p>
              )}
            </div>
            {dashboardData && dashboardData.totals.totalVehicles > 0 && (
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
            {dashboardData && dashboardData.vehicleSummaries.length > 0 && (
              <Link
                href="/vehicles"
                className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Manage
              </Link>
            )}
          </div>

          {!dashboardData || dashboardData.vehicleSummaries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No vehicles yet
              </p>
              <Link
                href="/vehicles/new"
                className="inline-block py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
              >
                Add Your First Vehicle
              </Link>
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
