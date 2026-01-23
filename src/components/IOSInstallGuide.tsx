'use client'

import React from 'react'

export function IOSInstallGuide() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-xl border border-gray-100 dark:border-slate-700 max-w-sm mx-auto">
      <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Install on iOS
      </h3>
      
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
            1
          </div>
          <div className="flex-grow">
            <p className="text-gray-700 dark:text-slate-300">
              Tap the <span className="font-semibold text-gray-900 dark:text-white underline">Share</span> button in Safari's toolbar.
            </p>
            <div className="mt-2 flex justify-center py-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
            2
          </div>
          <div className="flex-grow">
            <p className="text-gray-700 dark:text-slate-300">
              Scroll down and tap <span className="font-semibold text-gray-900 dark:text-white underline">Add to Home Screen</span>.
            </p>
            <div className="mt-2 flex justify-center py-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
              <svg className="w-8 h-8 text-gray-700 dark:text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
            3
          </div>
          <div className="flex-grow">
            <p className="text-gray-700 dark:text-slate-300">
              Tap <span className="font-semibold text-gray-900 dark:text-white underline">Add</span> in the top right corner.
            </p>
          </div>
        </div>
      </div>
      
      <p className="mt-6 text-xs text-center text-gray-500 dark:text-slate-500 italic">
        Note: You must use Safari to install this app on iOS.
      </p>
    </div>
  )
}
