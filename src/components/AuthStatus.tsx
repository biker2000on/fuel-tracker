'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

interface Group {
  id: string
  name: string
  role: 'owner' | 'member'
  memberCount: number
}

export default function AuthStatus() {
  const { data: session, status } = useSession()
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoadingGroups, setIsLoadingGroups] = useState(false)

  useEffect(() => {
    if (session?.user) {
      fetchGroups()
    }
  }, [session])

  async function fetchGroups() {
    setIsLoadingGroups(true)
    try {
      const response = await fetch('/api/groups')
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups)
      }
    } catch {
      // Silently fail - groups are not critical for the home page
    } finally {
      setIsLoadingGroups(false)
    }
  }

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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-sm">
      <div className="text-center">
        <p className="text-xl font-semibold text-gray-900 dark:text-white">
          Welcome{session.user.name ? `, ${session.user.name}` : ''}!
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {session.user.email}
        </p>
      </div>

      {/* Groups Section */}
      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Your Groups
          </h2>
          <Link
            href="/groups"
            className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            Manage
          </Link>
        </div>

        {isLoadingGroups ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading groups...</p>
        ) : groups.length === 0 ? (
          <div className="text-center py-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Join or create a family group to share vehicles
            </p>
            <Link
              href="/groups"
              className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
            >
              Get started
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {groups.map((group) => (
              <li
                key={group.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-md"
              >
                <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                  {group.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="mt-6 w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      >
        Sign out
      </button>
    </div>
  )
}
