'use client'

import { useState, useCallback, useRef } from 'react'

export interface GeolocationState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null  // meters
  loading: boolean
  error: string | null
  timestamp: number | null
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean  // default true for pump precision
  timeout?: number  // default 10000ms
  maximumAge?: number  // default 300000ms (5 min cache)
}

export interface UseGeolocationReturn extends GeolocationState {
  refresh: () => void  // Force re-fetch location
  isSupported: boolean  // Browser supports geolocation
  requestLocation: () => void  // Explicitly request location (same as refresh)
}

const defaultOptions: UseGeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 300000,  // 5 minutes
}

function getErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission denied. Enable in browser settings.'
    case error.POSITION_UNAVAILABLE:
      return 'Unable to determine location.'
    case error.TIMEOUT:
      return 'Location request timed out. Try again.'
    default:
      return 'Unable to determine location.'
  }
}

export function useGeolocation(options?: UseGeolocationOptions): UseGeolocationReturn {
  const mergedOptions = { ...defaultOptions, ...options }
  const isRequesting = useRef(false)

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: false,
    error: null,
    timestamp: null,
  })

  const isSupported = typeof window !== 'undefined' && 'geolocation' in navigator

  const requestLocation = useCallback(() => {
    if (!isSupported) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by your browser.',
        loading: false,
      }))
      return
    }

    // Prevent duplicate requests
    if (isRequesting.current) {
      return
    }

    isRequesting.current = true
    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
    }))

    navigator.geolocation.getCurrentPosition(
      (position) => {
        isRequesting.current = false
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          loading: false,
          error: null,
          timestamp: position.timestamp,
        })
      },
      (error) => {
        isRequesting.current = false
        setState(prev => ({
          ...prev,
          loading: false,
          error: getErrorMessage(error),
        }))
      },
      {
        enableHighAccuracy: mergedOptions.enableHighAccuracy,
        timeout: mergedOptions.timeout,
        maximumAge: mergedOptions.maximumAge,
      }
    )
  }, [isSupported, mergedOptions.enableHighAccuracy, mergedOptions.timeout, mergedOptions.maximumAge])

  return {
    ...state,
    refresh: requestLocation,
    requestLocation,
    isSupported,
  }
}
