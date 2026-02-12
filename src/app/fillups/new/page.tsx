'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { reverseGeocode, formatLocation, GeocodedLocation } from '@/lib/geocoding'

interface Vehicle {
  id: string
  name: string
  year: number
  make: string
  model: string
  photoUrl: string | null
}

function NewFillupForm() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedVehicleId = searchParams.get('vehicleId')

  // Vehicles state
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)

  // Form state
  const [gallons, setGallons] = useState('')
  const [pricePerGallon, setPricePerGallon] = useState('')
  const [odometer, setOdometer] = useState('')
  const [isFull, setIsFull] = useState(true)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 16) // Format for datetime-local input
  })
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

  // Offline queue
  const { isOnline, pendingCount, isSyncing, queueFillup, syncQueue } = useOfflineQueue()

  // Thousandths pricing state
  const [defaultThousandths, setDefaultThousandths] = useState<number>(0)

  // Submit state
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch vehicles on mount
  useEffect(() => {
    if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      fetchVehicles()
      // Fetch thousandths preference
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => {
          if (data.defaultThousandths !== undefined) {
            setDefaultThousandths(data.defaultThousandths)
          }
        })
        .catch(() => {})
      // Start location request immediately
      if (locationSupported) {
        requestLocation()
      }
    }
  }, [status, router, locationSupported, requestLocation])

  // Handle preselected vehicle or auto-select if only one
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicleId) {
      if (preselectedVehicleId && vehicles.some(v => v.id === preselectedVehicleId)) {
        setSelectedVehicleId(preselectedVehicleId)
      } else if (vehicles.length === 1) {
        setSelectedVehicleId(vehicles[0].id)
      }
    }
  }, [vehicles, preselectedVehicleId, selectedVehicleId])

  // Reverse geocode when coordinates are available
  useEffect(() => {
    if (latitude && longitude && !geocodedLocation && !isGeocoding) {
      setIsGeocoding(true)
      reverseGeocode(latitude, longitude)
        .then(setGeocodedLocation)
        .finally(() => setIsGeocoding(false))
    }
  }, [latitude, longitude, geocodedLocation, isGeocoding])

  // Fetch user's thousandths pricing preference
  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => {
          if (data.defaultThousandths !== undefined) {
            setDefaultThousandths(data.defaultThousandths)
          }
        })
        .catch(() => {})
    }
  }, [status])

  async function fetchVehicles() {
    try {
      const response = await fetch('/api/vehicles')
      if (response.ok) {
        const data = await response.json()
        setVehicles(data.vehicles)
      }
    } catch {
      setError('Failed to load vehicles')
    } finally {
      setIsLoadingVehicles(false)
    }
  }

  const handleRefreshLocation = useCallback(() => {
    setGeocodedLocation(null)
    requestLocation()
  }, [requestLocation])

  const handleClearLocation = useCallback(() => {
    setGeocodedLocation(null)
  }, [])

  // Calculate effective price with thousandths adjustment
  const effectivePrice = (() => {
    if (!pricePerGallon) return null
    const ppg = parseFloat(pricePerGallon)
    if (isNaN(ppg)) return null
    const decimalPlaces = pricePerGallon.includes('.')
      ? pricePerGallon.split('.')[1]?.length || 0
      : 0
    if (defaultThousandths > 0 && decimalPlaces <= 2) {
      return Math.round((ppg + defaultThousandths) * 1000) / 1000
    }
    return ppg
  })()

  // Calculate total cost
  const totalCost = gallons && effectivePrice
    ? (parseFloat(gallons) * effectivePrice).toFixed(2)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!selectedVehicleId) {
      setError('Please select a vehicle')
      return
    }

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

    const fillupData = {
      vehicleId: selectedVehicleId,
      date: new Date(date).toISOString(),
      gallons: gallonsNum,
      pricePerGallon: priceNum,
      pricePerGallonRaw: pricePerGallon,
      odometer: odometerNum,
      isFull,
      notes: notes.trim() || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      city: geocodedLocation?.city ?? null,
      state: geocodedLocation?.state ?? null,
      country: geocodedLocation?.country ?? null
    }

    // If offline, queue the fillup locally
    if (!isOnline) {
      try {
        await queueFillup(fillupData)
        setSuccessMessage('Saved offline - will sync when connected')
        // Reset form
        setGallons('')
        setPricePerGallon('')
        setOdometer('')
        setNotes('')
        setShowNotes(false)
        setIsSubmitting(false)
        return
      } catch {
        setError('Failed to save offline. Please try again.')
        setIsSubmitting(false)
        return
      }
    }

    // Online: submit directly to API
    try {
      const response = await fetch('/api/fillups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fillupData)
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to log fillup')
        setIsSubmitting(false)
        return
      }

      // Success - navigate to vehicle's fillups page
      router.push(`/vehicles/${selectedVehicleId}/fillups?success=1`)
    } catch {
      // Network error - queue offline
      try {
        await queueFillup(fillupData)
        setSuccessMessage('Connection lost - saved offline for later sync')
        // Reset form
        setGallons('')
        setPricePerGallon('')
        setOdometer('')
        setNotes('')
        setShowNotes(false)
        setIsSubmitting(false)
      } catch {
        setError('An error occurred. Please try again.')
        setIsSubmitting(false)
      }
    }
  }

  if (status === 'loading' || isLoadingVehicles) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (vehicles.length === 0) {
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
              No Vehicles Available
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Add a vehicle before logging fillups.
            </p>
            <Link
              href="/vehicles/new"
              className="inline-block py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transition-colors"
            >
              Add Vehicle
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const locationDisplay = geocodedLocation ? formatLocation(geocodedLocation) : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto max-w-md px-4 py-6 pb-24">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            &larr; Back
          </Link>
          <div className="flex items-center justify-between mt-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Log Fillup
            </h1>
            {/* Offline indicator */}
            {!isOnline && (
              <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                Offline
              </span>
            )}
          </div>
          {/* Pending sync count */}
          {pendingCount > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {pendingCount} fillup{pendingCount !== 1 ? 's' : ''} pending sync
              </span>
              {isOnline && !isSyncing && (
                <button
                  type="button"
                  onClick={() => syncQueue()}
                  className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
                >
                  Sync Now
                </button>
              )}
              {isSyncing && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Syncing...
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 rounded-md text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400 rounded-md text-sm">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vehicle Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Vehicle
            </label>
            <div className="grid grid-cols-2 gap-3">
              {vehicles.map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => setSelectedVehicleId(vehicle.id)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    selectedVehicleId === vehicle.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="w-full aspect-video relative rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700 mb-2">
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
                          className="w-8 h-8 text-gray-400 dark:text-gray-500"
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
                  <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {vehicle.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {vehicle.year} {vehicle.make}
                  </p>
                </button>
              ))}
            </div>
          </div>

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
              {/* Thousandths adjustment hint */}
              {defaultThousandths > 0 && pricePerGallon && (() => {
                const decimalPlaces = pricePerGallon.includes('.')
                  ? pricePerGallon.split('.')[1]?.length || 0
                  : 0
                if (decimalPlaces <= 2) {
                  const adjusted = (parseFloat(pricePerGallon) + defaultThousandths).toFixed(3)
                  return (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Effective price: ${adjusted}/gal (includes +${defaultThousandths.toFixed(3)})
                    </p>
                  )
                }
                return null
              })()}
            </div>

            {/* Total Cost Display */}
            {totalCost && (
              <div className="text-center py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-lg font-semibold text-green-700 dark:text-green-400">
                  ${totalCost} total
                </span>
                {defaultThousandths > 0 && pricePerGallon && (() => {
                  const decimalPlaces = pricePerGallon.includes('.')
                    ? pricePerGallon.split('.')[1]?.length || 0
                    : 0
                  if (decimalPlaces <= 2 && effectivePrice) {
                    return (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Effective price: ${effectivePrice.toFixed(3)}/gal (includes +${defaultThousandths.toFixed(3)})
                      </p>
                    )
                  }
                  return null
                })()}
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
          <div className="flex items-center gap-2">
            {locationLoading || isGeocoding ? (
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
                  onClick={handleRefreshLocation}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Refresh location"
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
            ) : locationError ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {locationError}
                </span>
                <button
                  type="button"
                  onClick={handleRefreshLocation}
                  className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  Retry
                </button>
              </div>
            ) : !locationSupported ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Location not available
              </span>
            ) : null}
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
          form="fillup-form"
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedVehicleId || !gallons || !pricePerGallon || !odometer}
          className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Logging...' : 'Log Fillup'}
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

export default function NewFillupPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <NewFillupForm />
    </Suspense>
  )
}
