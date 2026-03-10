/**
 * Google Maps Directions API Service with caching
 * Documentation: https://developers.google.com/maps/documentation/javascript/directions
 */

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const CACHE_KEY_PREFIX = 'traffic_cache_'
const CACHE_EXPIRY_DAYS = 30 // Cache expires after 30 days

export interface TravelTimeResult {
  duration: number // in minutes (without traffic)
  durationInTraffic: number // in minutes (with traffic)
  distance: number // in meters
}

interface CachedResult {
  data: TravelTimeResult
  timestamp: number
}

/**
 * Generate cache key for a specific route and time
 */
function getCacheKey(origin: string, destination: string, targetTime: Date, mode: 'departure' | 'arrival'): string {
  const timeKey = `${targetTime.getDay()}-${targetTime.getHours()}-${targetTime.getMinutes()}-${mode}`
  return `${CACHE_KEY_PREFIX}${origin}_${destination}_${timeKey}`
}

/**
 * Get data from cache if still valid
 */
function getFromCache(cacheKey: string): TravelTimeResult | null {
  try {
    const cached = localStorage.getItem(cacheKey)
    if (!cached) return null

    const { data, timestamp }: CachedResult = JSON.parse(cached)
    const ageInDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24)

    if (ageInDays > CACHE_EXPIRY_DAYS) {
      localStorage.removeItem(cacheKey)
      return null
    }

    console.log(`✅ Cache hit voor ${cacheKey}`)
    return data
  } catch {
    return null
  }
}

/**
 * Save data to cache
 */
function saveToCache(cacheKey: string, data: TravelTimeResult): void {
  try {
    const cached: CachedResult = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cached))
    console.log(`💾 Saved to cache: ${cacheKey}`)
  } catch (error) {
    console.warn('Cache save failed:', error)
  }
}

/**
 * Get travel time via Google Maps Directions Service (client-side)
 * With caching to save API requests
 */
export async function getTravelTime(
  origin: string,
  destination: string,
  targetTime: Date,
  dayOfWeek: number,
  mode: 'departure' | 'arrival' = 'departure'
): Promise<TravelTimeResult> {
  if (!API_KEY || API_KEY === 'your_api_key_here') {
    throw new Error('Google Maps API key not configured. See GOOGLE_MAPS_SETUP.md')
  }

  // Check cache eerst
  const cacheKey = getCacheKey(origin, destination, targetTime, mode)
  const cached = getFromCache(cacheKey)
  if (cached) {
    return cached
  }

  try {
    // Use Directions Service (client-side API)
    const google = (window as any).google
    const directionsService = new google.maps.DirectionsService()

    // Note: Google Maps API doesn't support arrivalTime with traffic data for driving
    // For both modes, we use departureTime. In 'arrival' mode, the interpretation is:
    // "If I leave at this time, when will I arrive?" (same as departure mode)
    const request: any = {
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: {
        departureTime: targetTime,
        trafficModel: google.maps.TrafficModel.BEST_GUESS
      }
    }

    const result = await directionsService.route(request)

    if (result.status !== 'OK') {
      throw new Error(`Route not found: ${result.status}`)
    }

    const leg = result.routes[0]?.legs[0]
    if (!leg) {
      throw new Error('No route information available')
    }

    const travelTimeResult: TravelTimeResult = {
      duration: Math.round((leg.duration?.value || 0) / 60),
      durationInTraffic: leg.duration_in_traffic
        ? Math.round(leg.duration_in_traffic.value / 60)
        : Math.round((leg.duration?.value || 0) / 60),
      distance: leg.distance?.value || 0
    }

    // Save to cache
    saveToCache(cacheKey, travelTimeResult)

    return travelTimeResult
  } catch (error) {
    console.error('Google Maps API error:', error)
    throw error
  }
}

/**
 * Helper function to create a Date object for a specific day and time
 */
export function createDepartureTime(dayName: string, timeString: string): Date {
  const dayMap: { [key: string]: number } = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  }

  const targetDay = dayMap[dayName.toLowerCase()] ?? 0
  const timeParts = timeString.split(':').map(Number)
  const hours = timeParts[0] ?? 0
  const minutes = timeParts[1] ?? 0

  const now = new Date()
  const result = new Date()

  result.setHours(hours, minutes, 0, 0)

  const currentDay = now.getDay()
  let daysToAdd = targetDay - currentDay

  if (daysToAdd < 0) {
    // Target day is earlier in the week, take next week
    daysToAdd += 7
  } else if (daysToAdd === 0) {
    // Same day: only next week if time has already passed
    if (now.getTime() > result.getTime()) {
      daysToAdd = 7
    }
    // Otherwise: use TODAY (daysToAdd remains 0)
  }
  // If daysToAdd > 0: use that day this week

  result.setDate(result.getDate() + daysToAdd)

  return result
}
