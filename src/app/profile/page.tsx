'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { InstallButton } from '@/components/InstallButton'
import { useTheme } from '@/contexts/ThemeContext'
import { useOffline } from '@/contexts/OfflineContext'
import { OfflineNotice } from '@/components/OfflineNotice'

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { isOnline, pendingCount } = useOffline()


  // Profile editing state
  const [name, setName] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Thousandths pricing state
  const [defaultThousandths, setDefaultThousandths] = useState<number>(0)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [thousandthsSaveSuccess, setThousandthsSaveSuccess] = useState(false)
  const [adjustedFillupsCount, setAdjustedFillupsCount] = useState<number | null>(null)

  // SSO / OIDC state
  const [oidcEnabled, setOidcEnabled] = useState(false)
  const [oidcLinked, setOidcLinked] = useState(false)
  const [oidcProviderName, setOidcProviderName] = useState('PocketID')
  const [hasPassword, setHasPassword] = useState(true)
  const [oidcMessage, setOidcMessage] = useState<string | null>(null)
  const [oidcError, setOidcError] = useState<string | null>(null)
  const [isLinking, setIsLinking] = useState(false)

  // API token state
  interface ApiTokenInfo {
    id: string
    name: string
    createdAt: string
    lastUsedAt: string | null
  }
  const [apiTokens, setApiTokens] = useState<ApiTokenInfo[]>([])
  const [newTokenName, setNewTokenName] = useState('')
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [isCreatingToken, setIsCreatingToken] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)

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

  // Load profile settings (thousandths preference)
  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => {
          if (data.defaultThousandths !== undefined) {
            setDefaultThousandths(data.defaultThousandths)
          }
          if (data.oidcEnabled !== undefined) {
            setOidcEnabled(Boolean(data.oidcEnabled))
            setOidcLinked(Boolean(data.oidcLinked))
            setOidcProviderName(data.oidcProviderName || 'PocketID')
            setHasPassword(Boolean(data.hasPassword))
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingProfile(false))
    }
  }, [status])

  // Load API tokens
  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/user/tokens')
        .then(res => res.ok ? res.json() : { tokens: [] })
        .then(data => setApiTokens(data.tokens || []))
        .catch(() => {})
    }
  }, [status])

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTokenName.trim()) return
    setIsCreatingToken(true)
    setTokenError(null)
    setCreatedToken(null)
    try {
      const res = await fetch('/api/user/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create token')
      setCreatedToken(data.token)
      setTokenCopied(false)
      setNewTokenName('')
      setApiTokens(prev => [
        { id: data.id, name: data.name, createdAt: data.createdAt, lastUsedAt: null },
        ...prev,
      ])
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : 'Failed to create token')
    } finally {
      setIsCreatingToken(false)
    }
  }

  const handleRevokeToken = async (id: string) => {
    setTokenError(null)
    try {
      const res = await fetch(`/api/user/tokens/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to revoke token')
      }
      setApiTokens(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : 'Failed to revoke token')
    }
  }

  const handleCopyToken = async () => {
    if (!createdToken) return
    try {
      await navigator.clipboard.writeText(createdToken)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 3000)
    } catch {}
  }

  // Surface the result of a completed OIDC link flow (?oidc=linked)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('oidc') === 'linked') {
      setOidcMessage('Account linked successfully')
      window.history.replaceState({}, '', '/profile')
      setTimeout(() => setOidcMessage(null), 5000)
    } else if (params.get('error')) {
      setOidcError('Linking failed. This identity may already be linked to another account.')
      window.history.replaceState({}, '', '/profile')
    }
  }, [])

  const handleLinkOidc = async () => {
    setIsLinking(true)
    setOidcError(null)
    try {
      const res = await fetch('/api/auth/oidc/link', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start linking')
      }
      const { signIn } = await import('next-auth/react')
      await signIn('pocketid', { callbackUrl: '/profile?oidc=linked' })
    } catch (err) {
      setOidcError(err instanceof Error ? err.message : 'Failed to start linking')
      setIsLinking(false)
    }
  }

  const handleUnlinkOidc = async () => {
    setOidcError(null)
    setOidcMessage(null)
    try {
      const res = await fetch('/api/auth/oidc/unlink', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to unlink')
      }
      setOidcLinked(false)
      setOidcMessage('Account unlinked')
      setTimeout(() => setOidcMessage(null), 5000)
    } catch (err) {
      setOidcError(err instanceof Error ? err.message : 'Failed to unlink')
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
      router.push('/login')
    }
  }, [status, router, isOnline])

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

      // Refresh session to get updated name from server
      await updateSession()
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

  const handleThousandthsSave = async (value: number) => {
    try {
      setAdjustedFillupsCount(null)
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultThousandths: value })
      })
      if (res.ok) {
        const data = await res.json()
        setDefaultThousandths(value)
        setThousandthsSaveSuccess(true)
        if (data.adjustedFillups > 0) {
          setAdjustedFillupsCount(data.adjustedFillups)
        }
        setTimeout(() => {
          setThousandthsSaveSuccess(false)
          setAdjustedFillupsCount(null)
        }, 5000)
      }
    } catch {}
  }

  // Password validation
  const passwordValidation = {
    allFieldsFilled: (!hasPassword || currentPassword) && newPassword && confirmPassword,
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
        body: JSON.stringify(
          hasPassword ? { currentPassword, newPassword } : { newPassword }
        ),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to change password')
      }

      // Clear form and show success
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setHasPassword(true)
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

  if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
    return null
  }
  if (status === 'unauthenticated' && !isOnline) {
    return <OfflineNotice message="Profile settings are not available while offline." />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-md lg:max-w-5xl">
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

        {/* Two-column card grid on desktop */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
        {/* Account Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-4 lg:mb-0">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-4 lg:mb-0">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
            App
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 dark:text-gray-400">Version</span>
              <span className="text-gray-900 dark:text-white font-medium">1.1.0</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 dark:text-gray-400">Connectivity</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-amber-500'}`} />
                <span className="text-gray-900 dark:text-white font-medium">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            {pendingCount > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 dark:text-gray-400">Sync Status</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {pendingCount} pending fillup{pendingCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            <div className="pt-2">
              <InstallButton />
            </div>
          </div>
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

          {/* Fuel Pricing */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-gray-900 dark:text-white">Fuel Price Adjustment</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              US gas prices include 9/10 of a cent (e.g., $2.09 is actually $2.099). Enable this to automatically add the fractional cent when you enter a price with 2 or fewer decimal places. Enabling this will also retroactively adjust all your existing fillup prices that don&apos;t already have thousandths applied.
            </p>
            {thousandthsSaveSuccess && (
              <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-xs text-green-700 dark:text-green-300">
                  Setting saved.
                  {adjustedFillupsCount !== null && adjustedFillupsCount > 0 && (
                    <span> {adjustedFillupsCount} historical fillup{adjustedFillupsCount !== 1 ? 's' : ''} adjusted.</span>
                  )}
                  {adjustedFillupsCount === 0 && defaultThousandths > 0 && (
                    <span> No historical fillups needed adjustment.</span>
                  )}
                </p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-300">+$</span>
              <select
                value={defaultThousandths}
                onChange={(e) => handleThousandthsSave(parseFloat(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value={0}>0.000 (disabled)</option>
                <option value={0.001}>0.001</option>
                <option value={0.002}>0.002</option>
                <option value={0.003}>0.003</option>
                <option value={0.004}>0.004</option>
                <option value={0.005}>0.005</option>
                <option value={0.006}>0.006</option>
                <option value={0.007}>0.007</option>
                <option value={0.008}>0.008</option>
                <option value={0.009}>0.009 (US standard)</option>
              </select>
              <span className="text-sm text-gray-500 dark:text-gray-400">per gallon</span>
            </div>
          </div>
        </div>

        {/* API Access Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-4 lg:mt-0">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
            API Access
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Tokens grant read-only access to your vehicles and fillups via{' '}
            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">/api/v1</code>{' '}
            (for example to link gnucash-web). Send as{' '}
            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">Authorization: Bearer &lt;token&gt;</code>.
          </p>

          {tokenError && (
            <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-xs text-red-700 dark:text-red-300">{tokenError}</p>
            </div>
          )}

          {createdToken && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-2">
                Token created - copy it now, it will not be shown again:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800 rounded px-2 py-1.5 break-all select-all">
                  {createdToken}
                </code>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex-shrink-0"
                >
                  {tokenCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleCreateToken} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="Token name (e.g. gnucash-web)"
              maxLength={50}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={isCreatingToken || !newTokenName.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
            >
              {isCreatingToken ? 'Creating...' : 'Create'}
            </button>
          </form>

          {apiTokens.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">No tokens yet</p>
          ) : (
            <div className="space-y-2">
              {apiTokens.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-md"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {t.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Created {new Date(t.createdAt).toLocaleDateString()}
                      {t.lastUsedAt
                        ? ` - last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                        : ' - never used'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeToken(t.id)}
                    className="ml-3 px-3 py-1 text-xs font-medium bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 rounded transition-colors flex-shrink-0"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-4 lg:mt-0 mb-20 lg:mb-0">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
            Security
          </h2>

          {oidcEnabled && (
            <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
              <p className="text-gray-900 dark:text-white">Single Sign-On</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {oidcLinked
                  ? `Your account is linked to ${oidcProviderName}.`
                  : `Link your account to ${oidcProviderName} to sign in without a password.`}
              </p>

              {oidcMessage && (
                <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md">
                  <p className="text-xs text-green-700 dark:text-green-300">{oidcMessage}</p>
                </div>
              )}

              {oidcError && (
                <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-xs text-red-700 dark:text-red-300">{oidcError}</p>
                </div>
              )}

              {oidcLinked ? (
                <button
                  type="button"
                  onClick={handleUnlinkOidc}
                  disabled={!hasPassword}
                  className="py-2 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white text-sm font-medium rounded-md transition-colors"
                >
                  Unlink {oidcProviderName}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLinkOidc}
                  disabled={isLinking}
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
                >
                  {isLinking ? 'Redirecting...' : `Link ${oidcProviderName}`}
                </button>
              )}
              {oidcLinked && !hasPassword && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Set a password below before unlinking, or you would be locked out.
                </p>
              )}
            </div>
          )}

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
            {hasPassword && (
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
            )}

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
              {isChangingPassword
                ? hasPassword ? 'Changing Password...' : 'Setting Password...'
                : hasPassword ? 'Change Password' : 'Set Password'}
            </button>
          </form>
        </div>
        </div>
      </div>
    </div>
  )
}
