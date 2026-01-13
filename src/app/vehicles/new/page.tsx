'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface Group {
  id: string
  name: string
  role: 'owner' | 'member'
  memberCount: number
}

const FUEL_TYPES = [
  { value: 'regular', label: 'Regular' },
  { value: 'premium', label: 'Premium' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'e85', label: 'E85' },
]

export default function NewVehiclePage() {
  const { status } = useSession()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [groups, setGroups] = useState<Group[]>([])
  const [isLoadingGroups, setIsLoadingGroups] = useState(true)

  const [name, setName] = useState('')
  const [year, setYear] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [tankSize, setTankSize] = useState('')
  const [fuelType, setFuelType] = useState('regular')
  const [groupId, setGroupId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      fetchGroups()
    }
  }, [status, router])

  async function fetchGroups() {
    try {
      const response = await fetch('/api/groups')
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups)
        if (data.groups.length > 0) {
          setGroupId(data.groups[0].id)
        }
      }
    } catch {
      setError('Failed to load groups')
    } finally {
      setIsLoadingGroups(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!validTypes.includes(file.type)) {
        setError('Please select a JPEG, PNG, or WebP image')
        return
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB')
        return
      }

      setSelectedFile(file)
      setPhotoPreview(URL.createObjectURL(file))
      setError('')
    }
  }

  function clearPhoto() {
    setSelectedFile(null)
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Validate year
    const yearNum = parseInt(year, 10)
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      setError('Year must be between 1900 and 2100')
      setIsLoading(false)
      return
    }

    // Validate tank size if provided
    let tankSizeNum: number | null = null
    if (tankSize.trim()) {
      tankSizeNum = parseFloat(tankSize)
      if (isNaN(tankSizeNum) || tankSizeNum <= 0) {
        setError('Tank size must be a positive number')
        setIsLoading(false)
        return
      }
    }

    try {
      // Step 1: Create vehicle
      const vehicleResponse = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          year: yearNum,
          make: make.trim(),
          model: model.trim(),
          tankSize: tankSizeNum,
          fuelType,
          groupId,
        }),
      })

      const vehicleData = await vehicleResponse.json()

      if (!vehicleResponse.ok) {
        setError(vehicleData.error || 'Failed to create vehicle')
        setIsLoading(false)
        return
      }

      // Step 2: Upload photo if selected
      if (selectedFile) {
        const formData = new FormData()
        formData.append('photo', selectedFile)

        const photoResponse = await fetch(`/api/vehicles/${vehicleData.id}/photo`, {
          method: 'POST',
          body: formData,
        })

        if (!photoResponse.ok) {
          // Vehicle created but photo failed - still redirect
          console.error('Photo upload failed')
        }
      }

      // Navigate to vehicle detail page
      router.push(`/vehicles/${vehicleData.id}`)
    } catch {
      setError('An error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  if (status === 'loading' || isLoadingGroups) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (groups.length === 0) {
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

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              No Groups Available
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You need to join or create a group before adding a vehicle.
            </p>
            <Link
              href="/groups"
              className="inline-block py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transition-colors"
            >
              Manage Groups
            </Link>
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

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-6">
            Add Vehicle
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Photo (optional)
              </label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 relative">
                  {photoPreview ? (
                    <Image
                      src={photoPreview}
                      alt="Vehicle preview"
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
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="text-sm text-gray-500 dark:text-gray-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-medium
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      dark:file:bg-blue-900 dark:file:text-blue-200"
                  />
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="text-sm text-red-600 hover:text-red-500 dark:text-red-400"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Vehicle Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Mom's SUV"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                A friendly name for this vehicle
              </p>
            </div>

            {/* Year */}
            <div>
              <label
                htmlFor="year"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Year
              </label>
              <input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
                min={1900}
                max={2100}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 2022"
              />
            </div>

            {/* Make */}
            <div>
              <label
                htmlFor="make"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Make
              </label>
              <input
                id="make"
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                required
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Toyota"
              />
            </div>

            {/* Model */}
            <div>
              <label
                htmlFor="model"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Model
              </label>
              <input
                id="model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                required
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., RAV4"
              />
            </div>

            {/* Tank Size */}
            <div>
              <label
                htmlFor="tankSize"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Tank Size (gallons, optional)
              </label>
              <input
                id="tankSize"
                type="number"
                value={tankSize}
                onChange={(e) => setTankSize(e.target.value)}
                step="0.1"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 14.5"
              />
            </div>

            {/* Fuel Type */}
            <div>
              <label
                htmlFor="fuelType"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Fuel Type
              </label>
              <select
                id="fuelType"
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {FUEL_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Group */}
            <div>
              <label
                htmlFor="groupId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Group
              </label>
              <select
                id="groupId"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                This cannot be changed after creation
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading || !name.trim() || !year || !make.trim() || !model.trim() || !groupId}
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Creating...' : 'Add Vehicle'}
              </button>
              <Link
                href="/vehicles"
                className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-md text-center transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
