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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

// Get current day name in English
const getCurrentDayName = (): string => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[new Date().getDay()] || 'monday'
}

// Form inputs
const selectedDay = ref<string>(getCurrentDayName())
const startTime = ref<string>('07:00')
const endTime = ref<string>('09:00')
const fromLocation = ref<string>('')
const toLocation = ref<string>('')
const timeMode = ref<'departure' | 'arrival'>('departure') // departure = vertrektijd, arrival = aankomsttijd

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

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

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
      locationStatus.value = `⏰ You have ${savedAlarms.value.length} active alarm${savedAlarms.value.length > 1 ? 's' : ''}`
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
    locationStatus.value = '✅ App installed! You will now receive push notifications.'
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

// Fetch travel time using Google Maps API
const fetchTravelTime = async (
  day: string,
  time: string,
  from: string,
  to: string
): Promise<number> => {
  const targetTime = createDepartureTime(day, time)
  const dayOfWeek = targetTime.getDay()
  
  const result = await getTravelTime(from, to, targetTime, dayOfWeek, timeMode.value)
  return result.durationInTraffic
}

// Fetch all travel times
const analyzeTravelTimes = async () => {
  if (!fromLocation.value.trim() || !toLocation.value.trim()) {
    alert('Please enter both locations!')
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
    if (timeMode.value === 'departure') {
      // Normal mode: analyze different departure times
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
    } else {
      // Arrival mode: I want to ARRIVE between startTime-endTime
      // Strategy: sample traffic in that range, calculate backwards
      
      // Parse desired arrival time range
      const arrivalStartParts = startTime.value.split(':').map(Number)
      const arrivalEndParts = endTime.value.split(':').map(Number)
      const arrivalStartMin = (arrivalStartParts[0] || 0) * 60 + (arrivalStartParts[1] || 0)
      const arrivalEndMin = (arrivalEndParts[0] || 0) * 60 + (arrivalEndParts[1] || 0)
      
      // Sample travel time at middle of desired arrival time
      const midArrivalMin = Math.floor((arrivalStartMin + arrivalEndMin) / 2)
      const midH = Math.floor(midArrivalMin / 60)
      const midM = midArrivalMin % 60
      const sampleTime = `${String(midH).padStart(2, '0')}:${String(midM).padStart(2, '0')}`
      
      // Get travel time for sample time
      const sampleDuration = await fetchTravelTime(
        selectedDay.value,
        sampleTime,
        fromLocation.value,
        toLocation.value
      )
      
      // Calculate backwards: first possible departure time
      // Earliest arrival = arrivalStartMin, subtract travel time + generous buffer
      const estimatedDepartMin = arrivalStartMin - sampleDuration - 90 // 1.5 hour buffer to be safe
      
      // Find first departure time that arrives within range
      let currentDepartMin = Math.max(0, estimatedDepartMin)
      let foundFirst = false
      
      while (currentDepartMin <= arrivalEndMin + 60) { // up to 1 hour after end
        const dH = Math.floor(currentDepartMin / 60)
        const dM = currentDepartMin % 60
        const departTime = `${String(dH).padStart(2, '0')}:${String(dM).padStart(2, '0')}`
        
        const duration = await fetchTravelTime(
          selectedDay.value,
          departTime,
          fromLocation.value,
          toLocation.value
        )
        
        const arrivalMin = currentDepartMin + duration
        const aH = Math.floor(arrivalMin / 60) % 24
        const aM = arrivalMin % 60
        const arrivalTimeStr = `${String(aH).padStart(2, '0')}:${String(aM).padStart(2, '0')}`
        
        // Check if arrival falls within range
        const isInRange = arrivalMin >= arrivalStartMin && arrivalMin <= arrivalEndMin
        
        if (isInRange) {
          foundFirst = true
          travelTimes.value.push({
            time: departTime,
            duration: duration,
            arrivalTime: arrivalTimeStr
          } as any)
        } else if (foundFirst && arrivalMin > arrivalEndMin) {
          // We are AFTER the range, stop
          break
        }
        // If we are BEFORE the range (arrivalMin < arrivalStartMin), keep searching
        
        currentDepartMin += 5
      }
    }

    // Find the best time(s)
    if (travelTimes.value.length > 0) {
      // Always find the shortest travel time
      const minDuration = Math.min(...travelTimes.value.map((t) => t.duration))
      
      if (timeMode.value === 'departure') {
        bestTimes.value = travelTimes.value
          .filter((t) => t.duration === minDuration)
          .map((t) => t.time)
      } else {
        // In arrival mode: show departure time → arrival time for best times
        bestTimes.value = travelTimes.value
          .filter((t) => t.duration === minDuration)
          .map((t) => {
            const arrTime = (t as any).arrivalTime || ''
            return `${t.time} → ${arrTime}`
          })
      }
      
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
    errorMessage.value = error.message || 'Cannot fetch traffic information. Check your API key in GOOGLE_MAPS_SETUP.md'
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
    alert('Geolocation is not supported by your browser')
    return
  }

  locationStatus.value = '📍 Getting location...'
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
      
      locationStatus.value = '🔍 Finding address...'
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
              locationStatus.value = '✅ Location filled!'
              locationStatusType.value = 'success'
              console.log('Set location to:', results[0].formatted_address)
              setTimeout(() => showLocationStatus.value = false, 2000)
            } else {
              locationStatus.value = '❌ Address not found'
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
        locationStatus.value = '❌ Permission denied'
      } else if (error.code === 2) {
        locationStatus.value = '❌ Location unavailable'
      } else if (error.code === 3) {
        locationStatus.value = '⏱️ Timeout'
      } else {
        locationStatus.value = '❌ Error occurred'
      }
      setTimeout(() => showLocationStatus.value = false, 3000)
    },
    options
  )
}

