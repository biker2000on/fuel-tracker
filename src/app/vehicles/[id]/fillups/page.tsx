'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useOffline } from '@/contexts/OfflineContext'
import { getQueue, removeFromQueue, type PendingFillup } from '@/lib/offlineDb'
import { PendingFillupBadge } from '@/components/PendingFillupBadge'

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

// Unified type for display - includes both synced and pending fillups
interface DisplayFillup {
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
  isPending: boolean
  pendingId?: string // For pending items, this is the queue ID
}

function VehicleFillupsContent() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const vehicleId = params.id as string
  const showSuccess = searchParams.get('success') === '1'
  const { isOnline, syncQueue, refreshPendingCount } = useOffline()

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [fillups, setFillups] = useState<Fillup[]>([])
  const [pendingFillups, setPendingFillups] = useState<PendingFillup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedFillupId, setExpandedFillupId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState(showSuccess ? 'Fillup logged successfully!' : '')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [isSyncingNow, setIsSyncingNow] = useState(false)
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null)
  const [vehicleStats, setVehicleStats] = useState<VehicleStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Fetch pending fillups from IndexedDB
  const fetchPendingFillups = useCallback(async () => {
    try {
      const queue = await getQueue()
      // Filter to only this vehicle's pending fillups
      const vehiclePending = queue.filter(p => p.data.vehicleId === vehicleId)
      setPendingFillups(vehiclePending)
    } catch {
      console.error('Failed to fetch pending fillups')
    }
  }, [vehicleId])

  useEffect(() => {
    if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      fetchVehicle()
      fetchFillups()
      fetchPendingFillups()
      fetchStats()
    }
  }, [status, router, vehicleId, fetchPendingFillups])

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Triple-guard: intersecting + has more + not already loading
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '200px' // Start loading 200px before sentinel visible
      }
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, isLoadingMore]) // loadMore is stable from closure

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

  async function fetchStats(filterStartDate?: string, filterEndDate?: string) {
    try {
      setIsLoadingStats(true)
      const statsParams = new URLSearchParams()
      if (filterStartDate) {
        statsParams.append('startDate', filterStartDate)
      }
      if (filterEndDate) {
        statsParams.append('endDate', filterEndDate)
      }
      const queryString = statsParams.toString()
      const statsUrl = `/api/vehicles/${vehicleId}/stats${queryString ? `?${queryString}` : ''}`
      const response = await fetch(statsUrl)
      if (response.ok) {
        const data = await response.json()
        setVehicleStats(data)
      }
    } catch {
      console.error('Failed to load vehicle stats')
    } finally {
      setIsLoadingStats(false)
    }
  }

  async function fetchFillups(cursor?: string, filterStartDate?: string, filterEndDate?: string) {
    try {
      const apiParams = new URLSearchParams({ vehicleId, pageSize: '20' })
      if (cursor) {
        apiParams.append('cursor', cursor)
      }
      if (filterStartDate) {
        apiParams.append('startDate', filterStartDate)
      }
      if (filterEndDate) {
        apiParams.append('endDate', filterEndDate)
      }
      const response = await fetch(`/api/fillups?${apiParams.toString()}`)
      if (response.ok) {
        const data = await response.json()
        if (cursor) {
          // Append to existing list when loading more
          setFillups(prev => [...prev, ...data.fillups])
        } else {
          // Replace list on initial load
          setFillups(data.fillups)
        }
        setNextCursor(data.nextCursor)
        setHasMore(data.hasMore)
      }
    } catch {
      setError('Failed to load fillups')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return
    setIsLoadingMore(true)
    await fetchFillups(nextCursor, startDate, endDate)
  }

  function applyDateFilter(start: string, end: string, filterName: string | null) {
    setStartDate(start)
    setEndDate(end)
    setActiveFilter(filterName)
    setFillups([])
    setNextCursor(null)
    setIsLoading(true)
    fetchFillups(undefined, start, end)
    fetchStats(start, end)
    // Scroll to top when filter applied
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function clearFilter() {
    applyDateFilter('', '', null)
  }

  function applyQuickFilter(filterType: 'last30' | 'last90' | 'thisYear' | 'all') {
    const today = new Date()
    let start = ''
    let end = ''
    let filterName: string | null = null

    switch (filterType) {
      case 'last30': {
        const thirtyDaysAgo = new Date(today)
        thirtyDaysAgo.setDate(today.getDate() - 30)
        start = thirtyDaysAgo.toISOString().split('T')[0]
        end = today.toISOString().split('T')[0]
        filterName = 'Last 30 days'
        break
      }
      case 'last90': {
        const ninetyDaysAgo = new Date(today)
        ninetyDaysAgo.setDate(today.getDate() - 90)
        start = ninetyDaysAgo.toISOString().split('T')[0]
        end = today.toISOString().split('T')[0]
        filterName = 'Last 90 days'
        break
      }
      case 'thisYear': {
        start = `${today.getFullYear()}-01-01`
        end = today.toISOString().split('T')[0]
        filterName = 'This year'
        break
      }
      case 'all':
        filterName = null
        break
    }

    applyDateFilter(start, end, filterName)
  }

  function handleCustomDateFilter() {
    if (startDate || endDate) {
      const filterName = startDate && endDate
        ? `${formatDate(startDate)} - ${formatDate(endDate)}`
        : startDate
          ? `From ${formatDate(startDate)}`
          : `Until ${formatDate(endDate)}`
      applyDateFilter(startDate, endDate, filterName)
    }
  }

  async function handleDelete(fillupId: string, isPending: boolean) {
    if (!confirm('Delete this fillup? This cannot be undone.')) {
      return
    }

    setDeletingId(fillupId)
    try {
      if (isPending) {
        // Delete from IndexedDB queue
        await removeFromQueue(fillupId)
        setPendingFillups(prev => prev.filter(p => p.id !== fillupId))
        await refreshPendingCount()
      } else {
        // Delete from server
        const response = await fetch(`/api/fillups/${fillupId}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          setFillups(fillups.filter(f => f.id !== fillupId))
        } else {
          const data = await response.json()
          setError(data.error || 'Failed to delete fillup')
        }
      }
      setExpandedFillupId(null)
    } catch {
      setError('Failed to delete fillup')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSyncNow() {
    if (!isOnline || isSyncingNow) return

    setIsSyncingNow(true)
    try {
      await syncQueue()
      // Refresh both pending and synced fillups
      await fetchPendingFillups()
      await fetchFillups()
    } catch {
      setError('Failed to sync fillups')
    } finally {
      setIsSyncingNow(false)
    }
  }

  async function handleRecalculateMpg(fillupId: string) {
    setRecalculatingId(fillupId)
    try {
      const response = await fetch(`/api/fillups/${fillupId}/recalculate`, {
        method: 'POST'
      })

      if (response.ok) {
        const updatedFillup = await response.json()
        // Update the fillup in state with new MPG
        setFillups(prev => prev.map(f =>
          f.id === fillupId ? { ...f, mpg: updatedFillup.mpg } : f
        ))
        setSuccessMessage('MPG recalculated successfully')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to recalculate MPG')
      }
    } catch {
      setError('Failed to recalculate MPG')
    } finally {
      setRecalculatingId(null)
    }
  }

  function formatDate(dateString: string): string {
    // Parse as local date to avoid timezone shift
    // dateString is ISO format: "2024-01-28T00:00:00.000Z"
    // Extract just the date part and treat as local
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

  // Convert pending fillups to display format and merge with server fillups
  function getDisplayFillups(): DisplayFillup[] {
    // Convert synced fillups to display format
    const syncedDisplay: DisplayFillup[] = fillups.map(f => ({
      ...f,
      isPending: false
    }))

    // Convert pending fillups to display format
    // Calculate estimated MPG if we have a previous fillup
    const pendingDisplay: DisplayFillup[] = pendingFillups.map(p => {
      const totalCost = p.data.gallons * p.data.pricePerGallon

      // Try to estimate MPG from the most recent synced fillup
      let estimatedMpg: number | null = null
      if (p.data.isFull && fillups.length > 0) {
        // Find the most recent fillup with lower odometer
        const previousFillup = fillups.find(f => f.odometer < p.data.odometer && f.isFull)
        if (previousFillup) {
          const milesDriven = p.data.odometer - previousFillup.odometer
          estimatedMpg = milesDriven / p.data.gallons
        }
      }

      return {
        id: `pending-${p.id}`,
        date: p.data.date,
        gallons: p.data.gallons,
        pricePerGallon: p.data.pricePerGallon,
        totalCost,
        odometer: p.data.odometer,
        mpg: estimatedMpg,
        isFull: p.data.isFull,
        notes: p.data.notes,
        city: p.data.city,
        state: p.data.state,
        isPending: true,
        pendingId: p.id
      }
    })

    // Sort pending by createdAt (newest first for display at top)
    // Then append synced fillups (already sorted by date from server)
    return [...pendingDisplay.reverse(), ...syncedDisplay]
  }

  const displayFillups = getDisplayFillups()
  const hasPendingFillups = pendingFillups.length > 0

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
        <div id="add-fillup-section" className="mb-6 flex items-center gap-4">
          <Link
            href={`/fillups/new?vehicleId=${vehicleId}`}
            className="inline-block py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transition-colors"
          >
            Add Fillup
          </Link>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-md transition-colors"
          >
            {showFilters ? 'Hide Filters' : 'Filter'}
          </button>
        </div>

        {/* Pending Fillups Banner */}
        {hasPendingFillups && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  {pendingFillups.length} fillup{pendingFillups.length !== 1 ? 's' : ''} pending sync
                </span>
              </div>
              {isOnline && (
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={isSyncingNow}
                  className="text-sm text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 font-medium disabled:opacity-50"
                >
                  {isSyncingNow ? 'Syncing...' : 'Sync now'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active Filter Badge */}
        {activeFilter && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Filtered:</span>
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm rounded-full">
              {activeFilter}
              <button
                type="button"
                onClick={clearFilter}
                className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                aria-label="Clear filter"
              >
                x
              </button>
            </span>
          </div>
        )}

        {/* Filter Section */}
        {showFilters && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            {/* Quick Filters */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Filters</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyQuickFilter('last30')}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
                >
                  Last 30 days
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickFilter('last90')}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
                >
                  Last 90 days
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickFilter('thisYear')}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
                >
                  This year
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickFilter('all')}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
                >
                  All time
                </button>
              </div>
            </div>

            {/* Custom Date Range */}
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custom Range</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="startDate" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCustomDateFilter}
                  disabled={!startDate && !endDate}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Screen reader announcements for infinite scroll */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {isLoadingMore && "Loading more fillups"}
          {!hasMore && displayFillups.length > 20 && "All fillups loaded"}
        </div>

        {/* Stats Summary */}
        {vehicleStats && vehicleStats.overview.totalFillups > 0 && (
          <div className="mb-6">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {vehicleStats.overview.totalFillups}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Fillups
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {vehicleStats.overview.totalGallons.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Total Gal
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {vehicleStats.mpg.average ? vehicleStats.mpg.average.toFixed(1) : '--'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Avg MPG
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${vehicleStats.overview.totalCost.toFixed(0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Total Cost
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {vehicleStats.costs.costPerMile ? `$${vehicleStats.costs.costPerMile.toFixed(2)}` : '--'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cost/Mile
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {vehicleStats.costs.averagePricePerGallon ? `$${vehicleStats.costs.averagePricePerGallon.toFixed(3)}` : '--'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Avg $/Gal
                </p>
              </div>
            </div>
            {activeFilter && (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
                Stats for: {activeFilter}
              </p>
            )}
          </div>
        )}
        {isLoadingStats && !vehicleStats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center animate-pulse">
                <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-1" />
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Fillup List */}
        {displayFillups.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
            {activeFilter ? (
              <>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No fillups found for this date range.
                </p>
                <button
                  type="button"
                  onClick={clearFilter}
                  className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
                >
                  Clear filter
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No fillups yet. Log your first fillup!
                </p>
                <Link
                  href={`/fillups/new?vehicleId=${vehicleId}`}
                  className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
                >
                  Log Fillup
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Skip link for keyboard users */}
            {displayFillups.length > 20 && (
              <a
                href="#add-fillup-section"
                className="sr-only focus:not-sr-only focus:absolute focus:top-20 focus:left-4 focus:z-50 focus:bg-white focus:dark:bg-gray-800 focus:px-4 focus:py-2 focus:shadow-lg focus:rounded-md focus:text-blue-600 focus:dark:text-blue-400"
              >
                Skip to top
              </a>
            )}
            {displayFillups.map((fillup) => {
              const isExpanded = expandedFillupId === fillup.id
              const location = formatLocation(fillup.city, fillup.state)
              const deleteId = fillup.isPending ? fillup.pendingId! : fillup.id

              return (
                <div
                  key={fillup.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden ${
                    fillup.isPending ? 'ring-2 ring-amber-300 dark:ring-amber-600' : ''
                  }`}
                >
                  {/* Main Card Content */}
                  <button
                    type="button"
                    onClick={() => setExpandedFillupId(isExpanded ? null : fillup.id)}
                    className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatDate(fillup.date)}
                          </p>
                          {fillup.isPending && <PendingFillupBadge />}
                        </div>
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
                          <p className={`text-lg font-semibold ${
                            fillup.isPending
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}>
                            {fillup.isPending && '~'}{fillup.mpg.toFixed(1)} MPG
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

                      {/* Pending fillup status */}
                      {fillup.isPending && (
                        <div className="mb-4 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-sm">
                          <p className="text-amber-800 dark:text-amber-200">
                            Pending sync
                            {fillup.mpg && ' (MPG is estimated)'}
                          </p>
                          {isOnline && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSyncNow()
                              }}
                              disabled={isSyncingNow}
                              className="mt-1 text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 font-medium"
                            >
                              {isSyncingNow ? 'Syncing...' : 'Sync now'}
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex gap-3">
                        {fillup.isPending ? (
                          // Pending fillup actions - edit goes to new fillup form with data pre-filled
                          // For now, just show delete since editing queued items requires more UI work
                          <button
                            type="button"
                            onClick={() => handleDelete(deleteId, true)}
                            disabled={deletingId === deleteId}
                            className="flex-1 py-2 px-3 text-center text-sm bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-md transition-colors disabled:opacity-50"
                          >
                            {deletingId === deleteId ? 'Deleting...' : 'Delete'}
                          </button>
                        ) : (
                          // Synced fillup actions
                          <>
                            <Link
                              href={`/fillups/${fillup.id}/edit`}
                              className="flex-1 py-2 px-3 text-center text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
                            >
                              Edit
                            </Link>
                            {fillup.isFull && (
                              <button
                                type="button"
                                onClick={() => handleRecalculateMpg(fillup.id)}
                                disabled={recalculatingId === fillup.id}
                                className="flex-1 py-2 px-3 text-center text-sm bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400 rounded-md transition-colors disabled:opacity-50"
                              >
                                {recalculatingId === fillup.id ? 'Recalculating...' : 'Recalculate MPG'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(fillup.id, false)}
                              disabled={deletingId === fillup.id}
                              className="flex-1 py-2 px-3 text-center text-sm bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-md transition-colors disabled:opacity-50"
                            >
                              {deletingId === fillup.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} className="mt-4 py-4 text-center">
                {isLoadingMore && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Loading more fillups...
                  </span>
                )}
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && displayFillups.length > 20 && (
              <div className="mt-4 py-2 text-center text-sm text-gray-500 dark:text-gray-400">
                All fillups loaded
              </div>
            )}

            {/* Offline cache limit indicator */}
            {!isOnline && !hasMore && fillups.length <= 10 && fillups.length > 0 && (
              <div className="mt-4 py-2 text-center">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Showing {fillups.length} most recent fillups (offline)
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Connect to load full history
                </p>
              </div>
            )}
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
