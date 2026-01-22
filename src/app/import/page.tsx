'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseCSV } from '@/lib/csvParser'
import { CsvPreview } from '@/components/CsvPreview'

interface Vehicle {
  id: string
  name: string
  year: number
  make: string
  model: string
}

interface ValidationError {
  row: number
  field: string
  message: string
}

interface ImportResult {
  success: boolean
  imported?: number
  errors?: ValidationError[]
}

function ImportForm() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedVehicleId = searchParams.get('vehicleId')

  // Vehicles state
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')

  // File state
  const [file, setFile] = useState<File | null>(null)
  const [csvContent, setCsvContent] = useState<string>('')
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([])
  const [parseError, setParseError] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)

  // Import state
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  // Fetch vehicles on mount
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      fetchVehicles()
    }
  }, [status, router])

  // Handle preselected vehicle
  useEffect(() => {
    if (vehicles.length > 0 && preselectedVehicleId) {
      const found = vehicles.find(v => v.id === preselectedVehicleId)
      if (found) {
        setSelectedVehicleId(preselectedVehicleId)
      }
    }
  }, [vehicles, preselectedVehicleId])

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

  const handleFileRead = useCallback((fileContent: string, fileName: string) => {
    setCsvContent(fileContent)
    setParseError('')
    setImportResult(null)

    try {
      const parsed = parseCSV(fileContent)
      if (parsed.length === 0) {
        setParseError('CSV file is empty or has no data rows')
        setParsedData([])
      } else {
        setParsedData(parsed)
      }
    } catch (err) {
      setParseError('Failed to parse CSV file')
      setParsedData([])
    }
  }, [])

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please select a CSV file')
      return
    }

    setFile(selectedFile)
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      handleFileRead(content, selectedFile.name)
    }
    reader.onerror = () => {
      setParseError('Failed to read file')
    }
    reader.readAsText(selectedFile)
  }, [handleFileRead])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [handleFileSelect])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }, [handleFileSelect])

  const handleClearFile = useCallback(() => {
    setFile(null)
    setCsvContent('')
    setParsedData([])
    setParseError('')
    setImportResult(null)
  }, [])

  async function handleImport() {
    if (!selectedVehicleId || !csvContent) return

    setIsImporting(true)
    setError('')
    setImportResult(null)

    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: selectedVehicleId,
          csv: csvContent
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setImportResult({
          success: true,
          imported: data.imported
        })
      } else if (data.errors) {
        setImportResult({
          success: false,
          errors: data.errors
        })
      } else {
        setError(data.error || 'Import failed')
      }
    } catch {
      setError('An error occurred during import. Please try again.')
    } finally {
      setIsImporting(false)
    }
  }

  if (status === 'loading' || isLoadingVehicles) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (vehicles.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
        <div className="mx-auto max-w-lg">
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
              Add a vehicle before importing fillups.
            </p>
            <Link
              href="/vehicles/new"
              className="inline-block py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md shadow-sm transition-colors"
            >
              Add Vehicle
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const canImport = selectedVehicleId && parsedData.length > 0 && !parseError && !isImporting

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8 pb-24">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            &larr; Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            Import Fillups
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Import historical fillup data from a CSV file
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Success Result */}
        {importResult?.success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-semibold">Import Successful!</span>
            </div>
            <p className="text-green-600 dark:text-green-300 text-sm mb-3">
              Imported {importResult.imported} fillup{importResult.imported !== 1 ? 's' : ''}
            </p>
            <Link
              href={`/vehicles/${selectedVehicleId}/fillups`}
              className="inline-block text-sm text-green-700 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300 font-medium"
            >
              View fillup history &rarr;
            </Link>
          </div>
        )}

        {/* Validation Errors Result */}
        {importResult?.errors && importResult.errors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold">Validation Errors</span>
            </div>
            <p className="text-red-600 dark:text-red-300 text-sm mb-3">
              Please fix the following errors and try again:
            </p>
            <div className="max-h-48 overflow-auto space-y-1">
              {importResult.errors.map((err, index) => (
                <p key={index} className="text-sm text-red-600 dark:text-red-300">
                  Row {err.row}: <span className="font-medium">{err.field}</span> {err.message}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Vehicle Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <label
              htmlFor="vehicle"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Select Vehicle
            </label>
            <select
              id="vehicle"
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Choose a vehicle...</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name} ({vehicle.year} {vehicle.make} {vehicle.model})
                </option>
              ))}
            </select>
          </div>

          {/* File Upload */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              CSV File
            </label>

            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  Drag and drop your CSV file here
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">or</p>
                <label className="inline-block cursor-pointer">
                  <span className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-md transition-colors">
                    Browse Files
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleInputChange}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <svg
                    className="h-8 w-8 text-green-600 dark:text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {parsedData.length} row{parsedData.length !== 1 ? 's' : ''} detected
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                  title="Remove file"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {parseError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{parseError}</p>
            )}
          </div>

          {/* CSV Preview */}
          {parsedData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Preview ({parsedData.length} row{parsedData.length !== 1 ? 's' : ''})
              </h2>
              <CsvPreview data={parsedData} maxRows={10} />
            </div>
          )}

          {/* Expected Format Info */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Expected CSV Format
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              Required columns: <span className="text-gray-900 dark:text-gray-300">date, gallons, pricePerGallon, odometer</span>
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Optional columns: <span className="text-gray-900 dark:text-gray-300">isFull, notes, city, state, country, latitude, longitude</span>
            </p>
            <div className="mt-3 p-2 bg-white dark:bg-gray-900 rounded text-xs font-mono text-gray-600 dark:text-gray-400 overflow-x-auto">
              date,gallons,pricePerGallon,odometer,isFull,notes<br />
              2024-01-15,12.5,3.29,45000,true,Shell station
            </div>
          </div>
        </div>

        {/* Import Button */}
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="max-w-lg mx-auto">
            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              className="w-full py-4 px-4 bg-green-600 hover:bg-green-700 text-white text-lg font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isImporting ? 'Importing...' : `Import ${parsedData.length > 0 ? parsedData.length : ''} Fillup${parsedData.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="text-gray-500 dark:text-gray-400">Loading...</div>
    </div>
  )
}

export default function ImportPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ImportForm />
    </Suspense>
  )
}
