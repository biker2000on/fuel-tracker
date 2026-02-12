'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { OfflineNotice } from '@/components/OfflineNotice'
import { useTheme } from '@/contexts/ThemeContext'
import {
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const VEHICLE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
]

interface VehicleInfo {
  id: string
  name: string
  color: string
}

interface PricePoint {
  date: string
  pricePerGallon: number
  vehicleId: string
  vehicleName: string
}

interface MpgPoint {
  date: string
  mpg: number
  vehicleId: string
  vehicleName: string
}

interface MonthlySpendingPoint {
  month: string
  totalCost: number
  gallons: number
  fillupCount: number
}

interface CostPerMilePoint {
  date: string
  costPerMile: number
  vehicleId: string
  vehicleName: string
}

interface AnalyticsData {
  priceHistory: PricePoint[]
  mpgHistory: MpgPoint[]
  monthlySpending: MonthlySpendingPoint[]
  costPerMile: CostPerMilePoint[]
  vehicles: VehicleInfo[]
}

type Period = '3m' | '6m' | '12m' | 'all'

function formatDateLabel(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${month}/${day}`
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-')
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[parseInt(month, 10) - 1]} '${year.slice(2)}`
}

// Transform array of per-point data into recharts-compatible format with one key per vehicle
function pivotByVehicle<T extends { date: string; vehicleName: string }>(
  data: T[],
  valueKey: keyof T
): Array<Record<string, unknown>> {
  const dateMap = new Map<string, Record<string, unknown>>()
  for (const point of data) {
    const existing = dateMap.get(point.date)
    if (existing) {
      existing[point.vehicleName] = point[valueKey]
    } else {
      dateMap.set(point.date, {
        date: point.date,
        [point.vehicleName]: point[valueKey],
      })
    }
  }
  return Array.from(dateMap.values())
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { isOnline } = useNetworkStatus()
  const { resolvedTheme } = useTheme()

  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<string>('')
  const [period, setPeriod] = useState<Period>('12m')

  const isDark = resolvedTheme === 'dark'
  const axisColor = isDark ? '#9ca3af' : '#6b7280'
  const gridColor = isDark ? '#374151' : '#e5e7eb'

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ period })
      if (selectedVehicle) {
        params.set('vehicleId', selectedVehicle)
      }
      const res = await fetch(`/api/analytics?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Failed to load analytics')
      }
      const json: AnalyticsData = await res.json()
      setData(json)
    } catch {
      setError('Failed to load analytics data. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [period, selectedVehicle])

  useEffect(() => {
    if (status === 'unauthenticated' && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchAnalytics()
    }
    if (status === 'unauthenticated' && !isOnline) {
      setIsLoading(false)
    }
  }, [status, isOnline, fetchAnalytics, router])

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!isOnline) {
    return <OfflineNotice message="Analytics requires an internet connection to load chart data." />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Analytics</h1>
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="mt-2 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const hasData = data && (
    data.priceHistory.length > 0 ||
    data.mpgHistory.length > 0 ||
    data.monthlySpending.length > 0 ||
    data.costPerMile.length > 0
  )

  // Pivot data for multi-vehicle line charts
  const priceChartData = data ? pivotByVehicle(data.priceHistory, 'pricePerGallon') : []
  const mpgChartData = data ? pivotByVehicle(data.mpgHistory, 'mpg') : []
  const costPerMileChartData = data ? pivotByVehicle(data.costPerMile, 'costPerMile') : []

  const vehicleColorMap = new Map<string, string>()
  if (data) {
    for (const v of data.vehicles) {
      vehicleColorMap.set(v.name, v.color)
    }
  }

  // Get unique vehicle names from the data for line keys
  const vehicleNames = data ? data.vehicles.map((v) => v.name) : []

  const periods: { label: string; value: Period }[] = [
    { label: '3M', value: '3m' },
    { label: '6M', value: '6m' },
    { label: '12M', value: '12m' },
    { label: 'All', value: 'all' },
  ]

  const tooltipStyle = {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
    borderRadius: '8px',
    color: isDark ? '#f3f4f6' : '#111827',
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4 py-8 pb-24">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Analytics</h1>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Vehicle filter */}
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="">All Vehicles</option>
            {data?.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          {/* Period selector */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === p.value
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {!hasData ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
              Log some fillups to see your analytics!
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              Charts will appear once you start tracking fuel data.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Price per Gallon Chart */}
            {data!.priceHistory.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Price per Gallon</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={priceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      stroke={axisColor}
                      fontSize={12}
                    />
                    <YAxis
                      stroke={axisColor}
                      fontSize={12}
                      tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(label) => String(label)}
                      formatter={(value) => [`$${Number(value).toFixed(3)}`, '']}
                    />
                    <Legend />
                    {vehicleNames.map((name, i) => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={vehicleColorMap.get(name) || VEHICLE_COLORS[i % VEHICLE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* MPG Over Time Chart */}
            {data!.mpgHistory.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">MPG Over Time</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={mpgChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      stroke={axisColor}
                      fontSize={12}
                    />
                    <YAxis
                      stroke={axisColor}
                      fontSize={12}
                      tickFormatter={(v: number) => v.toFixed(1)}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(label) => String(label)}
                      formatter={(value) => [Number(value).toFixed(2), '']}
                    />
                    <Legend />
                    {vehicleNames.map((name, i) => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={vehicleColorMap.get(name) || VEHICLE_COLORS[i % VEHICLE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Monthly Spending Chart */}
            {data!.monthlySpending.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Monthly Spending</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data!.monthlySpending}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="month"
                      tickFormatter={formatMonthLabel}
                      stroke={axisColor}
                      fontSize={12}
                    />
                    <YAxis
                      stroke={axisColor}
                      fontSize={12}
                      tickFormatter={(v: number) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(label) => formatMonthLabel(String(label))}
                      formatter={(value, name) => {
                        if (name === 'totalCost') return [`$${Number(value).toFixed(2)}`, 'Total Cost']
                        if (name === 'gallons') return [`${Number(value).toFixed(1)} gal`, 'Gallons']
                        return [value, String(name)]
                      }}
                    />
                    <Legend formatter={(value) => {
                      if (value === 'totalCost') return 'Total Cost'
                      if (value === 'gallons') return 'Gallons'
                      return value
                    }} />
                    <Bar dataKey="totalCost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gallons" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Cost per Mile Chart */}
            {data!.costPerMile.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Cost per Mile</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={costPerMileChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      stroke={axisColor}
                      fontSize={12}
                    />
                    <YAxis
                      stroke={axisColor}
                      fontSize={12}
                      tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(label) => String(label)}
                      formatter={(value) => [`$${Number(value).toFixed(3)}`, '']}
                    />
                    <Legend />
                    {vehicleNames.map((name, i) => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={vehicleColorMap.get(name) || VEHICLE_COLORS[i % VEHICLE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
