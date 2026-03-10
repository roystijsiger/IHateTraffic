<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions
} from 'chart.js'
import { getTravelTime, createDepartureTime } from '@/services/googleMapsService'
import { requestNotificationPermission, scheduleAlarmNotification, onMessageListener } from '@/services/firebaseService'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

// Form inputs
const selectedDay = ref<string>('maandag')
const startTime = ref<string>('07:00')
const endTime = ref<string>('09:00')
const fromLocation = ref<string>('')
const toLocation = ref<string>('')

// Data
const travelTimes = ref<{ time: string; duration: number }[]>([])
const isLoading = ref<boolean>(false)
const bestTimes = ref<string[]>([])
const errorMessage = ref<string>('')
const hasError = ref<boolean>(false)

// New features
const addressBook = ref<Array<{ name: string; address: string; emoji: string }>>([])
const recentSearches = ref<Array<{ from: string; to: string }>>([])
const alarmTime = ref<string>('')
const showAlarmSet = ref<boolean>(false)
const showAlarmSelector = ref<boolean>(false)
const showAddressBook = ref<boolean>(false)
const showEmojiPicker = ref<boolean>(false)
const newAddressName = ref<string>('')
const newAddressLocation = ref<string>('')
const newAddressEmoji = ref<string>('📍')
const locationStatus = ref<string>('')
const showLocationStatus = ref<boolean>(false)
const locationStatusType = ref<'success' | 'error' | 'info'>('info')
const notificationsEnabled = ref<boolean>(false)
const fcmToken = ref<string | null>(null)
const alarmRepeat = ref<'once' | 'daily' | 'weekly' | 'weekdays'>('once')
const activeAlarms = ref<number[]>([])
const showAlarmManager = ref<boolean>(false)
const showInstallPrompt = ref<boolean>(false)
const deferredPrompt = ref<any>(null)

interface SavedAlarm {
  time: string
  repeat: 'once' | 'daily' | 'weekly' | 'weekdays'
  from: string
  to: string
  day: string
  createdAt: number
}

const savedAlarms = ref<SavedAlarm[]>([])

const emojis = ['📍', '🏠', '💼', '🏢', '🏫', '🏥', '🏪', '🍕', '☕', '🏋️', '⛪', '🚉', '✈️', '🎭', '🎨', '❤️']

const days = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']

// Loading messages
const loadingMessages = [
  '🚗 Analyzing traffic patterns...',
  '🔍 Finding the best route for you...',
  '⏱️ Calculating optimal departure times...',
  '🛣️ Checking road conditions...',
  '📊 Crunching the numbers...',
  '🎯 Finding your perfect escape time...'
]
const currentLoadingMessage = ref<string>(loadingMessages[0] || 'Loading...')

// Function to get current time rounded to next 5 minutes
const getRoundedTime = (addHours: number = 0): string => {
  const now = new Date()
  now.setHours(now.getHours() + addHours)
  const minutes = now.getMinutes()
  const roundedMinutes = Math.ceil(minutes / 5) * 5
  now.setMinutes(roundedMinutes)
  now.setSeconds(0)
  
  const hours = now.getHours().toString().padStart(2, '0')
  const mins = now.getMinutes().toString().padStart(2, '0')
  return `${hours}:${mins}`
}

// Set default times to now and now + 2 hours
startTime.value = getRoundedTime(0)
endTime.value = getRoundedTime(2)

// Load saved data from localStorage
onMounted(async () => {
  const saved = localStorage.getItem('addressBook')
  if (saved) addressBook.value = JSON.parse(saved)
  
  const recent = localStorage.getItem('recentSearches')
  if (recent) recentSearches.value = JSON.parse(recent)
  
  // Load saved alarms
  const alarms = localStorage.getItem('savedAlarms')
  if (alarms) {
    savedAlarms.value = JSON.parse(alarms)
    
    // Show notification if there are active alarms
    if (savedAlarms.value.length > 0) {
      showLocationStatus.value = true
      locationStatus.value = `⏰ Je hebt ${savedAlarms.value.length} actieve alarm${savedAlarms.value.length > 1 ? 's' : ''}`
      locationStatusType.value = 'info'
      setTimeout(() => showLocationStatus.value = false, 5000)
    }
  }
  
  // Check notification permission status
  if ('Notification' in window) {
    notificationsEnabled.value = Notification.permission === 'granted'
  }
  
  // PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
    showInstallPrompt.value = true
    console.log('PWA install prompt available')
  })
  
  window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully!')
    showInstallPrompt.value = false
    deferredPrompt.value = null
    
    showLocationStatus.value = true
    locationStatus.value = '✅ App geïnstalleerd! Je krijgt nu push notificaties.'
    locationStatusType.value = 'success'
    setTimeout(() => showLocationStatus.value = false, 5000)
  })
  
  // Listen for foreground messages
  try {
    onMessageListener().then((payload) => {
      console.log('Received foreground message:', payload)
      // Show in-app notification
      showLocationStatus.value = true
      locationStatus.value = payload.notification?.body || 'New notification'
      locationStatusType.value = 'info'
      setTimeout(() => showLocationStatus.value = false, 5000)
    })
  } catch (error) {
    console.error('Error setting up message listener:', error)
  }
})

// Load Google Maps API dynamically
const loadGoogleMapsAPI = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps API'))
    document.head.appendChild(script)
  })
}

// Initialize Google Places Autocomplete
const initAutocomplete = async () => {
  try {
    await loadGoogleMapsAPI()
    
    const fromInput = document.getElementById('from-location') as HTMLInputElement
    const toInput = document.getElementById('to-location') as HTMLInputElement
    const addressInput = document.getElementById('address-location') as HTMLInputElement

    if (fromInput && toInput) {
      const google = (window as any).google
      const fromAutocomplete = new google.maps.places.Autocomplete(fromInput)
      const toAutocomplete = new google.maps.places.Autocomplete(toInput)

      fromAutocomplete.addListener('place_changed', () => {
        const place = fromAutocomplete.getPlace()
        if (place.formatted_address) {
          fromLocation.value = place.formatted_address
        }
      })

      toAutocomplete.addListener('place_changed', () => {
        const place = toAutocomplete.getPlace()
        if (place.formatted_address) {
          toLocation.value = place.formatted_address
        }
      })
      
      // Address book autocomplete
      if (addressInput) {
        const addressAutocomplete = new google.maps.places.Autocomplete(addressInput)
        addressAutocomplete.addListener('place_changed', () => {
          const place = addressAutocomplete.getPlace()
          if (place.formatted_address) {
            newAddressLocation.value = place.formatted_address
          }
        })
      }
    }
  } catch (error) {
    console.error('Failed to load Google Maps:', error)
  }
}

onMounted(() => {
  initAutocomplete()
  
  const saved = localStorage.getItem('addressBook')
  if (saved) addressBook.value = JSON.parse(saved)
  
  const recent = localStorage.getItem('recentSearches')
  if (recent) recentSearches.value = JSON.parse(recent)
})

// Watch for address book modal opening to initialize autocomplete
watch(showAddressBook, (isOpen) => {
  if (isOpen) {
    setTimeout(() => {
      const addressInput = document.getElementById('address-location') as HTMLInputElement
      if (addressInput && (window as any).google) {
        const google = (window as any).google
        const addressAutocomplete = new google.maps.places.Autocomplete(addressInput)
        addressAutocomplete.addListener('place_changed', () => {
          const place = addressAutocomplete.getPlace()
          if (place.formatted_address) {
            newAddressLocation.value = place.formatted_address
          }
        })
      }
    }, 100)
  }
})

