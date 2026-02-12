'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { OfflineNotice } from '@/components/OfflineNotice'

export default function JoinGroupPage() {
  const { status } = useSession()
  const router = useRouter()
  const { isOnline } = useNetworkStatus()
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
    router.push('/login')
    return null
  }
  if (!isOnline) {
    return <OfflineNotice message="Joining a group requires an internet connection." />
  }

  function handleInviteCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Auto-uppercase and remove any non-alphanumeric characters
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    setInviteCode(value.slice(0, 8))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/groups/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 404) {
          setError('Invalid invite code. Please check and try again.')
        } else if (response.status === 409) {
          setError('You are already a member of this group.')
        } else {
          setError(data.error || 'Failed to join group')
        }
        setIsLoading(false)
        return
      }

      // Success - redirect to groups page
      router.push('/groups')
    } catch {
      setError('An error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
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
            href="/groups"
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            &larr; Back to Groups
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-6">
            Join Group
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="inviteCode"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Invite Code
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={handleInviteCodeChange}
                required
                maxLength={8}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-center text-lg tracking-wider uppercase"
                placeholder="ABC12DEF"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter the 8-character code from the group owner
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/groups"
                className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-md text-center transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isLoading || inviteCode.length !== 8}
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Joining...' : 'Join Group'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
