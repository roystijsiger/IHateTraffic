# Firebase Push Notifications Setup

Deze app gebruikt Firebase Cloud Messaging (FCM) voor push notificaties wanneer je een alarm instelt voor je optimale vertrek tijd.

## Wat werkt al

✅ Firebase is geïnstalleerd en geconfigureerd
✅ Service worker voor achtergrond notificaties
✅ Notificatie permissie wordt automatisch gevraagd bij alarm instellen
✅ Lokale browser notificaties werken

## Wat je nog moet doen

### 1. VAPID Key toevoegen

Om push notificaties te laten werken, heb je een VAPID key nodig:

1. Ga naar [Firebase Console](https://console.firebase.google.com/)
2. Selecteer je project: `ihatetrafficjams-4c8e3`
3. Ga naar Project Settings (tandwiel icoon) → Cloud Messaging
4. Scroll naar "Web configuration"
5. Klik op "Generate key pair" bij "Web Push certificates"
6. Kopieer de VAPID key
7. Voeg deze toe in `src/services/firebaseService.ts`:

```typescript
const token = await getToken(messaging, {
  vapidKey: 'JE_VAPID_KEY_HIER' // Vervang deze regel
})
```

### 2. Service Worker registreren

De service worker is al gemaakt in `public/firebase-messaging-sw.js`, maar moet geregistreerd worden.

Voeg dit toe aan `index.html` voor de body sluit tag:

```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  }
</script>
```

### 3. Test de notificaties

1. Open de app in je browser
2. Voer een route in en analyseer het verkeer
3. Klik op "🔔 Set Alarm"
4. Selecteer een tijd
5. Accepteer de notificatie permissie als gevraagd
6. De FCM token wordt in de console gelogd

### 4. Server-side notificaties (Optioneel)

Als je notificaties vanaf een server wilt versturen:

1. Haal de FCM token op (wordt gelogd in console)
2. Gebruik Firebase Admin SDK op je backend
3. Verstuur notificaties met de token

Voorbeeld met Firebase Admin SDK:

```javascript
const message = {
  notification: {
    title: '⏰ Time to leave!',
    body: 'Beat the traffic! Your optimal departure time is now.'
  },
  token: userFcmToken
};

admin.messaging().send(message);
```

## Huidige functionaliteit

- ✅ **Browser notificaties**: Lokale notificaties op het ingestelde tijdstip
- ✅ **Permissie verzoek**: Automatisch bij eerste alarm
- ✅ **Service worker**: Achtergrond notificaties wanneer tab gesloten is
- 🔜 **Cloud notificaties**: Na VAPID key configuratie

## Troubleshooting

### Notificaties werken niet
- Controleer of je HTTPS gebruikt (vereist voor service workers)
- Check browser console voor errors
- Verifieer dat notificaties toegestaan zijn in browser instellingen

### Service worker registreert niet
- Controleer of het bestand bestaat: `public/firebase-messaging-sw.js`
- Check in DevTools → Application → Service Workers

### VAPID key error
- Zorg dat je de key hebt toegevoegd in `firebaseService.ts`
- Verifieer dat de key correct is gekopieerd (geen spaties)

## Meer informatie

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging/js/client)
- [Web Push Protocol](https://developers.google.com/web/fundamentals/push-notifications)
