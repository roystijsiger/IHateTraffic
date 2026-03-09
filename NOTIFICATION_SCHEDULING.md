# 🔔 Notification Scheduling Setup - Android Push Notificaties

De app gebruikt nu de **Notification Triggers API** voor native scheduled push notifications op Android!

## ✅ Wat werkt:

### Android (Chrome/Edge PWA):
- ✅ Push notificaties ook als app **volledig gesloten** is
- ✅ Werkt na telefoon **herstart**
- ✅ **Geen server** nodig!
- ✅ **Gratis** - alles lokaal
- ✅ Battery efficient - browser handelt scheduling af

### Desktop (Chrome/Edge):
- ✅ Notificaties werken perfect
- ✅ Ook als browser geminimaliseerd is

### iOS:
- ❌ Niet ondersteund (Apple policy)
- ⚠️ Fallback: Werkt als app open is

## 🚀 Hoe het werkt:

### De Technologie:

```
[Gebruiker stelt alarm in]
        ↓
[App vraagt Service Worker]
        ↓
[Service Worker gebruikt Notification Triggers API]
        ↓
[Browser scheduler] ← OS-level scheduling!
        ↓
[Notificatie op juiste tijd] 🔔
```

**Belangrijk**: De browser zelf houdt de schedule bij, niet je app! Daarom werkt het zelfs als app gesloten is.

## 📱 Browser Support:

| Browser | Versie | Scheduled Notifications |
|---------|--------|------------------------|
| Chrome Android | 83+ | ✅ Volledig |
| Edge Android | 83+ | ✅ Volledig |
| Samsung Internet | 14+ | ✅ Volledig |
| Firefox Android | - | ❌ Nog niet |
| Safari iOS | - | ❌ Apple blokkeert |
| Chrome Desktop | 83+ | ✅ Volledig |
| Edge Desktop | 83+ | ✅ Volledig |

## 🧪 Testen:

### 1. Op Android telefoon:

```bash
# 1. Push naar GitHub
git add .
git commit -m "Add notification scheduling"
git push

# 2. Open op telefoon in Chrome:
https://[jouw-username].github.io/IHateTraffic/

# 3. Installeer de app (paarse banner)

# 4. Stel een alarm in voor over 2 minuten

# 5. SLUIT de app VOLLEDIG (swipe weg uit recents)

# 6. Wacht... 🕐

# 7. BOOM! 🔔 Notificatie verschijnt!
```

### 2. Check of het werkt:

Open Chrome DevTools op je telefoon:
1. Ga naar `chrome://inspect` op desktop Chrome
2. Connect je telefoon via USB
3. Open DevTools voor je app
4. Check Console voor logs:
   ```
   ✅ "Using Notification Triggers API for scheduling"
   ✅ "Notification scheduled for: [datum/tijd]"
   ```

### 3. Fallback test:

Als Notification Triggers API niet ondersteund wordt:
- App gebruikt setTimeout() fallback
- Werkt als app op achtergrond is
- Console toont: "Using setTimeout fallback"

## 💾 Data Opslag:

### LocalStorage:
```javascript
savedAlarms: [
  {
    time: "07:15",
    repeat: "daily",
    from: "Home",
    to: "Work",
    day: "maandag",
    createdAt: 1234567890
  }
]
```

### Service Worker:
- Scheduled notifications worden bijgehouden door browser
- Blijven actief na app sluiten
- Worden automatisch uitgevoerd door OS

## 🔧 Troubleshooting:

### "Notification Triggers API not supported"
**Oplossing**: 
- Update Chrome naar versie 83+
- Check: `chrome://flags/#enable-experimental-web-platform-features`
- Enable de flag en herstart browser

### Notificaties komen niet door
**Check**:
1. Is app geïnstalleerd als PWA? (niet alleen favoriet!)
2. Zijn notificaties toegestaan in browser settings?
3. Is "Batterij optimalisatie" uitgeschakeld voor Chrome?
4. Check Android "Do Not Disturb" mode

### App blijft in achtergrond maar notificatie komt niet
**Oplossing**:
- Sluit app VOLLEDIG (swipe weg uit recents)
- Service Worker moet de scheduling overnemen

### Console errors
```javascript
// Check of API beschikbaar is:
console.log('showTrigger' in Notification.prototype)
// Moet 'true' zijn op Chrome 83+

// Check service worker:
navigator.serviceWorker.ready.then(reg => {
  console.log('SW ready:', reg.active.state)
})
```

## 📊 Monitoring:

### Check scheduled notifications:

```javascript
// In console:
navigator.serviceWorker.ready.then(async (registration) => {
  const notifications = await registration.getNotifications()
  console.log('Scheduled notifications:', notifications)
})
```

### Cancel all scheduled:

```javascript
navigator.serviceWorker.ready.then(async (registration) => {
  const notifications = await registration.getNotifications()
  notifications.forEach(n => n.close())
  console.log('Cancelled all')
})
```

## 🎯 Features:

### ✅ Wat we hebben:
- Scheduled push zonder server
- Werkt bij gesloten app (Android)
- Alarm management UI
- Herhaling opties (eenmalig, dagelijks, wekelijks, werkdagen)
- LocalStorage persistence
- Fallback voor niet-ondersteunde browsers

### 🔜 Toekomstige verbeteringen (optioneel):
- Firebase Cloud Functions (voor iOS support)
- Firestore sync (alarm sync tussen devices)
- Notification action buttons (snooze, cancel)
- Rich notifications (afbeeldingen, route info)

## 🚨 Belangrijke Opmerkingen:

### Android Battery Optimization:
Moderne Android versies kunnen apps "doden" om batterij te besparen. 

**Voor 100% betrouwbaarheid**:
1. Ga naar Android Settings
2. Apps → Chrome/Edge
3. Battery → Unrestricted
4. Dit zorgt dat Service Worker altijd draait

### Data/WiFi:
- Service Worker werkt offline
- Notificaties worden lokaal getriggered
- Geen internet nodig voor alarm

### Privacy:
- Geen data naar server
- Alles lokaal
- Geen tracking

## 🎉 Resultaat:

Je hebt nu een **native-achtige** alarm app die:
- ⏰ Werkt op de achtergrond
- 📱 Push notifications stuurt als telefoon vergrendeld is
- 🔋 Battery efficient is (OS-level scheduling)
- 💰 Gratis is (geen server kosten)
- 🔒 Privacy-vriendelijk is (geen data naar server)

Alles wat een native Android alarm app doet, maar dan als PWA! 🚀

## 📞 Support:

Voor vragen of problemen:
1. Check browser console voor errors
2. Verifieer Chrome versie (83+)
3. Check notification permissions
4. Test met kortere alarm tijd (2 minuten) eerst

**Android only** - iOS gebruikers moeten helaas een native app gebruiken of de web app open houden. 🤷‍♂️
