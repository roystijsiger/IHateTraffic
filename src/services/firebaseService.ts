import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const analytics = getAnalytics(app)

let messaging: Messaging | null = null

// Initialize messaging only if supported
if ('serviceWorker' in navigator && 'PushManager' in window) {
  try {
    messaging = getMessaging(app)
  } catch (error) {
    console.error('Firebase messaging not supported:', error)
  }
}

export { app, analytics, messaging }

export async function requestNotificationPermission(): Promise<string | null> {
  if (!messaging) {
    console.error('Messaging not supported')
    return null
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      console.log('Notification permission granted.')
      
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY' // Je moet dit nog toevoegen in Firebase Console
      })
      
      if (token) {
        console.log('FCM Token:', token)
        return token
      } else {
        console.log('No registration token available.')
        return null
      }
    } else {
      console.log('Unable to get permission to notify.')
      return null
    }
  } catch (error) {
    console.error('An error occurred while retrieving token:', error)
    return null
  }
}

export function onMessageListener(): Promise<any> {
  if (!messaging) {
    return Promise.reject('Messaging not supported')
  }
  
  return new Promise((resolve) => {
    onMessage(messaging!, (payload) => {
      console.log('Message received:', payload)
      resolve(payload)
    })
  })
}

export async function scheduleAlarmNotification(
  time: string, 
  repeat: 'once' | 'daily' | 'weekly' | 'weekdays' = 'once',
  from: string = '',
  to: string = ''
): Promise<void> {
  // Parse tijd
  const [hours, minutes] = time.split(':').map(Number)
  const now = new Date()
  const alarmDate = new Date()
  alarmDate.setHours(hours || 0, minutes || 0, 0, 0)
  
  if (alarmDate < now) {
    alarmDate.setDate(alarmDate.getDate() + 1)
  }
  
  // Check notification permission
  if (Notification.permission !== 'granted') {
    console.error('Notification permission not granted')
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    
    // Check of Notification Triggers API beschikbaar is (Android Chrome 83+)
    if ('showTrigger' in Notification.prototype) {
      console.log('✅ Using Notification Triggers API for scheduling')
      
      // Schedule via Service Worker met trigger
      await registration.showNotification('⏰ Time to leave!', {
        body: `Beat the traffic! Vertrek nu van ${from.split(',')[0] || 'je locatie'} naar ${to.split(',')[0] || 'bestemming'}.`,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: `traffic-alarm-${time}`,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        showTrigger: new (window as any).TimestampTrigger(alarmDate.getTime())
      } as any)
      
      console.log(`✅ Notification scheduled for: ${alarmDate.toLocaleString()}`)
      
    } else {
      // Fallback voor desktop/iOS: setTimeout (werkt alleen als app open is)
      console.warn('⚠️ Using setTimeout fallback - only works if app is open')
      
      const msUntilAlarm = alarmDate.getTime() - now.getTime()
      
      setTimeout(() => {
        new Notification('⏰ Time to leave!', {
          body: `Beat the traffic! Vertrek nu van ${from.split(',')[0] || 'je locatie'} naar ${to.split(',')[0] || 'bestemming'}.`,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: `traffic-alarm-${time}`,
          requireInteraction: true
        })
      }, msUntilAlarm)
    }
  } catch (error) {
    console.error('Failed to schedule notification:', error)
  }
}
