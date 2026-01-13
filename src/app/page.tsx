'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Home() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard')
    }
  }, [status, router])

  // Show loading while checking auth status
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 dark:from-gray-900 dark:to-gray-800">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  // Show landing page for unauthenticated users
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 dark:from-gray-900 dark:to-gray-800">
      <main className="flex flex-col items-center">
        <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-400 sm:text-5xl">
          Fuel Tracker
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 mb-8">
          Track fuel consumption across your vehicles
        </p>

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
      </main>
    </div>
  )
}
