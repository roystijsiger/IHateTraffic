/**
 * HERE Traffic API Service
 * Documentatie: https://developer.here.com/documentation/routing-api/dev_guide/index.html
 */

const API_KEY = import.meta.env.VITE_HERE_API_KEY

export interface TravelTimeResult {
  duration: number // in minutes (without traffic)
  durationInTraffic: number // in minutes (with traffic)
  distance: number // in meters
}

/**
 * Geocode een locatie naar coordinaten
 */
async function geocodeLocation(location: string): Promise<{ lat: number; lng: number }> {
  const params = new URLSearchParams({
    q: location,
    apiKey: API_KEY
  })

  const response = await fetch(
    `https://geocode.search.hereapi.com/v1/geocode?${params}`
  )

  if (!response.ok) {
    throw new Error(`Geocoding error: ${response.status}`)
  }

  const data = await response.json()

  if (!data.items || data.items.length === 0) {
    throw new Error(`Location not found: ${location}`)
  }

  const position = data.items[0].position
  return { lat: position.lat, lng: position.lng }
}

/**
 * Get travel time via HERE Routing API with traffic information
 */
export async function getTravelTime(
  origin: string,
  destination: string,
  targetTime: Date,
  dayOfWeek: number,
  mode: 'departure' | 'arrival' = 'departure'
): Promise<TravelTimeResult> {
  if (!API_KEY || API_KEY === 'your_api_key_here') {
    console.warn('⚠️ HERE API key niet geconfigureerd, gebruik fallback data')
    return getFallbackTravelTime(targetTime)
  }

  try {
    // Stap 1: Geocode beide locaties
    const [originCoords, destCoords] = await Promise.all([
      geocodeLocation(origin),
      geocodeLocation(destination)
    ])

    // Step 2: Calculate route with traffic information
    const params: any = {
      origin: `${originCoords.lat},${originCoords.lng}`,
      destination: `${destCoords.lat},${destCoords.lng}`,
      transportMode: 'car',
      return: 'summary,polyline',
      apiKey: API_KEY
    }

    // Gebruik departureTime of arrivalTime
    if (mode === 'arrival') {
      params.arrivalTime = targetTime.toISOString()
    } else {
      params.departureTime = targetTime.toISOString()
    }

    const paramsString = new URLSearchParams(params)

    const response = await fetch(
      `https://router.hereapi.com/v8/routes?${paramsString}`
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`HERE API error: ${response.status} - ${errorData.title || 'Unknown'}`)
    }

    const data = await response.json()

    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found')
    }

    const route = data.routes[0]
    const section = route.sections[0]

    // Duration in seconds -> convert to minutes
    const baseDuration = Math.round(section.summary.baseDuration / 60)
    const trafficDuration = Math.round(section.summary.duration / 60)

    return {
      duration: baseDuration,
      durationInTraffic: trafficDuration,
      distance: section.summary.length
    }
  } catch (error) {
    console.error('HERE API error:', error)
    // Fallback naar gesimuleerde data bij fout
    return getFallbackTravelTime(targetTime)
  }
}

/**
 * Fallback function with simulated data
 */
function getFallbackTravelTime(departureTime: Date): TravelTimeResult {
  const hour = departureTime.getHours()
  const dayOfWeek = departureTime.getDay()
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

  // Simulate rush hour patterns (only on weekdays)
  let duration: number
  if (isWeekday && ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19))) {
    // Rush hour: 35-65 minutes
    duration = Math.floor(Math.random() * 30) + 35
  } else if (hour >= 22 || hour < 6) {
    // Night: 20-30 minutes
    duration = Math.floor(Math.random() * 10) + 20
  } else {
    // Normal hours: 25-40 minutes
    duration = Math.floor(Math.random() * 15) + 25
  }

  return {
    duration: Math.round(duration * 0.85), // base without traffic
    durationInTraffic: duration,
    distance: 75000 // 75km als voorbeeld
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

  // Set the time
  result.setHours(hours, minutes, 0, 0)

  // Calculate how many days ahead we need to go
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