// Use current location for address book
const useCurrentLocationForAddressBook = async () => {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser')
    return
  }

  locationStatus.value = '📍 Getting location...'
  locationStatusType.value = 'info'
  showLocationStatus.value = true

  try {
    await loadGoogleMapsAPI()
  } catch (error) {
    locationStatus.value = '❌ Failed to load Google Maps'
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
      
      locationStatus.value = '🔍 Finding address...'
      locationStatusType.value = 'info'
      console.log('Got location for address book:', lat, lng)
      
      try {
        const google = (window as any).google
        if (!google || !google.maps || !google.maps.Geocoder) {
          locationStatus.value = '❌ Google Maps not available'
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
              locationStatus.value = '✅ Location filled!'
              locationStatusType.value = 'success'
              console.log('Set address book location to:', results[0].formatted_address)
              setTimeout(() => showLocationStatus.value = false, 2000)
            } else {
              locationStatus.value = '❌ Address not found'
              locationStatusType.value = 'error'
              setTimeout(() => showLocationStatus.value = false, 3000)
            }
          }
        )
      } catch (error) {
        console.error('Geocoding error:', error)
        locationStatus.value = '❌ Error getting address'
        locationStatusType.value = 'error'
        setTimeout(() => showLocationStatus.value = false, 3000)
      }
    },
    (error) => {
      console.error('Geolocation error:', error)
      locationStatusType.value = 'error'
      if (error.code === 1) {
        locationStatus.value = '❌ Permission denied'
      } else if (error.code === 2) {
        locationStatus.value = '❌ Location unavailable'
      } else if (error.code === 3) {
        locationStatus.value = '❌ Timeout'
      } else {
        locationStatus.value = '❌ Error occurred'
      }
      setTimeout(() => showLocationStatus.value = false, 3000)
    },
    options
  )
}

