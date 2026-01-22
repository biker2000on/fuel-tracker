'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { InstallButton } from '@/components/InstallButton'
import { useTheme } from '@/contexts/ThemeContext'

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  // Profile editing state
  const [name, setName] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Initialize name from session
  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name)
    }
  }, [session?.user?.name])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save profile')
      }

      // Update session with new name
      await updateSession({ name: name.trim() })
      setIsEditing(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setName(session?.user?.name || '')
    setIsEditing(false)
    setSaveError(null)
  }

  // Password validation
  const passwordValidation = {
    allFieldsFilled: currentPassword && newPassword && confirmPassword,
    newPasswordLongEnough: newPassword.length >= 8,
    passwordsMatch: newPassword === confirmPassword,
  }
  const canChangePassword =
    passwordValidation.allFieldsFilled &&
    passwordValidation.newPasswordLongEnough &&
    passwordValidation.passwordsMatch

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canChangePassword) return

    setIsChangingPassword(true)
    setPasswordError(null)
    setPasswordSuccess(false)

    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to change password')
      }

      // Clear form and show success
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/dashboard"
            className="p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-label="Back to dashboard"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Profile
          </h1>
        </div>

        {/* Account Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Account
            </h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                Edit
              </button>
            )}
          </div>

          {saveSuccess && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm text-green-700 dark:text-green-300">
                Profile updated successfully
              </p>
            </div>
          )}

          {saveError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-700 dark:text-red-300">{saveError}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Email
              </label>
              <p className="text-gray-900 dark:text-white">
                {session?.user?.email || 'Not available'}
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your name"
                  maxLength={100}
                />
              ) : (
                <p className="text-gray-900 dark:text-white">
                  {session?.user?.name || 'Not set'}
                </p>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* App Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
            App
          </h2>
          <InstallButton />
        </div>

        {/* Preferences Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
            Preferences
          </h2>
          <div>
            <p className="text-gray-900 dark:text-white">Theme</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Choose your preferred appearance
            </p>
            <div className="inline-flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              <button
                onClick={() => setTheme('light')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  theme === 'light'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Light
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-x border-gray-300 dark:border-gray-600 ${
                  theme === 'dark'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Dark
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  theme === 'system'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                System
              </button>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-4 mb-20">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
            Security
          </h2>

          {passwordSuccess && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm text-green-700 dark:text-green-300">
                Password changed successfully
              </p>
            </div>
          )}

          {passwordError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-700 dark:text-red-300">{passwordError}</p>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label
                htmlFor="currentPassword"
                className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
              >
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label
                htmlFor="newPassword"
                className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
              >
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter new password (min 8 characters)"
              />
              {newPassword && !passwordValidation.newPasswordLongEnough && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  Password must be at least 8 characters
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
              >
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Confirm new password"
              />
              {confirmPassword && !passwordValidation.passwordsMatch && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  Passwords do not match
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isChangingPassword || !canChangePassword}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {isChangingPassword ? 'Changing Password...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
