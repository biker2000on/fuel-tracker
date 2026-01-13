export interface GeocodedLocation {
  city: string | null
  state: string | null
  country: string | null
}

interface NominatimAddress {
  city?: string
  town?: string
  village?: string
  municipality?: string
  state?: string
  country?: string
}

interface NominatimResponse {
  address?: NominatimAddress
}

// Track last request time for rate limiting (1 request/second per Nominatim TOS)
let lastRequestTime = 0

/**
 * Reverse geocode coordinates to city/state/country using Nominatim (OpenStreetMap)
 *
 * Complies with Nominatim TOS:
 * - Includes User-Agent header with app name
 * - Enforces 1 request/second rate limit
 *
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns GeocodedLocation with city, state, country (null fields if not found)
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodedLocation> {
  const emptyResult: GeocodedLocation = {
    city: null,
    state: null,
    country: null,
  }

  try {
    // Rate limit: wait if needed to ensure 1 second between requests
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    if (timeSinceLastRequest < 1000 && lastRequestTime > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest))
    }
    lastRequestTime = Date.now()

    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('lat', latitude.toString())
    url.searchParams.set('lon', longitude.toString())
    url.searchParams.set('format', 'json')

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'FuelTracker/1.0 (fuel-tracking-app)',
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`Nominatim request failed: ${response.status}`)
      return emptyResult
    }

    const data = await response.json() as NominatimResponse

    if (!data.address) {
      return emptyResult
    }

    const address = data.address

    return {
      city: address.city || address.town || address.village || address.municipality || null,
      state: address.state || null,
      country: address.country || null,
    }
  } catch (error) {
    console.error('Geocoding error:', error)
    return emptyResult
  }
}

/**
 * Format a geocoded location as a display string
 *
 * @param loc - GeocodedLocation object
 * @returns Formatted string like "City, State" or "City, Country" or null if no data
 */
export function formatLocation(loc: GeocodedLocation): string | null {
  if (!loc.city && !loc.state && !loc.country) {
    return null
  }

  if (loc.city && loc.state) {
    return `${loc.city}, ${loc.state}`
  }

  if (loc.city && loc.country) {
    return `${loc.city}, ${loc.country}`
  }

  if (loc.city) {
    return loc.city
  }

  if (loc.state && loc.country) {
    return `${loc.state}, ${loc.country}`
  }

  return loc.state || loc.country || null
}
