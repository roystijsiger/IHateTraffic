/**
 * Google Maps Directions API Service met caching
 * Documentatie: https://developers.google.com/maps/documentation/javascript/directions
 */

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const CACHE_KEY_PREFIX = 'traffic_cache_'
const CACHE_EXPIRY_DAYS = 30 // Cache vervalt na 30 dagen

export interface TravelTimeResult {
  duration: number // in minutes (zonder verkeer)
  durationInTraffic: number // in minutes (met verkeer)
  distance: number // in meters
}

interface CachedResult {
  data: TravelTimeResult
  timestamp: number
}

/**
 * Genereer cache key voor een specifieke route en tijd
 */
function getCacheKey(origin: string, destination: string, departureTime: Date): string {
  const timeKey = `${departureTime.getDay()}-${departureTime.getHours()}-${departureTime.getMinutes()}`
  return `${CACHE_KEY_PREFIX}${origin}_${destination}_${timeKey}`
}

/**
 * Haal data uit cache als deze nog geldig is
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
 * Sla data op in cache
 */
function saveToCache(cacheKey: string, data: TravelTimeResult): void {
  try {
    const cached: CachedResult = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cached))
    console.log(`💾 Opgeslagen in cache: ${cacheKey}`)
  } catch (error) {
    console.warn('Cache opslaan mislukt:', error)
  }
}

/**
 * Haalt reistijd op via Google Maps Directions Service (client-side)
 * Met caching om API requests te besparen
 */
export async function getTravelTime(
  origin: string,
  destination: string,
  departureTime: Date,
  dayOfWeek: number
): Promise<TravelTimeResult> {
  if (!API_KEY || API_KEY === 'your_api_key_here') {
    throw new Error('Google Maps API key niet geconfigureerd. Zie GOOGLE_MAPS_SETUP.md')
  }

  // Check cache eerst
  const cacheKey = getCacheKey(origin, destination, departureTime)
  const cached = getFromCache(cacheKey)
  if (cached) {
    return cached
  }

  try {
    // Use Directions Service (client-side API)
    const google = (window as any).google
    const directionsService = new google.maps.DirectionsService()

    const request = {
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: {
        departureTime,
        trafficModel: google.maps.TrafficModel.BEST_GUESS
      }
    }

    const result = await directionsService.route(request)

    if (result.status !== 'OK') {
      throw new Error(`Route niet gevonden: ${result.status}`)
    }

    const leg = result.routes[0]?.legs[0]
    if (!leg) {
      throw new Error('Geen route informatie beschikbaar')
    }

    const travelTimeResult: TravelTimeResult = {
      duration: Math.round((leg.duration?.value || 0) / 60),
      durationInTraffic: leg.duration_in_traffic
        ? Math.round(leg.duration_in_traffic.value / 60)
        : Math.round((leg.duration?.value || 0) / 60),
      distance: leg.distance?.value || 0
    }

    // Sla op in cache
    saveToCache(cacheKey, travelTimeResult)

    return travelTimeResult
  } catch (error) {
    console.error('Google Maps API error:', error)
    throw error
  }
}

/**
 * Helper functie om een Date object te maken voor een specifieke dag en tijd
 */
export function createDepartureTime(dayName: string, timeString: string): Date {
  const dayMap: { [key: string]: number } = {
    zondag: 0,
    maandag: 1,
    dinsdag: 2,
    woensdag: 3,
    donderdag: 4,
    vrijdag: 5,
    zaterdag: 6
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
    daysToAdd += 7
  } else if (daysToAdd === 0 && now.getTime() > result.getTime()) {
    daysToAdd = 7
  }

  result.setDate(result.getDate() + daysToAdd)

  return result
}
