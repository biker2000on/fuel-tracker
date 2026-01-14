'use client'

import { useState, useEffect } from 'react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

const DISMISS_KEY = 'install-prompt-dismissed'
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
const VISIT_COUNT_KEY = 'install-prompt-visits'
const MIN_VISITS_BEFORE_PROMPT = 2

export function InstallPrompt() {
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt()
  const [isDismissed, setIsDismissed] = useState(true)
  const [showToast, setShowToast] = useState(false)
  const [hasEnoughVisits, setHasEnoughVisits] = useState(false)

  useEffect(() => {
    // Track visit count
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10)
    const newCount = visitCount + 1
    localStorage.setItem(VISIT_COUNT_KEY, newCount.toString())
    setHasEnoughVisits(newCount >= MIN_VISITS_BEFORE_PROMPT)

    // Check if prompt was dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10)
      const now = Date.now()
      if (now - dismissedTime < DISMISS_DURATION) {
        setIsDismissed(true)
        return
      }
    }
    setIsDismissed(false)
  }, [])

  const handleInstall = async () => {
    const success = await promptInstall()
    if (success) {
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setIsDismissed(true)
  }

  // Don't show if already installed, dismissed, not installable, or not enough visits
  if (isInstalled || isDismissed || !canInstall || !hasEnoughVisits) {
    return showToast ? (
      <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up">
        <div className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          Added to home screen!
        </div>
      </div>
    ) : null
  }

  return (
    <>
      {/* Install Banner */}
      <div
        className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-4">
          <div className="flex items-start gap-3">
            {/* App Icon */}
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium">
                Install Fuel Tracker
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                Quick access at the pump
              </p>
            </div>

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-slate-400 hover:text-white transition-colors p-1"
              aria-label="Dismiss"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleDismiss}
              className="flex-1 py-2 px-3 text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
            >
              Not now
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Install
            </button>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {showToast && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up">
          <div className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
            Added to home screen!
          </div>
        </div>
      )}
    </>
  )
}
