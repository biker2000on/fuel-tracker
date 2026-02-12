'use client'

interface OfflineNoticeProps {
  message: string
}

export function OfflineNotice({ message }: OfflineNoticeProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">You are offline</p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">{message}</p>
        </div>
      </div>
    </div>
  )
}