// Address book functions
const addToAddressBook = () => {
  if (!newAddressName.value.trim() || !newAddressLocation.value.trim()) {
    alert('Fill in name and address!')
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
  console.log('🔔 Setting alarm for:', time)
  alarmTime.value = time
  showAlarmSelector.value = false
  
  // Parse time
  const [hours, minutes] = time.split(':').map(Number)
  
  // Save alarm to localStorage for tracking
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
  
  // Create alarm message
  const message = `Leave from ${fromLocation.value.split(',')[0]} to ${toLocation.value.split(',')[0]}`
  
  // Try to open native clock app with alarm
  const isAndroid = /android/i.test(navigator.userAgent)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isWindows = /Windows/.test(navigator.userAgent)
  
  try {
    if (isAndroid) {
      // Android Intent to open clock app with pre-filled alarm
      const intentUrl = `intent://alarm/#Intent;` +
        `scheme=clock;` +
        `action=android.intent.action.SET_ALARM;` +
        `i.hour=${hours};` +
        `i.minutes=${minutes};` +
        `S.message=${encodeURIComponent(message)};` +
        `b.skip_ui=false;` +
        `end`
      
      console.log('📱 Opening Android clock app...', intentUrl)
      window.location.href = intentUrl
      
    } else if (isWindows) {
      // Windows: Open Alarms & Clock app
      console.log('🖥️ Opening Windows Alarms & Clock app...')
      window.location.href = 'ms-clock:'
      
      // Windows protocol can't pre-fill alarm data, show instructions
      setTimeout(() => {
        alert(`⏰ Alarms & Clock app opened.\n\nPlease set alarm for: ${time}\nReminder: ${message}`)
      }, 500)
      
    } else if (isIOS) {
      // iOS: Open clock app (can't pre-fill alarm unfortunately)
      console.log('📱 Opening iOS clock app...')
      window.location.href = 'clock-alarm://'
      
      // Fallback if that doesn't work
      setTimeout(() => {
        alert(`⏰ Set alarm manually in Clock app:\n${time}\n"${message}"`)
      }, 1000)
      
    } else {
      // Other Desktop: Show instructions
      alert(`⏰ Set alarm in your system:\nTime: ${time}\nMessage: ${message}`)
    }
    
    showAlarmSet.value = true
    setTimeout(() => showAlarmSet.value = false, 5000)
    
  } catch (error) {
    console.error('Failed to open clock app:', error)
    alert(`⏰ Please set alarm manually:\nTime: ${time}\n"${message}"`)
  }
}



const scheduleAlarmWithRepeat = (time: string) => {
  // Clear existing alarms
  activeAlarms.value.forEach(id => clearTimeout(id))
  activeAlarms.value = []
  
  const [hours, minutes] = time.split(':').map(Number)
  const now = new Date()
  
  // Get the day of week from selectedDay
  const dayMap: { [key: string]: number } = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
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
  locationStatus.value = '❌ Alarm removed'
  locationStatusType.value = 'success'
  setTimeout(() => showLocationStatus.value = false, 3000)
}

const clearAllAlarms = () => {
  if (confirm(`Are you sure you want to delete all ${savedAlarms.value.length} alarm(s)?`)) {
    savedAlarms.value = []
    localStorage.removeItem('savedAlarms')
    cancelAlarms()
    showAlarmManager.value = false
    
    showLocationStatus.value = true
    locationStatus.value = '✅ All alarms removed'
    locationStatusType.value = 'success'
    setTimeout(() => showLocationStatus.value = false, 3000)
  }
}

const testNotification = async () => {
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        new Notification('🎉 Test successful!', {
          body: 'Notifications work! You will get a notification at your alarm time.',
          icon: '/icon.png'
        })
      } else {
        alert('❌ Notifications blocked. Check your browser settings.')
      }
    } else if (Notification.permission === 'granted') {
      new Notification('🎉 Test successful!', {
        body: 'Notifications work! You will get a notification at your alarm time.',
        icon: '/icon.png'
      })
    } else {
      alert('❌ Notifications are blocked. Go to your browser settings to change this.')
    }
  } else {
    alert('❌ Your browser does not support notifications.')
  }
}

