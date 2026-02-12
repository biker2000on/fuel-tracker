'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { getCachedVehicles } from '@/lib/offlineDb'
import { OfflineNotice } from '@/components/OfflineNotice'

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

export default function VehiclesPage() {
  const { status } = useSession()
  const router = useRouter()
  const { isOnline } = useNetworkStatus()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isShowingCached, setIsShowingCached] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
      router.push('/login')
      return
    }

    if (status === 'unauthenticated' && !isOnline) {
      getCachedVehicles().then(cached => {
        if (cached && cached.length > 0) {
          setVehicles(cached.map(v => ({
            ...v,
            createdAt: '',
            updatedAt: '',
          })))
          setIsShowingCached(true)
        }
        setIsLoading(false)
      }).catch(() => {
        setIsLoading(false)
      })
      return
    }

    if (status === 'authenticated') {
      fetchVehicles()
    }
  }, [status, router, isOnline])

  async function fetchVehicles() {
    try {
      const response = await fetch('/api/vehicles')
      if (!response.ok) {
        throw new Error('Failed to fetch vehicles')
      }
      const data = await response.json()
      setVehicles(data.vehicles)
    } catch {
      setError('Failed to load vehicles')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!isOnline && !isShowingCached && vehicles.length === 0) {
    return <OfflineNotice message="Vehicles list is not available offline. Visit the dashboard while online to cache your vehicles." />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            &larr; Back to Home
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Your Vehicles
        </h1>

        {isShowingCached && (
          <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Showing cached data</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
              You are viewing previously loaded vehicles. Some data may be out of date.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="mb-6">
          <Link
            href="/vehicles/new"
            className="inline-block py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transition-colors"
          >
            Add Vehicle
          </Link>
        </div>

        {vehicles.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No vehicles yet. Add your first vehicle to start tracking fuel.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((vehicle) => (
              <Link
                key={vehicle.id}
                href={`/vehicles/${vehicle.id}`}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="aspect-video relative bg-gray-100 dark:bg-gray-700">
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
                        className="w-16 h-16 text-gray-400 dark:text-gray-500"
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
                <div className="p-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {vehicle.name}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {vehicle.groupName}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
