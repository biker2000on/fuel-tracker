'use client'

import { useState } from 'react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export function InstallButton() {
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt()
  const [showSuccess, setShowSuccess] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  const handleInstall = async () => {
    setIsInstalling(true)
    try {
      const success = await promptInstall()
      if (success) {
        setShowSuccess(true)
        setTimeout(() => setShowSuccess(false), 3000)
      }
    } finally {
      setIsInstalling(false)
    }
  }

  // Already installed - show status badge
  if (isInstalled) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex-shrink-0 w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div>
          <p className="font-medium text-green-800 dark:text-green-200">
            Installed
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">
            App is ready on your home screen
          </p>
        </div>
      </div>
    )
  }

  // Can install - show install button
  if (canInstall) {
    return (
      <div className="space-y-3">
        <button
          onClick={handleInstall}
          disabled={isInstalling}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-green-600 hover:bg-green-500 disabled:bg-green-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {isInstalling ? 'Installing...' : 'Add to Home Screen'}
        </button>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Quick access at the pump
        </p>

        {/* Success Toast */}
        {showSuccess && (
          <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up">
            <div className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
              Added to home screen!
            </div>
          </div>
        )}
      </div>
    )
  }

  // Not installable (iOS Safari, desktop without support, etc.) - show nothing
  return null
}
