# PWA Setup - Push Notificaties op Vergrendelde Telefoon 📱

De app is nu een **Progressive Web App (PWA)**! Dit betekent dat je push notificaties krijgt op je telefoon, **zelfs als de app gesloten of je telefoon vergrendeld is**.

## ✅ Wat werkt nu:

1. **Installeerbare app** - Installeer op je home screen
2. **Offline support** - Basis functionaliteit werkt zonder internet
3. **Push notificaties** - Ook bij vergrendelde telefoon (na installatie)
4. **Google Maps caching** - Snellere load times

## 📱 Hoe te installeren:

### Op Android (Chrome):

1. **Open** de site in Chrome: `https://[jouw-username].github.io/IHateTraffic/`
2. **Klik** op de paarse banner bovenaan "Installeren"
   - Of: Menu (⋮) → "App installeren" / "Toevoegen aan startscherm"
3. **Accepteer** de installatie
4. **App verschijnt** op je home screen! 🎉
5. **Open de app** vanaf home screen
6. **Sta notificaties toe** wanneer gevraagd

### Op iPhone (Safari):

1. **Open** de site in Safari
2. **Tap** op "Delen" knop (📤)
3. **Scroll** naar beneden
4. **Tap** "Zet op beginscherm"
5. **Tap** "Voeg toe"
6. **App verschijnt** op je home screen! 🎉

⚠️ **Let op**: iOS ondersteunt (nog) geen echte push notificaties voor PWAs. Je moet de app open hebben voor notificaties.

### Op Desktop (Chrome/Edge):

1. **Klik** op install icoon in adresbalk (⊕)
   - Of: Menu → "App installeren"
2. **App opent** in eigen venster
3. Voeg toe aan taskbar voor snelle toegang

## 🔔 Push Notificaties Testen:

1. **Installeer** de app (zie boven)
2. **Open** de app vanaf home screen
3. **Klik** op "🔔 Test notificatie" knop
4. **Accepteer** notificatie permissie
5. **Zie** test notificatie verschijnen!
6. **Stel** een alarm in
7. **Sluit** de app of vergrendel je telefoon
8. Op de **alarm tijd** krijg je een notificatie! ⏰

## 🚀 Nieuwe Features:

### 1. Install Banner
- Paarse banner bovenaan wanneer app installeerbaar is
- Eén klik installatie
- Verdwijnt automatisch na installatie

### 2. Offline Support
- Google Maps responses worden gecached
- App blijft werken zonder internet (met gecachede data)

### 3. App Icon
- Mooi verkeer icoon 🚦 op je home screen
- Splash screen bij openen

### 4. Standalone Mode
- Geen browser UI - voelt als native app
- Eigen app window op desktop

## 🔧 Voor Ontwikkelaars:

### PWA Configuratie:
- ✅ `manifest.json` - App metadata
- ✅ `vite-plugin-pwa` - Automatische service worker
- ✅ Workbox - Caching strategies
- ✅ Meta tags - iOS en Android support

### Service Worker:
- Auto-updates bij nieuwe versie
- Google Maps API caching (1 week)
- Offline fallback

### Bestanden:
```
public/
  ├── manifest.json          # PWA manifest
  ├── icon-192x192.svg       # App icon klein
  ├── icon-512x512.svg       # App icon groot
  └── firebase-messaging-sw.js  # Firebase push notifications

vite.config.ts               # PWA plugin configuratie
index.html                   # PWA meta tags
```

## 📊 Browser Support:

| Browser | Installeerbaar | Push Notifications | Offline |
|---------|---------------|-------------------|---------|
| Chrome Android | ✅ | ✅ | ✅ |
| Firefox Android | ✅ | ✅ | ✅ |
| Samsung Internet | ✅ | ✅ | ✅ |
| Safari iOS | ✅ | ⚠️ App moet open zijn | ✅ |
| Chrome Desktop | ✅ | ✅ | ✅ |
| Edge Desktop | ✅ | ✅ | ✅ |

## 🐛 Troubleshooting:

### Install button niet zichtbaar?
- Zorg dat je HTTPS gebruikt (GitHub Pages is OK)
- Herlaad de pagina
- Check browser console voor errors

### Notificaties werken niet?
1. Check browser instellingen → Site instellingen → Notificaties
2. Zorg dat je de app hebt **geïnstalleerd** (niet alleen favoriet!)
3. Test met "🔔 Test notificatie" knop
4. Check dat alarm correct is ingesteld in Alarm Manager

### App installeert niet?
- iOS: Gebruik Safari (niet Chrome!)
- Android: Gebruik Chrome, Firefox of Samsung Internet
- Desktop: Chrome of Edge werken het best

### Push notificaties komen niet door op iOS?
- iOS ondersteunt (nog) geen achtergrond push voor PWAs
- Je moet de app open hebben
- Overweeg native app voor iOS push support

## 🎯 Next Steps (Optioneel):

### Voor echte cloud push notificaties:
1. Voeg VAPID key toe (zie `FIREBASE_SETUP.md`)
2. Setup Firebase Cloud Messaging backend
3. Stuur notificaties vanaf server

### Voor betere icons:
1. Vervang `icon-192x192.svg` en `icon-512x512.svg`
2. Gebruik PNG formaat voor betere compatibiliteit
3. Gebruik tools zoals [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)

## 📝 Deployment Checklist:

- [x] PWA manifest toegevoegd
- [x] Service worker geconfigureerd
- [x] Meta tags voor iOS en Android
- [x] Install prompt UI
- [x] Icons toegevoegd (placeholder)
- [x] Offline caching
- [ ] VAPID key configureren (optioneel)
- [ ] Echte app icons (vervang SVG placeholders)
- [ ] Screenshots voor app stores

## 🎉 Klaar!

Je app is nu een volwaardige PWA! Installeer hem op je telefoon en test de push notificaties. Je krijgt nu alarm notificaties zelfs als je telefoon vergrendeld is! 

Voor vragen of problemen, check de console logs of zie `FIREBASE_SETUP.md` voor extra configuratie.
