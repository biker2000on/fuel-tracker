'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useGeolocation } from '@/hooks/useGeolocation'
import { reverseGeocode, formatLocation, GeocodedLocation } from '@/lib/geocoding'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { OfflineNotice } from '@/components/OfflineNotice'

interface Fillup {
  id: string
  date: string
  gallons: number
  pricePerGallon: number
  totalCost: number
  odometer: number
  isFull: boolean
  notes: string | null
  latitude: number | null
  longitude: number | null
  city: string | null
  state: string | null
  country: string | null
  vehicleId: string
  vehicleName: string
}

function EditFillupForm() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const fillupId = params.id as string
  const { isOnline } = useNetworkStatus()

  // Fillup state
  const [fillup, setFillup] = useState<Fillup | null>(null)
  const [isLoadingFillup, setIsLoadingFillup] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Form state
  const [gallons, setGallons] = useState('')
  const [pricePerGallon, setPricePerGallon] = useState('')
  const [odometer, setOdometer] = useState('')
  const [isFull, setIsFull] = useState(true)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Location state
  const {
    latitude,
    longitude,
    loading: locationLoading,
    error: locationError,
    requestLocation,
    isSupported: locationSupported
  } = useGeolocation()
  const [geocodedLocation, setGeocodedLocation] = useState<GeocodedLocation | null>(null)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [useExistingLocation, setUseExistingLocation] = useState(true)

  // Submit state
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch fillup on mount
  useEffect(() => {
    if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
      router.push('/login')
      return
    }

    if (status === 'authenticated' && fillupId) {
      fetchFillup()
    }
  }, [status, router, fillupId, isOnline])

  async function fetchFillup() {
    try {
      const response = await fetch(`/api/fillups/${fillupId}`)
      if (!response.ok) {
        if (response.status === 404) {
          setLoadError('Fillup not found')
        } else if (response.status === 403) {
          setLoadError('You do not have access to this fillup')
        } else {
          setLoadError('Failed to load fillup')
        }
        setIsLoadingFillup(false)
        return
      }

      const data: Fillup = await response.json()
      setFillup(data)

      // Pre-populate form fields
      setGallons(data.gallons.toString())
      setPricePerGallon(data.pricePerGallon.toString())
      setOdometer(data.odometer.toString())
      setIsFull(data.isFull)
      setNotes(data.notes || '')
      setShowNotes(!!data.notes)

      // Format date for datetime-local input
      const dateObj = new Date(data.date)
      const localDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
      setDate(localDate.toISOString().slice(0, 16))

      // Set existing location if available
      if (data.city || data.state || data.country) {
        setGeocodedLocation({
          city: data.city,
          state: data.state,
          country: data.country
        })
      }
    } catch {
      setLoadError('Failed to load fillup')
    } finally {
      setIsLoadingFillup(false)
    }
  }

  // Reverse geocode when new coordinates are available
  useEffect(() => {
    if (!useExistingLocation && latitude && longitude && !isGeocoding) {
      setIsGeocoding(true)
      reverseGeocode(latitude, longitude)
        .then(setGeocodedLocation)
        .finally(() => setIsGeocoding(false))
    }
  }, [latitude, longitude, useExistingLocation, isGeocoding])

  const handleDetectNewLocation = useCallback(() => {
    setUseExistingLocation(false)
    setGeocodedLocation(null)
    requestLocation()
  }, [requestLocation])

  const handleClearLocation = useCallback(() => {
    setGeocodedLocation(null)
  }, [])

  // Calculate total cost
  const totalCost = gallons && pricePerGallon
    ? (parseFloat(gallons) * parseFloat(pricePerGallon)).toFixed(2)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const gallonsNum = parseFloat(gallons)
    const priceNum = parseFloat(pricePerGallon)
    const odometerNum = parseInt(odometer, 10)

    if (isNaN(gallonsNum) || gallonsNum <= 0) {
      setError('Please enter valid gallons')
      return
    }

    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Please enter valid price per gallon')
      return
    }

    if (isNaN(odometerNum) || odometerNum <= 0) {
      setError('Please enter valid odometer reading')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/fillups/${fillupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date(date).toISOString(),
          gallons: gallonsNum,
          pricePerGallon: priceNum,
          odometer: odometerNum,
          isFull,
          notes: notes.trim() || null,
          latitude: !useExistingLocation ? (latitude ?? null) : fillup?.latitude ?? null,
          longitude: !useExistingLocation ? (longitude ?? null) : fillup?.longitude ?? null,
          city: geocodedLocation?.city ?? null,
          state: geocodedLocation?.state ?? null,
          country: geocodedLocation?.country ?? null
        })
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to update fillup')
        setIsSubmitting(false)
        return
      }

      // Success - navigate to vehicle's fillups page
      router.push(`/vehicles/${fillup?.vehicleId}/fillups?success=1`)
    } catch {
      setError('An error occurred. Please try again.')
      setIsSubmitting(false)
    }
  }

  if (status === 'loading' || isLoadingFillup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!isOnline) {
    return <OfflineNotice message="Editing a fillup requires an internet connection." />
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <Link
              href="/"
              className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              &larr; Back to Home
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Error
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {loadError}
            </p>
            <Link
              href="/"
              className="inline-block py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transition-colors"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!fillup) {
    return null
  }

  const locationDisplay = geocodedLocation ? formatLocation(geocodedLocation) : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto max-w-md px-4 py-6 pb-24">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/vehicles/${fillup.vehicleId}/fillups`}
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            &larr; Back to Fillups
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            Edit Fillup
          </h1>
        </div>

        {/* Vehicle Info (Read-only) */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">Vehicle</p>
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {fillup.vehicleName}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Core Inputs */}
          <div className="space-y-4">
            {/* Gallons */}
            <div>
              <label
                htmlFor="gallons"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Gallons
              </label>
              <input
                id="gallons"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={gallons}
                onChange={(e) => setGallons(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Price Per Gallon */}
            <div>
              <label
                htmlFor="pricePerGallon"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Price per Gallon
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-lg">
                  $
                </span>
                <input
                  id="pricePerGallon"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={pricePerGallon}
                  onChange={(e) => setPricePerGallon(e.target.value)}
                  placeholder="0.000"
                  required
                  className="w-full pl-8 pr-4 py-3 text-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Total Cost Display */}
            {totalCost && (
              <div className="text-center py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-lg font-semibold text-green-700 dark:text-green-400">
                  ${totalCost} total
                </span>
              </div>
            )}

            {/* Odometer */}
            <div>
              <label
                htmlFor="odometer"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Odometer
              </label>
              <input
                id="odometer"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="Current miles"
                required
                className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Location Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            {!useExistingLocation && (locationLoading || isGeocoding) ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-600 dark:text-gray-300">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Detecting location...
              </div>
            ) : locationDisplay ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-sm text-blue-700 dark:text-blue-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {locationDisplay}
                </div>
                <button
                  type="button"
                  onClick={handleDetectNewLocation}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Detect new location"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleClearLocation}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Clear location"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : !useExistingLocation && locationError ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {locationError}
                </span>
                <button
                  type="button"
                  onClick={handleDetectNewLocation}
                  className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  Retry
                </button>
              </div>
            ) : locationSupported ? (
              <button
                type="button"
                onClick={handleDetectNewLocation}
                className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Detect current location
              </button>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                No location set
              </span>
            )}
          </div>

          {/* Full Tank Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isFull"
              checked={isFull}
              onChange={(e) => setIsFull(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isFull" className="text-sm text-gray-700 dark:text-gray-300">
              Full tank
            </label>
          </div>

          {/* Date */}
          <div>
            {showDatePicker ? (
              <div className="space-y-2">
                <label
                  htmlFor="date"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Date & Time
                </label>
                <input
                  id="date"
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowDatePicker(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  Hide
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDatePicker(true)}
                className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Change date
              </button>
            )}
          </div>

          {/* Notes */}
          <div>
            {showNotes ? (
              <div className="space-y-2">
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any notes about this fillup..."
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowNotes(false)
                    setNotes('')
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  Hide
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNotes(true)}
                className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Add notes
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Fixed Submit Button */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={isSubmitting || !gallons || !pricePerGallon || !odometer}
          className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
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

export default function EditFillupPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <EditFillupForm />
    </Suspense>
  )
}