// Generate time slots every 5 minutes between start and end time
const generateTimeSlots = (start: string, end: string): string[] => {
  const slots: string[] = []
  const startParts = start.split(':').map(Number)
  const endParts = end.split(':').map(Number)
  
  const startHour = startParts[0] || 0
  const startMin = startParts[1] || 0
  const endHour = endParts[0] || 23
  const endMin = endParts[1] || 59

  // Calculate total minutes
  const startTotalMin = startHour * 60 + startMin
  const endTotalMin = endHour * 60 + endMin
  const totalMinutes = endTotalMin - startTotalMin

  // Smart interval: max 24 data points, min 5 min interval, max 30 min interval
  const MAX_POINTS = 24
  let interval = Math.max(5, Math.ceil(totalMinutes / MAX_POINTS))
  
  // Round interval to multiples of 5
  interval = Math.ceil(interval / 5) * 5
  
  // Cap at 30 minutes to not miss peak times
  interval = Math.min(interval, 30)

  let currentTotalMin = startTotalMin
  
  while (currentTotalMin < endTotalMin) {
    const currentHour = Math.floor(currentTotalMin / 60)
    const currentMin = currentTotalMin % 60
    slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`)
    currentTotalMin += interval
  }

  return slots
}

// Fetch travel time using HERE API
const fetchTravelTime = async (
  day: string,
  time: string,
  from: string,
  to: string
): Promise<number> => {
  const departureTime = createDepartureTime(day, time)
  const dayOfWeek = departureTime.getDay()
  
  const result = await getTravelTime(from, to, departureTime, dayOfWeek)
  return result.durationInTraffic
}

// Fetch all travel times
const analyzeTravelTimes = async () => {
  if (!fromLocation.value.trim() || !toLocation.value.trim()) {
    alert('Vul beide locaties in!')
    return
  }

  isLoading.value = true
  travelTimes.value = []
  bestTimes.value = []
  hasError.value = false
  errorMessage.value = ''
  
  // Random loading messages
  const messageInterval = setInterval(() => {
    currentLoadingMessage.value = loadingMessages[Math.floor(Math.random() * loadingMessages.length)] || 'Loading...'
  }, 2000)

  try {
    const timeSlots = generateTimeSlots(startTime.value, endTime.value)

    for (const slot of timeSlots) {
      const duration = await fetchTravelTime(
        selectedDay.value,
        slot,
        fromLocation.value,
        toLocation.value
      )
      travelTimes.value.push({ time: slot, duration })
    }

    // Find the best time(s) - lowest duration
    if (travelTimes.value.length > 0) {
      const minDuration = Math.min(...travelTimes.value.map((t) => t.duration))
      bestTimes.value = travelTimes.value
        .filter((t) => t.duration === minDuration)
        .map((t) => t.time)
      
      // Save to recent searches
      addToRecentSearches(fromLocation.value, toLocation.value)
      
      // Scroll to results
      setTimeout(() => {
        const resultsElement = document.querySelector('.results')
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }
  } catch (error: any) {
    hasError.value = true
    errorMessage.value = error.message || 'Kan geen verkeersinformatie ophalen. Check je API key in GOOGLE_MAPS_SETUP.md'
    console.error('Error fetching travel times:', error)
  } finally {
    clearInterval(messageInterval)
    isLoading.value = false
  }
}

// New helper functions
const swapLocations = () => {
  const temp = fromLocation.value
  fromLocation.value = toLocation.value
  toLocation.value = temp
}

const useCurrentLocation = async () => {
  if (!navigator.geolocation) {
    alert('Geolocation wordt niet ondersteund door je browser')
    return
  }

  locationStatus.value = '📍 Locatie ophalen...'
  locationStatusType.value = 'info'
  showLocationStatus.value = true

  try {
    await loadGoogleMapsAPI()
  } catch (error) {
    locationStatus.value = '❌ Google Maps laden mislukt'
    locationStatusType.value = 'error'
    setTimeout(() => showLocationStatus.value = false, 3000)
    console.error('Google Maps load error:', error)
    return
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      
      locationStatus.value = '🔍 Adres zoeken...'
      locationStatusType.value = 'info'
      console.log('Got location:', lat, lng)
      
      try {
        // Reverse geocode to get address
        const google = (window as any).google
        if (!google || !google.maps || !google.maps.Geocoder) {
          locationStatus.value = '❌ Google Maps niet beschikbaar'
          locationStatusType.value = 'error'
          setTimeout(() => showLocationStatus.value = false, 3000)
          return
        }
        
        const geocoder = new google.maps.Geocoder()
        geocoder.geocode(
          { location: { lat, lng } },
          (results: any[], status: string) => {
            console.log('Geocode status:', status, 'Results:', results)
            if (status === 'OK' && results && results[0]) {
              fromLocation.value = results[0].formatted_address
              locationStatus.value = '✅ Locatie ingevuld!'
              locationStatusType.value = 'success'
              console.log('Set location to:', results[0].formatted_address)
              setTimeout(() => showLocationStatus.value = false, 2000)
            } else {
              locationStatus.value = '❌ Adres niet gevonden'
              locationStatusType.value = 'error'
              setTimeout(() => showLocationStatus.value = false, 3000)
            }
          }
        )
      } catch (error) {
        console.error('Geocoding error:', error)
        locationStatus.value = '❌ Fout bij adres ophalen'
        locationStatusType.value = 'error'
        setTimeout(() => showLocationStatus.value = false, 3000)
      }
    },
    (error) => {
      console.error('Geolocation error:', error)
      locationStatusType.value = 'error'
      if (error.code === 1) {
        locationStatus.value = '❌ Geen toestemming'
      } else if (error.code === 2) {
        locationStatus.value = '❌ Locatie niet beschikbaar'
      } else if (error.code === 3) {
        locationStatus.value = '⏱️ Time-out'
      } else {
        locationStatus.value = '❌ Fout opgetreden'
      }
      setTimeout(() => showLocationStatus.value = false, 3000)
    },
    options
  )
}

// Use current location for address book
const useCurrentLocationForAddressBook = async () => {
  if (!navigator.geolocation) {
    alert('Geolocation wordt niet ondersteund door je browser')
    return
  }

  locationStatus.value = '📍 Locatie ophalen...'
  locationStatusType.value = 'info'
  showLocationStatus.value = true

  try {
    await loadGoogleMapsAPI()
  } catch (error) {
    locationStatus.value = '❌ Google Maps laden mislukt'
    locationStatusType.value = 'error'
    setTimeout(() => showLocationStatus.value = false, 3000)
    console.error('Google Maps load error:', error)
    return
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      
      locationStatus.value = '🔍 Adres zoeken...'
      locationStatusType.value = 'info'
      console.log('Got location for address book:', lat, lng)
      
      try {
        const google = (window as any).google
        if (!google || !google.maps || !google.maps.Geocoder) {
          locationStatus.value = '❌ Google Maps niet beschikbaar'
          locationStatusType.value = 'error'
          setTimeout(() => showLocationStatus.value = false, 3000)
          return
        }
        
        const geocoder = new google.maps.Geocoder()
        geocoder.geocode(
          { location: { lat, lng } },
          (results: any[], status: string) => {
            console.log('Geocode status:', status, 'Results:', results)
            if (status === 'OK' && results && results[0]) {
              newAddressLocation.value = results[0].formatted_address
              locationStatus.value = '✅ Locatie ingevuld!'
              locationStatusType.value = 'success'
              console.log('Set address book location to:', results[0].formatted_address)
              setTimeout(() => showLocationStatus.value = false, 2000)
            } else {
              locationStatus.value = '❌ Adres niet gevonden'
              locationStatusType.value = 'error'
              setTimeout(() => showLocationStatus.value = false, 3000)
            }
          }
        )
      } catch (error) {
        console.error('Geocoding error:', error)
        locationStatus.value = '❌ Fout bij adres ophalen'
        locationStatusType.value = 'error'
        setTimeout(() => showLocationStatus.value = false, 3000)
      }
    },
    (error) => {
      console.error('Geolocation error:', error)
      locationStatusType.value = 'error'
      if (error.code === 1) {
        locationStatus.value = '❌ Geen toestemming'
      } else if (error.code === 2) {
        locationStatus.value = '❌ Locatie niet beschikbaar'
      } else if (error.code === 3) {
        locationStatus.value = '❌ Time-out'
      } else {
        locationStatus.value = '❌ Fout opgetreden'
      }
      setTimeout(() => showLocationStatus.value = false, 3000)
    },
    options
  )
}

// Address book functions
const addToAddressBook = () => {
  if (!newAddressName.value.trim() || !newAddressLocation.value.trim()) {
    alert('Vul naam en adres in!')
    return
  }
  
  addressBook.value.push({
    name: newAddressName.value,
    address: newAddressLocation.value,
    emoji: newAddressEmoji.value
  })
  
  localStorage.setItem('addressBook', JSON.stringify(addressBook.value))
  newAddressName.value = ''
  newAddressLocation.value = ''
  newAddressEmoji.value = '📍'
  
  // Reinit autocomplete for address book input
  setTimeout(() => initAutocomplete(), 100)
}

const deleteFromAddressBook = (index: number) => {
  addressBook.value.splice(index, 1)
  localStorage.setItem('addressBook', JSON.stringify(addressBook.value))
}

const useAddressFromBook = (address: string, target: 'from' | 'to') => {
  if (target === 'from') fromLocation.value = address
  else toLocation.value = address
  showAddressBook.value = false
  
  // Scroll to form
  const formElement = document.querySelector('.form-container')
  if (formElement) {
    formElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const addToRecentSearches = (from: string, to: string) => {
  recentSearches.value = [
    { from, to },
    ...recentSearches.value.filter(s => s.from !== from || s.to !== to).slice(0, 2)
  ]
  localStorage.setItem('recentSearches', JSON.stringify(recentSearches.value))
}

const loadRecentSearch = (search: { from: string; to: string }) => {
  fromLocation.value = search.from
  toLocation.value = search.to
}

const openAlarmSelector = () => {
  showAlarmSelector.value = true
}

const setAlarm = async (time: string) => {
  alarmTime.value = time
  showAlarmSelector.value = false
  
  // Request notification permission FIRST
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission()
    notificationsEnabled.value = permission === 'granted'
    
    if (permission === 'granted') {
      showLocationStatus.value = true
      locationStatus.value = '✅ Notificaties ingeschakeld!'
      locationStatusType.value = 'success'
      setTimeout(() => showLocationStatus.value = false, 3000)
    } else {
      showLocationStatus.value = true
      locationStatus.value = '⚠️ Notificaties geblokkeerd - je krijgt alleen een alert'
      locationStatusType.value = 'error'
      setTimeout(() => showLocationStatus.value = false, 5000)
    }
  } else if ('Notification' in window && Notification.permission === 'granted') {
    notificationsEnabled.value = true
  }
  
  showAlarmSet.value = true
  setTimeout(() => showAlarmSet.value = false, 3000)
  
  // Save alarm to localStorage
  const newAlarm: SavedAlarm = {
    time: time,
    repeat: alarmRepeat.value,
    from: fromLocation.value,
    to: toLocation.value,
    day: selectedDay.value,
    createdAt: Date.now()
  }
  savedAlarms.value.push(newAlarm)
  localStorage.setItem('savedAlarms', JSON.stringify(savedAlarms.value))
  
  // Schedule notification via Service Worker (for when app is closed)
  if ('serviceWorker' in navigator && notificationsEnabled.value) {
    try {
      const registration = await navigator.serviceWorker.ready
      await scheduleNotificationViaServiceWorker(time, registration)
    } catch (error) {
      console.log('Service Worker scheduling not available:', error)
    }
  }
  
  // Fallback: Schedule alarm based on repeat setting (for when app is open)
  scheduleAlarmWithRepeat(time)
}

const scheduleNotificationViaServiceWorker = async (time: string, registration: ServiceWorkerRegistration) => {
  const [hours, minutes] = time.split(':').map(Number)
  const scheduledDate = new Date()
  scheduledDate.setHours(hours || 0, minutes || 0, 0, 0)
  
  // If time has passed today, schedule for tomorrow
  if (scheduledDate <= new Date()) {
    scheduledDate.setDate(scheduledDate.getDate() + 1)
  }
  
  const scheduledTime = scheduledDate.getTime()
  
  // Try using Notification Triggers API via service worker
  const messageChannel = new MessageChannel()
  
  messageChannel.port1.onmessage = (event) => {
    if (event.data.success === false) {
      console.log('Notification Triggers API not supported, using fallback')
    }
  }
  
  registration.active?.postMessage({
    type: 'SCHEDULE_NOTIFICATION',
    time: time,
    title: '⏰ Time to leave!',
    body: `Beat the traffic! Depart at ${time} for ${fromLocation.value} → ${toLocation.value}`,
    tag: `alarm-${Date.now()}`,
    scheduledTime: scheduledTime
  }, [messageChannel.port2])
  
  console.log(`Scheduled notification via Service Worker for ${scheduledDate.toLocaleString()}`)
}

const scheduleAlarmWithRepeat = (time: string) => {
  // Clear existing alarms
  activeAlarms.value.forEach(id => clearTimeout(id))
  activeAlarms.value = []
  
  const [hours, minutes] = time.split(':').map(Number)
  const now = new Date()
  
  // Get the day of week from selectedDay
  const dayMap: { [key: string]: number } = {
    'zondag': 0,
    'maandag': 1,
    'dinsdag': 2,
    'woensdag': 3,
    'donderdag': 4,
    'vrijdag': 5,
    'zaterdag': 6
  }
  const targetDayOfWeek = dayMap[selectedDay.value] || 1
  
  const scheduleNext = () => {
    const alarmDate = new Date()
    alarmDate.setHours(hours || 0, minutes || 0, 0, 0)
    
    // If time has passed today, schedule for next occurrence
    if (alarmDate <= now) {
      if (alarmRepeat.value === 'once') {
        // Next day
        alarmDate.setDate(alarmDate.getDate() + 1)
      } else if (alarmRepeat.value === 'daily') {
        // Next day
        alarmDate.setDate(alarmDate.getDate() + 1)
      } else if (alarmRepeat.value === 'weekly') {
        // Next week, same day (7 days later)
        alarmDate.setDate(alarmDate.getDate() + 7)
      } else if (alarmRepeat.value === 'weekdays') {
        // Skip to next weekday
        do {
          alarmDate.setDate(alarmDate.getDate() + 1)
        } while (alarmDate.getDay() === 0 || alarmDate.getDay() === 6)
      }
    } else {
      // Time hasn't passed yet today
      if (alarmRepeat.value === 'weekly') {
        // Make sure it's on the correct day of week
        while (alarmDate.getDay() !== targetDayOfWeek) {
          alarmDate.setDate(alarmDate.getDate() + 1)
        }
      }
    }
    
    // For weekdays, ensure it's not weekend
    if (alarmRepeat.value === 'weekdays') {
      while (alarmDate.getDay() === 0 || alarmDate.getDay() === 6) {
        alarmDate.setDate(alarmDate.getDate() + 1)
      }
    }
    
    const msUntilAlarm = alarmDate.getTime() - Date.now()
    
    console.log('⏰ Scheduling alarm:', {
      time: time,
      scheduledFor: alarmDate.toLocaleString(),
      msUntilAlarm: msUntilAlarm,
      notificationPermission: Notification.permission,
      repeat: alarmRepeat.value
    })
    
    const timeoutId = setTimeout(() => {
      console.log('🔔 Alarm firing now!')
      
      // Show notification
      if (Notification.permission === 'granted') {
        console.log('📢 Showing notification...')
        new Notification('⏰ Time to leave!', {
          body: `Beat the traffic! Depart at ${time} for ${fromLocation.value} → ${toLocation.value}`,
          icon: '/icon.png',
          badge: '/badge.png',
          tag: 'traffic-alarm',
          requireInteraction: true
        })
      } else {
        console.log('❌ Notification permission not granted:', Notification.permission)
      }
      
      // Fallback alert
      alert(`⏰ Time to leave! Beat the traffic!\n${fromLocation.value} → ${toLocation.value}`)
      
      // Schedule next alarm if repeating
      if (alarmRepeat.value !== 'once') {
        scheduleNext()
      }
    }, msUntilAlarm)
    
    activeAlarms.value.push(timeoutId)
    
    // Log scheduled time
    const repeatText = {
      once: 'one-time',
      daily: 'daily',
      weekly: 'weekly',
      weekdays: 'on weekdays'
    }[alarmRepeat.value]
    
    console.log(`Alarm scheduled for ${alarmDate.toLocaleString()} (${repeatText})`)
  }
  
  scheduleNext()
}

const cancelAlarms = () => {
  activeAlarms.value.forEach(id => clearTimeout(id))
  activeAlarms.value = []
  alarmTime.value = ''
  showLocationStatus.value = true
  locationStatus.value = '❌ Alarm cancelled'
  locationStatusType.value = 'error'
  setTimeout(() => showLocationStatus.value = false, 3000)
}

const removeAlarm = (index: number) => {
  savedAlarms.value.splice(index, 1)
  localStorage.setItem('savedAlarms', JSON.stringify(savedAlarms.value))
  
  showLocationStatus.value = true
  locationStatus.value = '❌ Alarm verwijderd'
  locationStatusType.value = 'success'
  setTimeout(() => showLocationStatus.value = false, 3000)
}

const clearAllAlarms = () => {
  if (confirm(`Weet je zeker dat je alle ${savedAlarms.value.length} alarm(s) wilt verwijderen?`)) {
    savedAlarms.value = []
    localStorage.removeItem('savedAlarms')
    cancelAlarms()
    showAlarmManager.value = false
    
    showLocationStatus.value = true
    locationStatus.value = '✅ Alle alarmen verwijderd'
    locationStatusType.value = 'success'
    setTimeout(() => showLocationStatus.value = false, 3000)
  }
}

const testNotification = async () => {
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        new Notification('🎉 Test succesvol!', {
          body: 'Notificaties werken! Je krijgt een melding op je alarm tijd.',
          icon: '/icon.png'
        })
      } else {
        alert('❌ Notificaties geblokkeerd. Check je browser instellingen.')
      }
    } else if (Notification.permission === 'granted') {
      new Notification('🎉 Test succesvol!', {
        body: 'Notificaties werken! Je krijgt een melding op je alarm tijd.',
        icon: '/icon.png'
      })
    } else {
      alert('❌ Notificaties zijn geblokkeerd. Ga naar je browser instellingen om dit te wijzigen.')
    }
  } else {
    alert('❌ Je browser ondersteunt geen notificaties.')
  }
}

const installApp = async () => {
  if (!deferredPrompt.value) {
    alert('📱 Open deze site in je browser om de app te installeren!')
    return
  }
  
  deferredPrompt.value.prompt()
  const { outcome } = await deferredPrompt.value.userChoice
  
  if (outcome === 'accepted') {
    console.log('User accepted the install prompt')
  } else {
    console.log('User dismissed the install prompt')
  }
  
  deferredPrompt.value = null
  showInstallPrompt.value = false
}

const dismissInstallPrompt = () => {
  showInstallPrompt.value = false
}

const shareResults = () => {
  const bestTime = bestTimes.value[0] || 'unknown'
  const minDuration = Math.min(...travelTimes.value.map((t) => t.duration))
  const avgDuration = averageDuration.value
  const dayCapitalized = selectedDay.value.charAt(0).toUpperCase() + selectedDay.value.slice(1)
  
  const text = `🚦 I found the best time to beat traffic!\n\n` +
    `📍 ${fromLocation.value} → ${toLocation.value}\n` +
    `📅 Day: ${dayCapitalized}\n` +
    `⏰ Best departure: ${bestTime}\n` +
    `⚡ Travel time: ${minDuration} minutes\n` +
    `📊 Average time: ${avgDuration} minutes\n` +
    `💡 Save ${avgDuration - minDuration} minutes!\n\n` +
    `Check it out: ${window.location.href}`
  
  if (navigator.share) {
    navigator.share({ text })
  } else {
    navigator.clipboard.writeText(text)
    alert('✅ Copied to clipboard!')
  }
}

// Computed values
const averageDuration = computed(() => {
  if (travelTimes.value.length === 0) return 0
  return Math.round(travelTimes.value.reduce((sum, t) => sum + t.duration, 0) / travelTimes.value.length)
})

const timeSaved = computed(() => {
  if (travelTimes.value.length === 0) return 0
  const minDuration = Math.min(...travelTimes.value.map((t) => t.duration))
  return averageDuration.value - minDuration
})

const moneySaved = computed(() => {
  // Assume 1 liter per 15km, €1.80 per liter, 60km/h avg speed
  const kmPerMinute = 1
  const extraKm = timeSaved.value * kmPerMinute
  const litersUsed = extraKm / 15
  return (litersUsed * 1.80).toFixed(2)
})

// Chart data with dynamic colors
const chartData = computed(() => {
  const durations = travelTimes.value.map((t) => t.duration)
  
  if (durations.length === 0) {
    return {
      labels: [],
      datasets: []
    }
  }
  
  const max = Math.max(...durations)
  const min = Math.min(...durations)
  const avg = Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
  
  // Calculate thresholds
  const redThreshold = max - ((max - avg) / 2)
  const orangeThreshold = avg - ((avg - min) / 2)
  
  // Assign colors to each point
  const pointColors = durations.map(duration => {
    if (duration >= redThreshold) return '#ff6b6b' // Red
    if (duration >= orangeThreshold) return '#ffa500' // Orange
    return '#42b983' // Green
  })
  
  const pointBorderColors = durations.map(duration => {
    if (duration >= redThreshold) return '#ff4444'
    if (duration >= orangeThreshold) return '#ff8800'
    return '#2d9968'
  })
  
  return {
    labels: travelTimes.value.map((t) => t.time),
    datasets: [
      {
        label: 'Travel Time (minutes)',
        data: durations,
        borderColor: '#999',
        backgroundColor: 'rgba(150, 150, 150, 0.1)',
        tension: 0.4,
        pointRadius: 8,
        pointHoverRadius: 12,
        borderWidth: 2,
        pointBackgroundColor: pointColors,
        pointBorderColor: pointBorderColors,
        pointBorderWidth: 3
      }
    ]
  }
})

const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top'
    },
    title: {
      display: true,
      text: '🚦 Traffic Pattern Analysis',
      font: {
        size: 16,
        weight: 'bold'
      }
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      title: {
        display: true,
        text: 'Reistijd (minuten)'
      }
    },
    x: {
      title: {
        display: true,
        text: 'Vertrektijd'
      }
    }
  }
}
</script>

<template>
  <div class="traffic-analyzer">
    <!-- PWA Install Banner -->
    <div v-if="showInstallPrompt" class="pwa-install-banner">
      <div class="pwa-banner-content">
        <div class="pwa-banner-icon">📱</div>
        <div class="pwa-banner-text">
          <strong>Installeer de app!</strong>
          <p>Krijg push notificaties op je telefoon, ook als de app gesloten is.</p>
        </div>
      </div>
      <div class="pwa-banner-actions">
        <button @click="installApp" class="pwa-install-btn">Installeren</button>
        <button @click="dismissInstallPrompt" class="pwa-dismiss-btn">✕</button>
      </div>
    </div>

    <!-- Animated background -->
    <div class="animated-bg">
      <div class="car car-1">🚗</div>
      <div class="car car-2">🚙</div>
      <div class="car car-3">🚕</div>
    </div>

    <div class="header-section sticky-header">
      <div class="header-content">
        <div class="header-text">
          <h1>🚦 I Hate Traffic Jams</h1>
          <p class="tagline">Find your perfect departure time</p>
        </div>
        <button 
          @click="showAddressBook = !showAddressBook" 
          class="address-book-toggle"
          :title="showAddressBook ? 'Sluit adresboek' : 'Open adresboek'"
        >
          📖
        </button>
      </div>
    </div>

    <!-- Address Book Modal -->
    <div v-if="showAddressBook" class="modal-overlay" @click="showAddressBook = false">
      <div class="address-book-modal" @click.stop>
        <div class="modal-header">
          <h2>📖 Adresboek</h2>
          <button @click="showAddressBook = false" class="close-btn">✕</button>
        </div>
        
        <div class="add-address-form">
          <div class="form-row-top">
            <div class="emoji-picker-wrapper">
              <label class="emoji-label">Emoji</label>
              <button 
                @click="showEmojiPicker = !showEmojiPicker" 
                class="emoji-picker-btn"
                title="Kies emoji"
              >
                {{ newAddressEmoji }} <span class="picker-arrow">▼</span>
              </button>
            </div>
            <div class="name-location-wrapper">
              <label class="input-label">Naam</label>
              <input
                v-model="newAddressName"
                type="text"
                placeholder="bijv. Werk"
                class="address-input name-input"
                maxlength="20"
              />
            </div>
            <button @click="useCurrentLocationForAddressBook" class="icon-btn location-btn-inline" title="Huidige locatie">
              📍
            </button>
          </div>
          
          <div class="address-wrapper">
            <label class="input-label">Adres</label>
            <input
              id="address-location"
              v-model="newAddressLocation"
              type="text"
              placeholder="Type een adres..."
              class="address-input address-input-full"
            />
          </div>
          
          <div v-if="showEmojiPicker" class="emoji-picker-popup">
            <button
              v-for="emoji in emojis"
              :key="emoji"
              @click="newAddressEmoji = emoji; showEmojiPicker = false"
              :class="['emoji-btn', { active: newAddressEmoji === emoji }]"
            >
              {{ emoji }}
            </button>
          </div>
          
          <button @click="addToAddressBook" class="add-btn">➕ Toevoegen</button>
        </div>

        <div class="address-list">
          <div v-if="addressBook.length === 0" class="empty-state">
            Geen adressen opgeslagen. Voeg er een toe!
          </div>
          <div v-for="(item, idx) in addressBook" :key="idx" class="address-item">
            <div class="address-info">
              <span class="address-emoji">{{ item.emoji }}</span>
              <div class="address-text">
                <strong>{{ item.name }}</strong>
                <span>{{ item.address }}</span>
              </div>
            </div>
            <div class="address-actions">
              <button @click="useAddressFromBook(item.address, 'from')" class="use-btn">
                Van
              </button>
              <button @click="useAddressFromBook(item.address, 'to')" class="use-btn">
                Naar
              </button>
              <button @click="deleteFromAddressBook(idx)" class="delete-btn">
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent searches -->
    <div v-if="recentSearches.length > 0" class="recent-searches">
      <h3>📍 Recent Searches</h3>
      <div class="search-chips">
        <button
          v-for="(search, idx) in recentSearches"
          :key="idx"
          @click="loadRecentSearch(search)"
          class="search-chip"
        >
          {{ search.from.split(',')[0] }} → {{ search.to.split(',')[0] }}
        </button>
      </div>
    </div>

    <div class="form-container">
      <div class="form-row">
        <div class="form-group location-group">
          <label for="from-location">Van (locatie):</label>
          <div class="input-with-buttons">
            <input
              id="from-location"
              v-model="fromLocation"
              type="text"
              placeholder="bijv. Amsterdam Centraal"
            />
            <button @click="useCurrentLocation" class="icon-btn" title="Huidige locatie">
              📍
            </button>
            <button @click="showAddressBook = true" class="icon-btn" title="Uit adresboek">
              📖
            </button>
          </div>
        </div>

        <div class="swap-button-container">
          <button @click="swapLocations" class="swap-btn" title="Wissel om">
            ⇅
          </button>
        </div>

        <div class="form-group location-group">
          <label for="to-location">Naar (locatie):</label>
          <div class="input-with-buttons">
            <input
              id="to-location"
              v-model="toLocation"
              type="text"
              placeholder="bijv. Rotterdam Centraal"
            />
            <button @click="showAddressBook = true" class="icon-btn" title="Uit adresboek">
              📖
            </button>
          </div>
        </div>
      </div>

      <div class="form-row compact">
        <div class="form-group">
          <label for="day">Dag:</label>
          <select id="day" v-model="selectedDay">
            <option v-for="day in days" :key="day" :value="day">
              {{ day.charAt(0).toUpperCase() + day.slice(1) }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="start-time">Van:</label>
          <input id="start-time" v-model="startTime" type="time" />
        </div>

        <div class="form-group">
          <label for="end-time">Tot:</label>
          <input id="end-time" v-model="endTime" type="time" />
        </div>
      </div>

      <button @click="analyzeTravelTimes" :disabled="isLoading" class="analyze-btn">
        {{ isLoading ? currentLoadingMessage : '🚀 Beat the traffic!' }}
      </button>
      
      <!-- Test buttons -->
      <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
        <button @click="testNotification" class="test-notification-btn" title="Test of notificaties werken">
          🔔 Test notificatie
        </button>
        <button @click="showInstallPrompt = !showInstallPrompt" class="test-notification-btn" title="Toon/verberg PWA install banner">
          📱 Toggle PWA
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>{{ currentLoadingMessage }}</p>
    </div>

    <!-- Alarm manager modal -->
    <div v-if="showAlarmManager" class="modal-overlay" @click="showAlarmManager = false">
      <div class="modal-content alarm-manager-modal" @click.stop>
        <h3>⏰ Actieve Alarmen</h3>
        <p class="modal-subtitle">Beheer je ingestelde verkeer alarmen</p>
        
        <div v-if="savedAlarms.length === 0" class="no-alarms">
          <span class="no-alarms-icon">🔔</span>
          <p>Geen actieve alarmen</p>
          <small>Stel een alarm in na een verkeersanalyse</small>
        </div>
        
        <div v-else class="alarms-list">
          <div v-for="(alarm, index) in savedAlarms" :key="index" class="alarm-item">
            <div class="alarm-info">
              <div class="alarm-time">⏰ {{ alarm.time }}</div>
              <div class="alarm-route">📍 {{ alarm.from.split(',')[0] }} → {{ alarm.to.split(',')[0] }}</div>
              <div class="alarm-meta">
                <span class="alarm-day">📅 {{ alarm.day.charAt(0).toUpperCase() + alarm.day.slice(1) }}</span>
                <span class="alarm-repeat">
                  {{ alarm.repeat === 'once' ? '🔔 Eenmalig' : 
                     alarm.repeat === 'daily' ? '📅 Dagelijks' : 
                     alarm.repeat === 'weekly' ? '🔄 Wekelijks' : '💼 Werkdagen' }}
                </span>
              </div>
            </div>
            <button @click="removeAlarm(index)" class="remove-alarm-btn" title="Verwijder alarm">
              🗑️
            </button>
          </div>
        </div>
        
        <div class="alarm-manager-actions">
          <button v-if="savedAlarms.length > 0" @click="clearAllAlarms" class="clear-all-btn">
            🗑️ Verwijder alle alarmen
          </button>
          <button @click="showAlarmManager = false" class="modal-close-btn">
            Sluiten
          </button>
        </div>
      </div>
    </div>

    <!-- Alarm selector dialog -->
    <div v-if="showAlarmSelector" class="modal-overlay" @click="showAlarmSelector = false">
      <div class="modal-content" @click.stop>
        <h3>⏰ Selecteer alarm tijd</h3>
        <p class="modal-subtitle">Kies voor welk tijdstip je een alarm wilt instellen:</p>
        
        <!-- Repeat options -->
        <div class="repeat-options">
          <label class="repeat-label">Herhaling:</label>
          <div class="repeat-buttons">
            <button 
              @click="alarmRepeat = 'once'"
              class="repeat-btn"
              :class="{ active: alarmRepeat === 'once' }"
            >
              🔔 Eenmalig
            </button>
            <button 
              @click="alarmRepeat = 'daily'"
              class="repeat-btn"
              :class="{ active: alarmRepeat === 'daily' }"
            >
              📅 Dagelijks
            </button>
            <button 
              @click="alarmRepeat = 'weekly'"
              class="repeat-btn"
              :class="{ active: alarmRepeat === 'weekly' }"
            >
              🔄 Wekelijks ({{ selectedDay }})
            </button>
            <button 
              @click="alarmRepeat = 'weekdays'"
              class="repeat-btn"
              :class="{ active: alarmRepeat === 'weekdays' }"
            >
              💼 Werkdagen (ma-vr)
            </button>
          </div>
        </div>
        
        <div class="time-selection-grid">
          <button 
            v-for="time in travelTimes" 
            :key="time.time"
            @click="setAlarm(time.time)"
            class="time-selection-btn"
            :class="{ 'best-time': bestTimes.includes(time.time) }"
          >
            <span class="time-value">{{ time.time }}</span>
            <span class="duration-value">{{ time.duration }} min</span>
            <span v-if="bestTimes.includes(time.time)" class="best-badge">✨ Beste tijd</span>
          </button>
        </div>
        <button @click="showAlarmSelector = false" class="modal-close-btn">Annuleren</button>
      </div>
    </div>

    <!-- Alarm set notification -->
    <div v-if="showAlarmSet" class="alarm-notification">
      ⏰ Alarm set for {{ alarmTime }}!
      <span v-if="alarmRepeat !== 'once'" class="repeat-indicator">
        {{ alarmRepeat === 'daily' ? '(dagelijks)' : alarmRepeat === 'weekly' ? '(wekelijks)' : '(werkdagen)' }}
      </span>
    </div>
    
    <!-- Active alarm indicator -->
    <div v-if="savedAlarms.length > 0" class="active-alarm-badge" @click="showAlarmManager = true">
      <span class="alarm-icon">⏰</span>
      <span class="alarm-text">{{ savedAlarms.length }} alarm{{ savedAlarms.length > 1 ? 's' : '' }}</span>
      <span class="alarm-view">›</span>
    </div>
    
    <!-- Location status notification -->
    <div v-if="showLocationStatus" :class="['location-notification', locationStatusType]">
      {{ locationStatus }}
    </div>

    <div v-if="hasError" class="error-message">
      <h2>❌ Fout</h2>
      <p>{{ errorMessage }}</p>
      <p class="error-help">Zie <a href="./GOOGLE_MAPS_SETUP.md" target="_blank">GOOGLE_MAPS_SETUP.md</a> voor setup instructies.</p>
    </div>

    <div v-if="!isLoading && !hasError && travelTimes.length > 0" class="results">
      <div class="best-times">
        <h2>🎯 Your Perfect Escape Time</h2>
        <p class="route-info">
          {{ fromLocation.split(',')[0] }} → {{ toLocation.split(',')[0] }}
        </p>
        <div class="time-badges">
          <span v-for="time in bestTimes" :key="time" class="time-badge">
            {{ time }}
          </span>
        </div>
        <p class="min-duration">
          ⚡ Travel time: {{ Math.min(...travelTimes.map((t) => t.duration)) }} minutes
        </p>

        <!-- Money & time saved -->
        <div class="savings-info">
          <div class="savings-card">
            <span class="savings-icon">⏱️</span>
            <div>
              <div class="savings-value">{{ timeSaved }} min</div>
              <div class="savings-label">{{ timeSaved > 0 ? 'Faster than average' : 'Average time' }}</div>
            </div>
          </div>
          <div class="savings-card">
            <span class="savings-icon">💰</span>
            <div>
              <div class="savings-value">€{{ moneySaved }}</div>
              <div class="savings-label">Fuel saved</div>
            </div>
          </div>
          <div class="savings-card">
            <span class="savings-icon">📊</span>
            <div>
              <div class="savings-value">{{ averageDuration }} min</div>
              <div class="savings-label">Average time</div>
            </div>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="action-buttons">
          <button @click="openAlarmSelector" class="action-btn">
            🔔 Set Alarm
          </button>
          <button @click="shareResults" class="action-btn">
            📱 Share
          </button>
        </div>
        
        <!-- Scroll indicator -->
        <div class="scroll-indicator">
          <span class="scroll-text">📊 Bekijk de grafiek hieronder</span>
          <span class="scroll-arrow">↓</span>
        </div>
      </div>

      <div class="chart-container">
        <div>
          <Line :data="chartData" :options="chartOptions" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* PWA Install Banner */
.pwa-install-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  position: sticky;
  top: 0;
  z-index: 1000;
  animation: slideDown 0.5s ease-out;
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.pwa-banner-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.pwa-banner-icon {
  font-size: 2rem;
}

.pwa-banner-text strong {
  display: block;
  font-size: 1.1rem;
  margin-bottom: 0.25rem;
}

.pwa-banner-text p {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.9;
}

.pwa-banner-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.pwa-install-btn {
  background: white;
  color: #667eea;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
}

.pwa-install-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.pwa-dismiss-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pwa-dismiss-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

@media (max-width: 768px) {
  .pwa-install-banner {
    flex-direction: column;
    text-align: center;
    padding: 1rem;
  }
  
  .pwa-banner-content {
    flex-direction: column;
    text-align: center;
  }
  
  .pwa-banner-actions {
    width: 100%;
    justify-content: center;
  }
}

.traffic-analyzer {
  max-width: 100%;
  margin: 0 auto;
  padding: 0;
  padding-bottom: 2rem;
  position: relative;
}

.traffic-analyzer > * {
  margin-left: auto;
  margin-right: auto;
}

/* Sticky header */
.sticky-header {
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 4px 20px rgba(255, 107, 107, 0.5) !important;
}

.address-book-toggle {
  padding: 0.6rem 0.75rem;
  background: rgba(255, 255, 255, 0.95);
  color: #ff6b6b;
  border: none;
  border-radius: 10px;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
  line-height: 1;
}

.address-book-toggle:hover {
  transform: scale(1.1);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.25);
  background: white;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  animation: fadeIn 0.2s;
}

.address-book-modal {
  background: white;
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s;
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-content {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s;
}

.modal-content h3 {
  margin: 0 0 0.5rem 0;
  color: #ff6b6b;
  font-size: 1.5rem;
}

.modal-subtitle {
  margin: 0 0 1rem 0;
  color: #666;
  font-size: 0.95rem;
}

.repeat-options {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8f8f8;
  border-radius: 12px;
}

.repeat-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.75rem;
}

.repeat-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.repeat-btn {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 0.6rem;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
}

.repeat-btn:hover {
  border-color: #ff6b6b;
  transform: translateY(-1px);
}

.repeat-btn.active {
  background: #ff6b6b;
  color: white;
  border-color: #ff6b6b;
  font-weight: 600;
}

.repeat-indicator {
  font-size: 0.85rem;
  margin-left: 0.5rem;
  opacity: 0.8;
}

.active-alarm-badge {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 50px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  box-shadow: 0 4px 20px rgba(255, 107, 107, 0.4);
  cursor: pointer;
  transition: all 0.3s;
  z-index: 999;
  animation: alarmPulse 2s ease-in-out infinite;
}

.active-alarm-badge:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 24px rgba(255, 107, 107, 0.5);
}

.alarm-icon {
  font-size: 1.3rem;
  animation: ring 1.5s ease-in-out infinite;
}

.alarm-text {
  font-size: 1rem;
  font-weight: 700;
}

.alarm-cancel {
  font-size: 1.2rem;
  opacity: 0.8;
  transition: opacity 0.3s;
}

.active-alarm-badge:hover .alarm-cancel {
  opacity: 1;
}

.alarm-view {
  font-size: 1.5rem;
  font-weight: bold;
  opacity: 0.8;
}

.alarm-manager-modal {
  max-width: 600px;
}

.no-alarms {
  text-align: center;
  padding: 3rem 1rem;
  color: #999;
}

.no-alarms-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.no-alarms p {
  margin: 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.no-alarms small {
  color: #bbb;
}

.alarms-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  max-height: 400px;
  overflow-y: auto;
}

.alarm-item {
  background: #f8f8f8;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s;
}

.alarm-item:hover {
  border-color: #ff6b6b;
  transform: translateX(4px);
}

.alarm-info {
  flex: 1;
}

.alarm-time {
  font-size: 1.3rem;
  font-weight: 700;
  color: #ff6b6b;
  margin-bottom: 0.5rem;
}

.alarm-route {
  font-size: 0.95rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.alarm-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: #666;
}

.alarm-day, .alarm-repeat {
  background: white;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
}

.remove-alarm-btn {
  background: #fee;
  border: 2px solid #fcc;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.3s;
}

.remove-alarm-btn:hover {
  background: #ff6b6b;
  border-color: #ff6b6b;
  transform: scale(1.1);
}

.alarm-manager-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.clear-all-btn {
  width: 100%;
  background: #fee;
  border: 2px solid #fcc;
  padding: 0.85rem;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #c33;
  cursor: pointer;
  transition: all 0.3s;
}

.clear-all-btn:hover {
  background: #fcc;
  border-color: #faa;
  color: #a11;
}

@keyframes alarmPulse {
  0%, 100% {
    box-shadow: 0 4px 20px rgba(255, 107, 107, 0.4);
  }
  50% {
    box-shadow: 0 4px 30px rgba(255, 107, 107, 0.6);
  }
}

@keyframes ring {
  0%, 100% {
    transform: rotate(0deg);
  }
  10%, 30% {
    transform: rotate(-10deg);
  }
  20%, 40% {
    transform: rotate(10deg);
  }
  50% {
    transform: rotate(0deg);
  }
}

.time-selection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  max-height: 400px;
  overflow-y: auto;
  padding: 0.25rem;
}

.time-selection-btn {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.time-selection-btn:hover {
  border-color: #ff6b6b;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
}

.time-selection-btn.best-time {
  background: linear-gradient(135deg, #fff5f5 0%, #ffe0e0 100%);
  border-color: #ff6b6b;
  border-width: 3px;
}

.time-value {
  font-size: 1.2rem;
  font-weight: 700;
  color: #333;
}

.duration-value {
  font-size: 0.85rem;
  color: #666;
}

.best-badge {
  font-size: 0.7rem;
  color: #ff6b6b;
  font-weight: 600;
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
}

.modal-close-btn {
  width: 100%;
  background: #f5f5f5;
  border: none;
  padding: 0.85rem;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  color: #666;
  cursor: pointer;
  transition: all 0.3s;
}

.modal-close-btn:hover {
  background: #e0e0e0;
  color: #333;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 2px solid #f0f0f0;
}

.modal-header h2 {
  margin: 0;
  color: #ff6b6b;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.add-address-form {
  padding: 1rem;
  border-bottom: 2px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: relative;
}

.emoji-picker-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.emoji-label {
  font-size: 0.8rem;
  color: #666;
  font-weight: 600;
}

.input-label {
  font-size: 0.8rem;
  color: #666;
  font-weight: 600;
  display: block;
  margin-bottom: 0.25rem;
}

.form-row-top {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.name-location-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.address-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.location-btn-inline {
  flex-shrink: 0;
  height: 50px;
  padding: 0.75rem 1rem;
  margin-bottom: 0;
}

.emoji-picker-btn {
  background: #f5f5f5;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1.8rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  width: 85px;
  height: 50px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  position: relative;
}

.picker-arrow {
  font-size: 0.7rem;
  color: #999;
  position: absolute;
  bottom: 4px;
  right: 6px;
}

.emoji-picker-btn:hover {
  background: #e0e0e0;
  border-color: #42b983;
}

.emoji-picker-popup {
  position: absolute;
  top: 90px;
  left: 1rem;
  z-index: 10;
  background: white;
  border: 2px solid #42b983;
  border-radius: 12px;
  padding: 0.75rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0.5rem;
}

.emoji-btn {
  background: #f5f5f5;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1.5rem;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.emoji-btn:hover {
  background: #e0e0e0;
  transform: scale(1.1);
}

.emoji-btn.active {
  background: #ff6b6b;
  border-color: #ff6b6b;
  transform: scale(1.15);
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
}

.name-input {
  width: 100%;
}

.address-input-full {
  width: 100%;
}

.address-input {
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.3s;
}

.address-input:focus {
  outline: none;
  border-color: #42b983;
}

.add-btn {
  padding: 0.65rem;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.add-btn:hover {
  background: #35956f;
  transform: translateY(-2px);
}

.address-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #999;
  font-style: italic;
}

.address-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  margin-bottom: 0.75rem;
  transition: all 0.2s;
  flex-wrap: wrap;
}

.address-item:hover {
  border-color: #ff6b6b;
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.2);
}

.address-info {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex: 1;
  min-width: 200px;
}

.address-emoji {
  font-size: 2rem;
  flex-shrink: 0;
}

.address-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.address-text strong {
  color: #333;
  font-size: 1.1rem;
}

.address-text span {
  color: #666;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.address-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  flex-wrap: nowrap;
}

.use-btn {
  padding: 0.5rem 0.9rem;
  background: #f5f5f5;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.use-btn:hover {
  background: #42b983;
  color: white;
  border-color: #42b983;
}

.delete-btn {
  padding: 0.5rem;
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.delete-btn:hover {
  opacity: 1;
}

/* Animated background */
.animated-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.car {
  position: absolute;
  font-size: 2rem;
  opacity: 0.15;
  animation: drive 15s linear infinite;
}

.car-1 {
  top: 20%;
  animation-delay: 0s;
}

.car-2 {
  top: 50%;
  animation-delay: 5s;
}

.car-3 {
  top: 80%;
  animation-delay: 10s;
}

@keyframes drive {
  0% {
    left: -50px;
  }
  100% {
    left: 100%;
  }
}

.header-section {
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  border-radius: 0;
  color: white;
  box-shadow: 0 4px 20px rgba(255, 107, 107, 0.3);
  position: relative;
  z-index: 1;
  margin-bottom: 0;
  width: 100%;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  max-width: 850px;
  margin: 0 auto;
  width: 100%;
}

.header-text {
  flex: 1;
  text-align: left;
}

h1 {
  font-size: 1.6rem;
  color: white;
  margin: 0;
  font-weight: 900;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
  line-height: 1.2;
}

.tagline {
  color: rgba(255, 255, 255, 0.9);
  margin: 0.15rem 0 0 0;
  font-size: 0.85rem;
  font-weight: 400;
}

/* Recent searches */
.recent-searches {
  background: white;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin: 1rem 1rem;
  max-width: 850px;
  margin-left: auto;
  margin-right: auto;
}

.recent-searches h3 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #666;
}

.search-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.search-chip {
  background: #f5f5f5;
  border: 2px solid #e0e0e0;
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.search-chip:hover {
  background: #ff6b6b;
  color: white;
  border-color: #ff6b6b;
}

.form-container {
  background: white;
  padding: 1.5rem;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin: 1rem 1rem;
  max-width: 850px;
  margin-left: auto;
  margin-right: auto;
  position: relative;
  z-index: 1;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1rem;
  align-items: end;
}

.form-row.compact {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

label {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

.input-with-buttons {
  display: flex;
  gap: 0.4rem;
}

.input-with-buttons input {
  flex: 1;
}

.icon-btn {
  padding: 0.75rem;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s;
  flex-shrink: 0;
}

.icon-btn:hover {
  background: #35956f;
  transform: scale(1.05);
}

.swap-button-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 1.8rem;
}

.swap-btn {
  padding: 0.6rem;
  background: white;
  border: 3px solid #ff6b6b;
  border-radius: 50%;
  font-size: 1.8rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  width: 45px;
  height: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.swap-btn:hover {
  background: #ff6b6b;
  transform: rotate(180deg) scale(1.1);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

select,
input[type='time'],
input[type='text'] {
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s;
  width: 100%;
}

select:focus,
input[type='time']:focus,
input[type='text']:focus {
  outline: none;
  border-color: #42b983;
}

input[type='text']::placeholder {
  color: #999;
}

.analyze-btn {
  padding: 0.9rem 2rem;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
  width: 100%;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
  margin-top: 0.5rem;
}

.analyze-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #ee5a6f 0%, #ff6b6b 100%);
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(255, 107, 107, 0.5);
}

.analyze-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.test-notification-btn {
  padding: 0.7rem 1.5rem;
  background: white;
  color: #ff6b6b;
  border: 2px solid #ff6b6b;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
  width: 100%;
  margin-top: 0.75rem;
}

.test-notification-btn:hover {
  background: #ff6b6b;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

.loading {
  text-align: center;
  padding: 2rem;
  position: relative;
  z-index: 1;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  margin: 1rem 1rem;
  max-width: 850px;
  margin-left: auto;
  margin-right: auto;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #42b983;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Alarm notification */
.alarm-notification {
  position: fixed;
  top: 2rem;
  right: 2rem;
  background: #42b983;
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.3s, slideOut 0.3s 2.7s;
  z-index: 1000;
  font-weight: 600;
}

/* Location status notification */
.location-notification {
  position: fixed;
  top: 2rem;
  right: 2rem;
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.3s;
  z-index: 1000;
  font-weight: 600;
  font-size: 1rem;
}

.location-notification.success {
  background: #42b983;
}

.location-notification.error {
  background: #ff6b6b;
}

.location-notification.info {
  background: #3498db;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(400px);
    opacity: 0;
  }
}

.error-message {
  background: #fee;
  border: 2px solid #f88;
  border-radius: 16px;
  padding: 2rem;
  margin: 1rem 1rem;
  max-width: 850px;
  margin-left: auto;
  margin-right: auto;
  text-align: center;
  animation: fadeIn 0.5s;
  position: relative;
  z-index: 1;
}

.error-message h2 {
  color: #c33;
  margin: 0 0 0.75rem 0;
  font-size: 1.3rem;
}

.error-message p {
  color: #666;
  margin: 0.4rem 0;
  font-size: 0.95rem;
}

.error-help {
  margin-top: 1rem;
  font-size: 0.9rem;
}

.error-help a {
  color: #42b983;
  font-weight: 600;
}

.results {
  animation: fadeIn 0.5s;
  position: relative;
  z-index: 1;
  margin: 1rem 1rem;
  max-width: 850px;
  margin-left: auto;
  margin-right: auto;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.best-times {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  color: white;
  padding: 2rem;
  border-radius: 16px;
  margin-bottom: 1.5rem;
  text-align: center;
  box-shadow: 0 8px 25px rgba(255, 107, 107, 0.3);
}

.best-times h2 {
  margin: 0 0 1rem 0;
  font-size: 1.8rem;
}

.route-info {
  font-size: 1.2rem;
  margin-bottom: 1rem;
  font-weight: 500;
  opacity: 0.95;
}

.time-badges {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.time-badge {
  background: white;
  color: #ff6b6b;
  padding: 0.6rem 1.2rem;
  border-radius: 25px;
  font-size: 1.4rem;
  font-weight: 900;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  border: 3px solid rgba(255, 255, 255, 0.3);
}

.min-duration {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  opacity: 0.95;
}

/* Savings info */
.savings-info {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.savings-card {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.75rem 1.2rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  backdrop-filter: blur(10px);
}

.savings-icon {
  font-size: 1.7rem;
}

.savings-value {
  font-size: 1.3rem;
  font-weight: 900;
}

.savings-label {
  font-size: 0.8rem;
  opacity: 0.9;
}

/* Action buttons */
.action-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.action-btn {
  background: white;
  color: #ff6b6b;
  border: none;
  padding: 0.65rem 1.2rem;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.scroll-indicator {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 2px dashed rgba(255, 107, 107, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  animation: pulse 2s ease-in-out infinite;
}

.scroll-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: #ff6b6b;
}

.scroll-arrow {
  font-size: 1.5rem;
  animation: bounce 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(8px);
  }
}

.chart-container {
  background: white;
  padding: 1rem;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  margin-top: 1.5rem;
  min-height: 350px;
}

.chart-container > div {
  height: 350px;
}

.chart-header {
  margin-bottom: 1.5rem;
  text-align: center;
}

.chart-header h3 {
  margin: 0 0 0.5rem 0;
  color: #ff6b6b;
  font-size: 1.5rem;
}

.chart-description {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .header-content {
    gap: 0.75rem;
  }
  
  h1 {
    font-size: 1.3rem;
  }

  .tagline {
    font-size: 0.75rem;
  }
  
  .address-book-toggle {
    font-size: 1.3rem;
    padding: 0.5rem 0.65rem;
  }

  .form-container {
    padding: 1rem;
    margin: 1rem 0.75rem;
  }
  
  .recent-searches {
    margin: 1rem 0.75rem;
  }
  
  .loading,
  .error-message,
  .results {
    margin: 1rem 0.75rem;
  }
  
  .form-row {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  
  .swap-btn {
    padding-top: 0;
    margin: 0.5rem auto;
  }

  .savings-info {
    flex-direction: column;
  }

  .savings-card {
    width: 100%;
  }

  .alarm-notification {
    left: 1rem;
    right: 1rem;
  }
}
</style>
