'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { OfflineNotice } from '@/components/OfflineNotice'

interface Group {
  id: string
  name: string
  role: 'owner' | 'member'
  memberCount: number
  joinedAt: string
  inviteCode?: string
}

export default function GroupsPage() {
  const { status } = useSession()
  const router = useRouter()
  const { isOnline } = useNetworkStatus()
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      fetchGroups()
    }
  }, [status, router, isOnline])

  async function fetchGroups() {
    try {
      const response = await fetch('/api/groups')
      if (!response.ok) {
        throw new Error('Failed to fetch groups')
      }
      const data = await response.json()
      setGroups(data.groups)
    } catch {
      setError('Failed to load groups')
    } finally {
      setIsLoading(false)
    }
  }

  async function copyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = code
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    }
  }

  if (!isOnline) {
    return <OfflineNotice message="Groups list requires an internet connection." />
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            &larr; Back to Home
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Your Groups
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 mb-6">
          <Link
            href="/groups/new"
            className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm text-center transition-colors"
          >
            Create Group
          </Link>
          <Link
            href="/groups/join"
            className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md shadow-sm text-center transition-colors"
          >
            Join Group
          </Link>
        </div>

        {groups.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No groups yet. Create or join a family group to share vehicles.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div
                key={group.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {group.name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      group.role === 'owner'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {group.role === 'owner' ? 'Owner' : 'Member'}
                  </span>
                </div>

                {group.role === 'owner' && group.inviteCode && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Invite Code
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 py-1 bg-gray-50 dark:bg-gray-700 rounded text-sm font-mono text-gray-800 dark:text-gray-200">
                        {group.inviteCode}
                      </code>
                      <button
                        onClick={() => copyInviteCode(group.inviteCode!)}
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded transition-colors"
                      >
                        {copiedCode === group.inviteCode ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
