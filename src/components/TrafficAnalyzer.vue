<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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

const days = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']

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
onMounted(async () => {
  try {
    await loadGoogleMapsAPI()
    
    const fromInput = document.getElementById('from-location') as HTMLInputElement
    const toInput = document.getElementById('to-location') as HTMLInputElement

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
    }
  } catch (error) {
    console.error('Failed to load Google Maps:', error)
  }
})

// Generate time slots every 5 minutes between start and end time
const generateTimeSlots = (start: string, end: string): string[] => {
  const slots: string[] = []
  const startParts = start.split(':').map(Number)
  const endParts = end.split(':').map(Number)
  
  let currentHour = startParts[0] || 0
  let currentMin = startParts[0] || 0
  const endHour = endParts[0] || 23
  const endMin = endParts[1] || 59

  while (currentHour < endHour || (currentHour === endHour && currentMin <= endMin)) {
    slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`)
    currentMin += 5
    if (currentMin >= 60) {
      currentMin = 0
      currentHour += 1
    }
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
    }
  } catch (error: any) {
    hasError.value = true
    errorMessage.value = error.message || 'Kan geen verkeersinformatie ophalen. Check je API key in GOOGLE_MAPS_SETUP.md'
    console.error('Error fetching travel times:', error)
  } finally {
    isLoading.value = false
  }
}

// Chart data
const chartData = computed(() => ({
  labels: travelTimes.value.map((t) => t.time),
  datasets: [
    {
      label: 'Travel Time (minutes)',
      data: travelTimes.value.map((t) => t.duration),
      borderColor: '#ff6b6b',
      backgroundColor: 'rgba(255, 107, 107, 0.1)',
      tension: 0.4,
      pointRadius: 5,
      pointHoverRadius: 8,
      borderWidth: 3
    }
  ]
}))

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
    <div class="header-section">
      <h1>🚦 I Hate Traffic Jams</h1>
      <p class="tagline">Stop wasting time in traffic. Find your perfect departure time!</p>
    </div>

    <div class="form-container">
      <div class="form-group location-group">
        <label for="from-location">Van (locatie):</label>
        <input
          id="from-location"
          v-model="fromLocation"
          type="text"
          placeholder="bijv. Amsterdam Centraal"
        />
      </div>

      <div class="form-group location-group">
        <label for="to-location">Naar (locatie):</label>
        <input
          id="to-location"
          v-model="toLocation"
          type="text"
          placeholder="bijv. Rotterdam Centraal"
        />
      </div>

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

      <button @click="analyzeTravelTimes" :disabled="isLoading" class="analyze-btn">
        {{ isLoading ? '🔍 Analyzing traffic...' : '🚀 Beat the traffic!' }}
      </button>
    </div>

    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>Data ophalen...</p>
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
          {{ fromLocation }} → {{ toLocation }}
        </p>
        <div class="time-badges">
          <span v-for="time in bestTimes" :key="time" class="time-badge">
            {{ time }}
          </span>
        </div>
        <p class="min-duration">
          ⚡ Travel time: {{ Math.min(...travelTimes.map((t) => t.duration)) }} minutes
        </p>
      </div>

      <div class="chart-container">
        <Line :data="chartData" :options="chartOptions" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.traffic-analyzer {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header-section {
  text-align: center;
  margin-bottom: 2rem;
  padding: 1rem;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  border-radius: 16px;
  color: white;
  box-shadow: 0 4px 20px rgba(255, 107, 107, 0.3);
}

h1 {
  font-size: 2.8rem;
  color: white;
  margin: 0 0 0.5rem 0;
  font-weight: 900;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.tagline {
  color: rgba(255, 255, 255, 0.95);
  margin: 0;
  font-size: 1.2rem;
  font-weight: 500;
}

.form-container {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  align-items: flex-end;
  margin-bottom: 2rem;
}

.location-group {
  grid-column: span 2;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 600;
  color: #333;
}

select,
input[type='time'],
input[type='text'] {
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s;
  position: relative;
  z-index: 1;
}

select:focus,
input[type='time']:focus,
input[type='text']:focus {
  outline: none;
  border-color: #42b983;
  z-index: 1000;
}

input[type='text']::placeholder {
  color: #999;
}

.analyze-btn {
  padding: 1rem 2.5rem;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
  grid-column: 1 / -1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
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

.loading {
  text-align: center;
  padding: 3rem;
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

.error-message {
  background: #fee;
  border: 2px solid #f88;
  border-radius: 12px;
  padding: 2rem;
  margin: 2rem 0;
  text-align: center;
  animation: fadeIn 0.5s;
}

.error-message h2 {
  color: #c33;
  margin: 0 0 1rem 0;
}

.error-message p {
  color: #666;
  margin: 0.5rem 0;
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
  margin-bottom: 2rem;
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
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.time-badge {
  background: white;
  color: #ff6b6b;
  padding: 0.75rem 1.5rem;
  border-radius: 25px;
  font-size: 1.6rem;
  font-weight: 900;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  border: 3px solid rgba(255, 255, 255, 0.3);
}

.min-duration {
  margin: 0;
  font-size: 1.1rem;
  opacity: 0.95;
}

.chart-container {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: 400px;
}

@media (max-width: 768px) {
  .form-container {
    grid-template-columns: 1fr;
  }

  .location-group {
    grid-column: span 1;
  }

  .analyze-btn {
    width: 100%;
  }
}
</style>
