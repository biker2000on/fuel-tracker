'use client'

import { useSession, signOut } from 'next-auth/react'

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
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-sm">
      <div className="text-center">
        <p className="text-xl font-semibold text-gray-900">
          Welcome{session.user.name ? `, ${session.user.name}` : ''}!
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {session.user.email}
        </p>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="mt-6 w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      >
        Sign out
      </button>
    </div>
  )
}
