// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

// Firebase configuration
firebase.initializeApp({
  apiKey: "AIzaSyCJa1IM1Ry8WejSz5_qtNN04sy6wmbH7JM",
  authDomain: "ihatetrafficjams-4c8e3.firebaseapp.com",
  projectId: "ihatetrafficjams-4c8e3",
  storageBucket: "ihatetrafficjams-4c8e3.firebasestorage.app",
  messagingSenderId: "1068393012519",
  appId: "1:1068393012519:web:fe16842890ade9a6315d02",
  measurementId: "G-P6VBV5QW77"
})

const messaging = firebase.messaging()

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload)
  
  const notificationTitle = payload.notification.title || '⏰ Traffic Alert'
  const notificationOptions = {
    body: payload.notification.body || 'Time to beat the traffic!',
    icon: '/icon.png',
    badge: '/badge.png',
    vibrate: [200, 100, 200],
    tag: 'traffic-alarm',
    requireInteraction: true
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})
