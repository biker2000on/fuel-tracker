'use client'

import { useState, useEffect, useRef, use } from 'react'
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
}

const FUEL_TYPES = [
  { value: 'regular', label: 'Regular' },
  { value: 'premium', label: 'Premium' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'e85', label: 'E85' },
]

export default function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { status } = useSession()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(true)

  const [name, setName] = useState('')
  const [year, setYear] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [tankSize, setTankSize] = useState('')
  const [fuelType, setFuelType] = useState('regular')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      fetchVehicle()
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
        setIsLoadingVehicle(false)
        return
      }
      const data = await response.json()
      setVehicle(data)
      setName(data.name)
      setYear(data.year.toString())
      setMake(data.make)
      setModel(data.model)
      setTankSize(data.tankSize ? data.tankSize.toString() : '')
      setFuelType(data.fuelType)
      setPhotoUrl(data.photoUrl)
    } catch {
      setError('Failed to load vehicle')
    } finally {
      setIsLoadingVehicle(false)
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

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

    setError('')
    setIsUploadingPhoto(true)

    try {
      const formData = new FormData()
      formData.append('photo', file)

      const response = await fetch(`/api/vehicles/${id}/photo`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to upload photo')
        return
      }

      const data = await response.json()
      setPhotoUrl(data.photoUrl)
    } catch {
      setError('Failed to upload photo')
    } finally {
      setIsUploadingPhoto(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function handleRemovePhoto() {
    setIsDeletingPhoto(true)
    setError('')

    try {
      const response = await fetch(`/api/vehicles/${id}/photo`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setPhotoUrl(null)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to remove photo')
      }
    } catch {
      setError('Failed to remove photo')
    } finally {
      setIsDeletingPhoto(false)
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
      const response = await fetch(`/api/vehicles/${id}`, {
        method: 'PATCH',
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
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to update vehicle')
        setIsLoading(false)
        return
      }

      router.push(`/vehicles/${id}`)
    } catch {
      setError('An error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  if (status === 'loading' || isLoadingVehicle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error && !vehicle) {
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
              {error}
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
            href={`/vehicles/${id}`}
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            &larr; Back to Vehicle
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-6">
            Edit Vehicle
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Photo Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Photo
              </label>
              <div className="flex items-start gap-4">
                <div className="w-32 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 relative">
                  {photoUrl ? (
                    <Image
                      src={photoUrl}
                      alt={name || 'Vehicle'}
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
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                    disabled={isUploadingPhoto || isDeletingPhoto}
                    className="text-sm text-gray-500 dark:text-gray-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-medium
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      dark:file:bg-blue-900 dark:file:text-blue-200
                      disabled:opacity-50"
                  />
                  {isUploadingPhoto && (
                    <span className="text-sm text-blue-600 dark:text-blue-400">
                      Uploading...
                    </span>
                  )}
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      disabled={isDeletingPhoto || isUploadingPhoto}
                      className="text-sm text-red-600 hover:text-red-500 dark:text-red-400 disabled:opacity-50 text-left"
                    >
                      {isDeletingPhoto ? 'Removing...' : 'Remove Photo'}
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

            {/* Group (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Group
              </label>
              <div className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-md">
                {vehicle?.groupName}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Group cannot be changed
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading || isUploadingPhoto || isDeletingPhoto || !name.trim() || !year || !make.trim() || !model.trim()}
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <Link
                href={`/vehicles/${id}`}
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