const installApp = async () => {
  if (!deferredPrompt.value) {
    alert('📱 Open this site in your browser to install the app!')
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

// Matrix data for journey visualization
interface MatrixRow {
  departureTime: string
  arrivalTime: string
  duration: number
  color: string
  startPercent: number
  widthPercent: number
}

const matrixData = computed((): MatrixRow[] => {
  if (travelTimes.value.length === 0) return []
  
  const durations = travelTimes.value.map((t) => t.duration)
  const max = Math.max(...durations)
  const min = Math.min(...durations)
  const avg = Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
  
  // Calculate thresholds (same as chart)
  const redThreshold = max - ((max - avg) / 2)
  const orangeThreshold = avg - ((avg - min) / 2)
  
  // Parse times to get all time points for axis
  const allTimes = new Set<string>()
  
  const rows: MatrixRow[] = travelTimes.value.map((item) => {
    const [depHour, depMin] = item.time.split(':').map(Number)
    const depMinutes = (depHour || 0) * 60 + (depMin || 0)
    
    // Use arrivalTime if available (arrival mode), otherwise calculate
    let arrivalTime: string
    if ((item as any).arrivalTime) {
      arrivalTime = (item as any).arrivalTime
    } else {
      // Calculate arrival time
      const arrMinutes = depMinutes + item.duration
      const arrHour = Math.floor(arrMinutes / 60) % 24
      const arrMin = arrMinutes % 60
      arrivalTime = `${String(arrHour).padStart(2, '0')}:${String(arrMin).padStart(2, '0')}`
    }
    
    allTimes.add(item.time)
    allTimes.add(arrivalTime)
    
    // Determine color based on duration
    let color = '#42b983' // Green
    if (item.duration >= redThreshold) {
      color = '#ff6b6b' // Red
    } else if (item.duration >= orangeThreshold) {
      color = '#ffa500' // Orange
    }
    
    return {
      departureTime: item.time,
      arrivalTime,
      duration: item.duration,
      color,
      startPercent: 0,
      widthPercent: 0
    }
  })
  
  // Get min/max times for axis
  const sortedTimes = Array.from(allTimes).sort((a, b) => {
    const [aH, aM] = a.split(':').map(Number)
    const [bH, bM] = b.split(':').map(Number)
    return ((aH || 0) * 60 + (aM || 0)) - ((bH || 0) * 60 + (bM || 0))
  })
  
  const minTimeMinutes = (() => {
    const [h, m] = sortedTimes[0]!.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  })()
  
  const maxTimeMinutes = (() => {
    const [h, m] = sortedTimes[sortedTimes.length - 1]!.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  })()
  
  const totalRange = maxTimeMinutes - minTimeMinutes
  
  // Calculate positions for bars
  rows.forEach(row => {
    const [depH, depM] = row.departureTime.split(':').map(Number)
    const depMinutes = (depH || 0) * 60 + (depM || 0)
    
    const [arrH, arrM] = row.arrivalTime.split(':').map(Number)
    const arrMinutes = (arrH || 0) * 60 + (arrM || 0)
    
    row.startPercent = ((depMinutes - minTimeMinutes) / totalRange) * 100
    row.widthPercent = ((arrMinutes - depMinutes) / totalRange) * 100
  })
  
  return rows
})

// Time labels for matrix axis
const matrixTimeLabels = computed((): string[] => {
  if (travelTimes.value.length === 0) return []
  
  const allTimes = new Set<string>()
  
  travelTimes.value.forEach(item => {
    allTimes.add(item.time)
    
    // Use arrivalTime if available (arrival mode), otherwise calculate
    if ((item as any).arrivalTime) {
      allTimes.add((item as any).arrivalTime)
    } else {
      const [depHour, depMin] = item.time.split(':').map(Number)
      const depMinutes = (depHour || 0) * 60 + (depMin || 0)
      const arrMinutes = depMinutes + item.duration
      const arrHour = Math.floor(arrMinutes / 60) % 24
      const arrMin = arrMinutes % 60
      const arrivalTime = `${String(arrHour).padStart(2, '0')}:${String(arrMin).padStart(2, '0')}`
      allTimes.add(arrivalTime)
    }
  })
  
  return Array.from(allTimes).sort((a, b) => {
    const [aH, aM] = a.split(':').map(Number)
    const [bH, bM] = b.split(':').map(Number)
    return ((aH || 0) * 60 + (aM || 0)) - ((bH || 0) * 60 + (bM || 0))
  })
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
    if (duration >= redThreshold) return '#e53935' // Darker Red
    if (duration >= orangeThreshold) return '#fb8c00' // Darker Orange
    return '#43a047' // Darker Green
  })
  
  const pointBorderColors = durations.map(duration => {
    if (duration >= redThreshold) return '#c62828'
    if (duration >= orangeThreshold) return '#ef6c00'
    return '#2e7d32'
  })
  
  return {
    labels: timeMode.value === 'arrival' 
      ? travelTimes.value.map((t: any) => `${t.time} → ${t.arrivalTime || ''}`)
      : travelTimes.value.map((t) => t.time),
    datasets: [
      {
        label: timeMode.value === 'arrival' ? 'Departure time → Arrival time' : 'Travel time (minutes)',
        data: durations,
        borderColor: '#424242',
        backgroundColor: 'rgba(66, 66, 66, 0.15)',
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

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        color: '#212121',
        font: {
          size: 13,
          weight: 'bold' as const
        }
      }
    },
    title: {
      display: true,
      text: timeMode.value === 'departure' 
        ? '🚦 Compare departure times' 
        : '⏱️ Travel time by departure time',
      color: '#212121',
      font: {
        size: 18,
        weight: 'bold' as const
      }
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      title: {
        display: true,
        text: 'Travel time (minutes)',
        color: '#424242',
        font: {
          size: 14,
          weight: 'bold' as const
        }
      },
      ticks: {
        color: '#424242',
        font: {
          size: 12
        }
      },
      grid: {
        color: 'rgba(0, 0, 0, 0.1)'
      }
    },
    x: {
      title: {
        display: true,
        text: timeMode.value === 'departure' 
          ? 'Departure time' 
          : 'Departure time',
        color: '#424242',
        font: {
          size: 14,
          weight: 'bold' as const
        }
      },
      ticks: {
        color: '#424242',
        font: {
          size: 12
        }
      },
      grid: {
        color: 'rgba(0, 0, 0, 0.1)'
      }
    }
  }
}))
</script>

