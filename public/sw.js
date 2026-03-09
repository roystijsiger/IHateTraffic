// Custom Service Worker for Notification Scheduling
// This handles scheduled push notifications even when the app is closed

const CACHE_NAME = 'traffic-app-v1';
const urlsToCache = [
  '/IHateTraffic/',
  '/IHateTraffic/index.html'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/IHateTraffic/')
  );
});

// Listen for messages from the app to schedule notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { time, title, body, tag, scheduledTime } = event.data;
    
    // Check if Notification Triggers API is supported
    if ('showTrigger' in Notification.prototype) {
      // Use Notification Triggers API (Chrome 83+)
      console.log('Using Notification Triggers API for scheduling');
      
      self.registration.showNotification(title, {
        body: body,
        icon: '/IHateTraffic/icon-192x192.png',
        badge: '/IHateTraffic/icon-192x192.png',
        tag: tag,
        requireInteraction: true,
        showTrigger: new TimestampTrigger(scheduledTime)
      }).then(() => {
        console.log('Notification scheduled for:', new Date(scheduledTime));
      }).catch((error) => {
        console.error('Failed to schedule notification:', error);
      });
    } else {
      console.log('Notification Triggers API not supported, notification sent to app for setTimeout fallback');
      // Send message back to app to use setTimeout fallback
      event.ports[0].postMessage({ 
        success: false, 
        reason: 'Notification Triggers API not supported' 
      });
    }
  }
  
  if (event.data && event.data.type === 'CANCEL_NOTIFICATION') {
    const { tag } = event.data;
    
    // Get all notifications and close matching ones
    self.registration.getNotifications({ tag: tag }).then((notifications) => {
      notifications.forEach((notification) => notification.close());
      console.log(`Cancelled notification with tag: ${tag}`);
    });
  }
  
  if (event.data && event.data.type === 'GET_SCHEDULED_NOTIFICATIONS') {
    // Return all scheduled notifications
    self.registration.getNotifications().then((notifications) => {
      const scheduled = notifications.map(n => ({
        tag: n.tag,
        title: n.title,
        body: n.body
      }));
      
      event.ports[0].postMessage({ 
        notifications: scheduled 
      });
    });
  }
});

// Background sync for reliability
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-alarms') {
    console.log('Background sync: checking alarms');
    // Could be used to sync alarm data with server in future
  }
});

console.log('Service Worker loaded and ready for notification scheduling! 🚀');
