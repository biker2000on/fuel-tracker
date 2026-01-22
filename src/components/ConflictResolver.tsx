'use client'

import { useState } from 'react'
import type { Conflict, ConflictResolution } from '@/lib/syncEngine'

interface ConflictResolverProps {
  conflict: Conflict
  onResolve: (resolution: ConflictResolution) => void
  onCancel?: () => void
}

export function ConflictResolver({
  conflict,
  onResolve,
  onCancel
}: ConflictResolverProps) {
  const [isResolving, setIsResolving] = useState(false)

  const { pendingFillup, serverFillups, reason } = conflict

  function formatDate(dateString: string): string {
    const datePart = dateString.split('T')[0]
    const [year, month, day] = datePart.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  async function handleResolve(resolution: ConflictResolution) {
    setIsResolving(true)
    onResolve(resolution)
  }

  const reasonText = reason === 'potential_duplicate'
    ? 'This appears to be a duplicate fillup'
    : 'A similar fillup was added from another device'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Sync Conflict Detected
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {reasonText}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Queued Fillup */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your Queued Fillup (offline)
            </h3>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Date:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {formatDate(pendingFillup.data.date)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Gallons:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {pendingFillup.data.gallons.toFixed(2)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 dark:text-gray-400">Odometer:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {pendingFillup.data.odometer.toLocaleString()} mi
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Server Fillups */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Server Fillup{serverFillups.length > 1 ? 's' : ''} (synced)
            </h3>
            <div className="space-y-2">
              {serverFillups.map((sf) => (
                <div
                  key={sf.id}
                  className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                >
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Date:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {formatDate(sf.date)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Gallons:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {sf.gallons.toFixed(2)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500 dark:text-gray-400">Odometer:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {sf.odometer.toLocaleString()} mi
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 space-y-3">
          <button
            onClick={() => handleResolve('keep_mine')}
            disabled={isResolving}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Keep Mine
            <span className="block text-xs font-normal opacity-80">
              Upload your queued fillup, recalculate MPG
            </span>
          </button>

          <button
            onClick={() => handleResolve('keep_server')}
            disabled={isResolving}
            className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Keep Server&apos;s
            <span className="block text-xs font-normal opacity-70">
              Discard your queued fillup, keep server data
            </span>
          </button>

          <button
            onClick={() => handleResolve('keep_both')}
            disabled={isResolving}
            className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Keep Both
            <span className="block text-xs font-normal opacity-70">
              Upload your fillup even if it might be a duplicate
            </span>
          </button>

          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isResolving}
              className="w-full py-2 px-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium transition-colors disabled:opacity-50"
            >
              Decide Later
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