<template>
  <div class="traffic-analyzer">
    <!-- PWA Install Banner -->
    <div v-if="showInstallPrompt" class="pwa-install-banner">
      <div class="pwa-banner-content">
        <div class="pwa-banner-icon">📱</div>
        <div class="pwa-banner-text">
          <strong>Install the app!</strong>
          <p>Get push notifications on your phone, even when the app is closed.</p>
        </div>
      </div>
      <div class="pwa-banner-actions">
        <button @click="installApp" class="pwa-install-btn">Install</button>
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
          :title="showAddressBook ? 'Close address book' : 'Open address book'"
        >
          📖
        </button>
      </div>
    </div>

    <!-- Address Book Modal -->
    <div v-if="showAddressBook" class="modal-overlay" @click="showAddressBook = false">
      <div class="address-book-modal" @click.stop>
        <div class="modal-header">
          <h2>📖 Address Book</h2>
          <button @click="showAddressBook = false" class="close-btn">✕</button>
        </div>
        
        <div class="add-address-form">
          <div class="form-row-top">
            <div class="emoji-picker-wrapper">
              <label class="emoji-label">Emoji</label>
              <button 
                @click="showEmojiPicker = !showEmojiPicker" 
                class="emoji-picker-btn"
                title="Choose emoji"
              >
                {{ newAddressEmoji }} <span class="picker-arrow">▼</span>
              </button>
            </div>
            <div class="name-location-wrapper">
              <label class="input-label">Name</label>
              <input
                v-model="newAddressName"
                type="text"
                placeholder="e.g. Work"
                class="address-input name-input"
                maxlength="20"
              />
            </div>
            <button @click="useCurrentLocationForAddressBook" class="icon-btn location-btn-inline" title="Current location">
              📍
            </button>
          </div>
          
          <div class="address-wrapper">
            <label class="input-label">Address</label>
            <input
              id="address-location"
              v-model="newAddressLocation"
              type="text"
              placeholder="Type an address..."
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
          
          <button @click="addToAddressBook" class="add-btn">➕ Add</button>
        </div>

        <div class="address-list">
          <div v-if="addressBook.length === 0" class="empty-state">
            No addresses saved. Add one!
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
                From
              </button>
              <button @click="useAddressFromBook(item.address, 'to')" class="use-btn">
                To
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
          <label for="from-location">From (location):</label>
          <div class="input-with-buttons">
            <input
              id="from-location"
              v-model="fromLocation"
              type="text"
              placeholder="e.g. Amsterdam Central"
            />
            <button @click="useCurrentLocation" class="icon-btn" title="Current location">
              📍
            </button>
            <button @click="showAddressBook = true" class="icon-btn" title="From address book">
              📖
            </button>
          </div>
        </div>

        <div class="swap-button-container">
          <button @click="swapLocations" class="swap-btn" title="Swap">
            ⇅
          </button>
        </div>

        <div class="form-group location-group">
          <label for="to-location">To (location):</label>
          <div class="input-with-buttons">
            <input
              id="to-location"
              v-model="toLocation"
              type="text"
              placeholder="e.g. Rotterdam Central"
            />
            <button @click="showAddressBook = true" class="icon-btn" title="From address book">
              📖
            </button>
          </div>
        </div>
      </div>

      <div class="form-row compact">
        <div class="form-group">
          <label for="day">Day:</label>
          <select id="day" v-model="selectedDay">
            <option v-for="day in days" :key="day" :value="day">
              {{ day.charAt(0).toUpperCase() + day.slice(1) }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="start-time">{{ timeMode === 'arrival' ? 'Arrive from:' : 'From:' }}</label>
          <input id="start-time" v-model="startTime" type="time" />
        </div>

        <div class="form-group">
          <label for="end-time">{{ timeMode === 'arrival' ? 'Arrive until:' : 'Until:' }}</label>
          <input id="end-time" v-model="endTime" type="time" />
        </div>
      </div>

      <!-- Time mode toggle -->
      <div class="time-mode-toggle">
        <label class="toggle-label">⏰ What do you want to analyze?</label>
        <div class="toggle-buttons">
          <button 
            @click="timeMode = 'departure'"
            :class="['toggle-btn', { active: timeMode === 'departure' }]"
          >
            🚗 Departure
          </button>
          <button 
            @click="timeMode = 'arrival'"
            :class="['toggle-btn', { active: timeMode === 'arrival' }]"
          >
            🏁 Arrival
          </button>
        </div>
        <p class="toggle-description">
          {{ timeMode === 'departure' 
            ? '⏱️ Find the best time to leave (shortest travel time)' 
            : '⏱️ Find the best departure time to arrive within this range (shortest travel time)' 
          }}
        </p>
      </div>

      <button @click="analyzeTravelTimes" :disabled="isLoading" class="analyze-btn">
        {{ isLoading ? currentLoadingMessage : '🚀 Beat the traffic!' }}
      </button>
      
      <!-- Test buttons -->
      <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
        <button @click="testNotification" class="test-notification-btn" title="Test if notifications work">
          🔔 Test notification
        </button>
        <button @click="showInstallPrompt = !showInstallPrompt" class="test-notification-btn" title="Show/hide PWA install banner">
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
        <h3>⏰ Active Alarms</h3>
        <p class="modal-subtitle">Manage your traffic alarms</p>
        
        <div v-if="savedAlarms.length === 0" class="no-alarms">
          <span class="no-alarms-icon">🔔</span>
          <p>No active alarms</p>
          <small>Set an alarm after a traffic analysis</small>
        </div>
        
        <div v-else class="alarms-list">
          <div v-for="(alarm, index) in savedAlarms" :key="index" class="alarm-item">
            <div class="alarm-info">
              <div class="alarm-time">⏰ {{ alarm.time }}</div>
              <div class="alarm-route">📍 {{ alarm.from.split(',')[0] }} → {{ alarm.to.split(',')[0] }}</div>
              <div class="alarm-meta">
                <span class="alarm-day">📅 {{ alarm.day.charAt(0).toUpperCase() + alarm.day.slice(1) }}</span>
                <span class="alarm-repeat">
                  {{ alarm.repeat === 'once' ? '🔔 Once' : 
                     alarm.repeat === 'daily' ? '📅 Daily' : 
                     alarm.repeat === 'weekly' ? '🔄 Weekly' : '💼 Weekdays' }}
                </span>
              </div>
            </div>
            <button @click="removeAlarm(index)" class="remove-alarm-btn" title="Remove alarm">
              🗑️
            </button>
          </div>
        </div>
        
        <div class="alarm-manager-actions">
          <button v-if="savedAlarms.length > 0" @click="clearAllAlarms" class="clear-all-btn">
            🗑️ Remove all alarms
          </button>
          <button @click="showAlarmManager = false" class="modal-close-btn">
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Alarm selector dialog -->
    <div v-if="showAlarmSelector" class="modal-overlay" @click="showAlarmSelector = false">
      <div class="modal-content" @click.stop>
        <h3>⏰ Select alarm time</h3>
        <p class="modal-subtitle">Choose the time for which you want to set an alarm:</p>
        
        <!-- Repeat options -->
        <div class="repeat-options">
          <label class="repeat-label">Repeat:</label>
          <div class="repeat-buttons">
            <button 
              @click="alarmRepeat = 'once'"
              class="repeat-btn"
              :class="{ active: alarmRepeat === 'once' }"
            >
              🔔 Once
            </button>
            <button 
              @click="alarmRepeat = 'daily'"
              class="repeat-btn"
              :class="{ active: alarmRepeat === 'daily' }"
            >
              📅 Daily
            </button>
            <button 
              @click="alarmRepeat = 'weekly'"
              class="repeat-btn"
              :class="{ active: alarmRepeat === 'weekly' }"
            >
              🔄 Weekly ({{ selectedDay }})
            </button>
            <button 
              @click="alarmRepeat = 'weekdays'"
              class="repeat-btn"
              :class="{ active: alarmRepeat === 'weekdays' }"
            >
              💼 Weekdays (Mon-Fri)
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
            <span v-if="bestTimes.includes(time.time)" class="best-badge">✨ Best time</span>
          </button>
        </div>
        <button @click="showAlarmSelector = false" class="modal-close-btn">Cancel</button>
      </div>
    </div>

    <!-- Alarm set notification -->
    <div v-if="showAlarmSet" class="alarm-notification">
      ⏰ Alarm set for {{ alarmTime }}!
      <span v-if="alarmRepeat !== 'once'" class="repeat-indicator">
        {{ alarmRepeat === 'daily' ? '(daily)' : alarmRepeat === 'weekly' ? '(weekly)' : '(weekdays)' }}
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
      <h2>❌ Error</h2>
      <p>{{ errorMessage }}</p>
      <p class="error-help">See <a href="./GOOGLE_MAPS_SETUP.md" target="_blank">GOOGLE_MAPS_SETUP.md</a> for setup instructions.</p>
    </div>

    <div v-if="!isLoading && !hasError && travelTimes.length > 0" class="results">
      <div class="best-times">
        <h2>{{ timeMode === 'departure' ? '🎯 Best Departure Time' : '🏁 Best Departure Time' }}</h2>
        <p class="route-info">
          {{ fromLocation.split(',')[0] }} → {{ toLocation.split(',')[0] }}
        </p>
        <div class="time-badges">
          <span v-for="time in bestTimes" :key="time" class="time-badge">
            {{ time }}
          </span>
        </div>
        <p class="min-duration">
          ⚡ {{ timeMode === 'departure' ? 'Shortest travel time' : 'Shortest travel time' }}: {{ Math.min(...travelTimes.map((t) => t.duration)) }} minutes
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
          <span class="scroll-text">📊 View the chart below</span>
          <span class="scroll-arrow">↓</span>
        </div>
      </div>

      <div class="chart-container">
        <div>
          <Line :data="chartData" :options="chartOptions" />
        </div>
      </div>

      <!-- Journey Time Matrix -->
      <div class="matrix-container">
        <div class="matrix-header">
          <h3>📊 Travel Time Visualization</h3>
          <p class="matrix-description">
            Each bar shows the journey from departure time (left) to arrival time (right). 
            Longer bars = longer travel time.
          </p>
        </div>
        <div class="matrix-content">
          <div class="matrix-y-axis">
            <div class="axis-label-y">Departure time</div>
            <div class="matrix-y-labels">
              <div v-for="item in travelTimes" :key="item.time" class="matrix-y-label">
                {{ item.time }}
              </div>
            </div>
          </div>
          <div class="matrix-chart-area">
            <div class="matrix-x-axis">
              <div 
                v-for="label in matrixTimeLabels" 
                :key="label" 
                class="matrix-x-label"
              >
                {{ label }}
              </div>
            </div>
            <div class="matrix-bars">
              <div v-for="row in matrixData" :key="row.departureTime" class="matrix-row">
                <div 
                  class="matrix-bar"
                  :style="{
                    left: `${row.startPercent}%`,
                    width: `${row.widthPercent}%`,
                    background: `linear-gradient(90deg, ${row.color} 0%, ${row.color}dd 100%)`
                  }"
                  :title="`${row.departureTime} → ${row.arrivalTime} (${row.duration} min)`"
                >
                  <span class="bar-label">{{ row.duration }} min</span>
                  <div class="bar-glow" :style="{ background: row.color }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="matrix-x-axis-label">Arrival time</div>
        <div class="matrix-legend">
          <div class="legend-item">
            <div class="legend-color" style="background: #42b983"></div>
            <span>Fastest time</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: #ffa500"></div>
            <span>Average</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: #ff6b6b"></div>
            <span>Slowest time</span>
          </div>
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

