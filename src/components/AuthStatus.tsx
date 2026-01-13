'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'

interface Group {
  id: string
  name: string
  role: 'owner' | 'member'
  memberCount: number
}

interface Vehicle {
  id: string
  name: string
  year: number
  make: string
  model: string
  photoUrl: string | null
  groupName: string
}

export default function AuthStatus() {
  const { data: session, status } = useSession()
  const [groups, setGroups] = useState<Group[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isLoadingGroups, setIsLoadingGroups] = useState(false)
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false)

  useEffect(() => {
    if (session?.user) {
      fetchGroups()
      fetchVehicles()
    }
  }, [session])

  async function fetchGroups() {
    setIsLoadingGroups(true)
    try {
      const response = await fetch('/api/groups')
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups)
      }
    } catch {
      // Silently fail - groups are not critical for the home page
    } finally {
      setIsLoadingGroups(false)
    }
  }

  async function fetchVehicles() {
    setIsLoadingVehicles(true)
    try {
      const response = await fetch('/api/vehicles')
      if (response.ok) {
        const data = await response.json()
        setVehicles(data.vehicles)
      }
    } catch {
      // Silently fail - vehicles are not critical for the home page
    } finally {
      setIsLoadingVehicles(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  const displayedVehicles = vehicles.slice(0, 4)
  const remainingVehiclesCount = vehicles.length - displayedVehicles.length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-sm">
      <div className="text-center">
        <p className="text-xl font-semibold text-gray-900 dark:text-white">
          Welcome{session.user.name ? `, ${session.user.name}` : ''}!
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {session.user.email}
        </p>
      </div>

      {/* Groups Section */}
      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Your Groups
          </h2>
          <Link
            href="/groups"
            className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            Manage
          </Link>
        </div>

        {isLoadingGroups ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading groups...</p>
        ) : groups.length === 0 ? (
          <div className="text-center py-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Join or create a family group to share vehicles
            </p>
            <Link
              href="/groups"
              className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
            >
              Get started
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {groups.map((group) => (
              <li
                key={group.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-md"
              >
                <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                  {group.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Vehicles Section */}
      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Your Vehicles
          </h2>
          <Link
            href="/vehicles"
            className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            Manage
          </Link>
        </div>

        {isLoadingVehicles ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading vehicles...</p>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Add vehicles to start tracking fuel
            </p>
            <Link
              href="/vehicles/new"
              className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
            >
              Add your first vehicle
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedVehicles.map((vehicle) => (
              <Link
                key={vehicle.id}
                href={`/vehicles/${vehicle.id}`}
                className="flex items-center gap-3 py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0 relative">
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
                        className="w-5 h-5 text-gray-400 dark:text-gray-500"
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
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">
                    {vehicle.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </p>
                </div>
              </Link>
            ))}
            {remainingVehiclesCount > 0 && (
              <Link
                href="/vehicles"
                className="block text-center py-2 text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
              >
                +{remainingVehiclesCount} more
              </Link>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="mt-6 w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      >
        Sign out
      </button>
    </div>
  )
}
