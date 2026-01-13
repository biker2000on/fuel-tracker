'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

export default function AuthStatus() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-sm">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Sign in to start tracking your fuel consumption
          </p>
          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold rounded-lg shadow-sm transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="block w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-center font-medium rounded-lg transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Authenticated state - show dashboard link (this will rarely be seen due to redirect)
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

      <div className="mt-6 space-y-3">
        <Link
          href="/dashboard"
          className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold rounded-lg shadow-sm transition-colors"
        >
          Go to Dashboard
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