/* Time mode toggle */
.time-mode-toggle {
  margin: 1.5rem 0;
  padding: 1rem;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
  border-radius: 12px;
  border: 2px solid #dde2e8;
}

.toggle-label {
  display: block;
  margin-bottom: 0.75rem;
  font-weight: 700;
  color: #333;
  font-size: 1rem;
}

.toggle-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.toggle-btn {
  background: white;
  border: 2px solid #dde2e8;
  border-radius: 10px;
  padding: 0.9rem 1rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  color: #555;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.toggle-btn:hover {
  border-color: #42b983;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(66, 185, 131, 0.2);
}

.toggle-btn.active {
  background: linear-gradient(135deg, #42b983 0%, #35956f 100%);
  color: white;
  border-color: #42b983;
  box-shadow: 0 4px 12px rgba(66, 185, 131, 0.3);
}

.toggle-description {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
  text-align: center;
  font-style: italic;
  padding-top: 0.5rem;
  border-top: 1px solid #dde2e8;
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
  color: #42b983;
  padding: 0.6rem 1.2rem;
  border-radius: 25px;
  font-size: 1.4rem;
  font-weight: 900;
  box-shadow: 0 4px 15px rgba(66, 185, 131, 0.3);
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

/* Journey Time Matrix Styles */
.matrix-container {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  margin-top: 2rem;
  animation: fadeIn 0.5s 0.2s backwards;
}

.matrix-header {
  text-align: center;
  margin-bottom: 2rem;
}

.matrix-header h3 {
  margin: 0 0 0.5rem 0;
  color: #ff6b6b;
  font-size: 1.5rem;
  font-weight: 700;
}

.matrix-description {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
  line-height: 1.5;
}

.matrix-content {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.matrix-y-axis {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 2.5rem;
}

.axis-label-y {
  font-size: 0.85rem;
  font-weight: 700;
  color: #ff6b6b;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
  margin-right: 0.5rem;
  text-align: center;
  letter-spacing: 2px;
}

.matrix-y-labels {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.matrix-y-label {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #333;
  background: linear-gradient(90deg, transparent 0%, #f8f8f8 100%);
  border-radius: 8px 0 0 8px;
}

.matrix-chart-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.matrix-x-axis {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  padding: 0 0.5rem;
  height: 2rem;
  position: relative;
}

.matrix-x-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #666;
  transform: rotate(-45deg);
  transform-origin: left center;
  white-space: nowrap;
  position: absolute;
}

.matrix-x-label:first-child {
  left: 0;
}

.matrix-x-label:last-child {
  right: 0;
  left: auto;
  transform-origin: right center;
}

.matrix-bars {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
  background: linear-gradient(90deg, #f9f9f9 0%, #ffffff 50%, #f9f9f9 100%);
  border-radius: 12px;
  padding: 0.5rem;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.05);
}

.matrix-row {
  height: 50px;
  position: relative;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.matrix-bar {
  position: absolute;
  height: 100%;
  top: 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  cursor: pointer;
  border: 2px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  position: relative;
}

.matrix-bar:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  z-index: 10;
  border-color: rgba(255, 255, 255, 0.8);
}

.bar-label {
  position: relative;
  z-index: 2;
  color: white;
  font-weight: 700;
  font-size: 0.85rem;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  padding: 0 0.5rem;
}

.bar-glow {
  position: absolute;
  top: 0;
  left: -50%;
  width: 50%;
  height: 100%;
  opacity: 0.3;
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0%, 100% {
    left: -50%;
  }
  50% {
    left: 150%;
  }
}

.matrix-x-axis-label {
  text-align: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: #ff6b6b;
  margin-top: 1rem;
  letter-spacing: 2px;
}

.matrix-legend {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 2px solid #f0f0f0;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-color {
  width: 32px;
  height: 16px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.legend-item span {
  font-size: 0.9rem;
  color: #666;
  font-weight: 600;
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

  .time-mode-toggle {
    margin: 1rem 0;
  }

  .toggle-buttons {
    gap: 0.5rem;
  }

  .toggle-btn {
    padding: 0.7rem 0.5rem;
    font-size: 0.85rem;
  }

  .toggle-description {
    font-size: 0.75rem;
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
  
  .matrix-container {
    padding: 1rem;
  }
  
  .matrix-content {
    gap: 0.5rem;
  }
  
  .matrix-y-label {
    font-size: 0.8rem;
    height: 40px;
  }
  
  .matrix-row {
    height: 40px;
  }
  
  .bar-label {
    font-size: 0.75rem;
  }
  
  .matrix-legend {
    gap: 1rem;
  }
  
  .axis-label-y {
    font-size: 0.75rem;
  }
}
</style>
