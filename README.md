# 🚗 Traffic Analysis App

Een Vue 3 applicatie om de beste vertrektijd te vinden op basis van verwachte reistijden en verkeersdrukte.

## ✨ Features

- **Dag & tijd selectie**: Kies een dag en tijdsbereik (bijv. maandag 07:00 - 09:00)
- **5-minuten intervallen**: Analyseert reistijden om de 5 minuten binnen het gekozen tijdsbereik
- **Visuele grafiek**: Toont een overzichtelijke lijn-grafiek van reistijden
- **Beste vertrektijd**: Markeert automatisch de optimale vertrektijd(en) met de kortste reistijd

## 🛠️ Tech Stack

- **Vue 3** met Composition API
- **TypeScript** voor type-safe development
- **Chart.js** + **Vue-ChartJS** voor grafieken
- **Vite** voor snelle development
- **Pinia** voor state management

## 🚀 Quick Start

### Project Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Development Server

```sh
npm run dev
```

De app is beschikbaar op [http://localhost:5173](http://localhost:5173)

### Build voor Productie

```sh
npm run build
```

## 📝 Gebruik

1. Selecteer een dag van de week
2. Kies een begin- en eindtijd (bijv. 07:00 - 09:00)
3. Klik op "Wanneer is er het minste file?"
4. De app analyseert om de 5 minuten de verwachte reistijd
5. Bekijk de grafiek en de beste vertrektijd(en)

## 🔧 API Integratie

Momenteel gebruikt de app gesimuleerde data voor demo-doeleinden. Om echte verkeersinformatie te gebruiken:

1. Open `src/components/TrafficAnalyzer.vue`
2. Zoek de functie `fetchTravelTime`
3. Vervang de simulatie met een echte API call

### Aanbevolen APIs

- [Google Maps Distance Matrix API](https://developers.google.com/maps/documentation/distance-matrix)
- [TomTom Traffic API](https://developer.tomtom.com/traffic-api)
- [HERE Traffic API](https://developer.here.com/documentation/traffic-api)

## 📁 Project Structuur

```
traffic-app/
├── src/
│   ├── components/
│   │   └── TrafficAnalyzer.vue   # Hoofdcomponent met alle functionaliteit
│   ├── assets/                    # Styling en afbeeldingen
│   ├── App.vue                    # Root component
│   └── main.ts                    # Entry point
├── package.json
└── README.md
```

## 🎨 Aanpassingen

### Tijdsinterval wijzigen

Om het interval te wijzigen van 5 minuten naar een andere waarde, pas de `generateTimeSlots` functie aan in `TrafficAnalyzer.vue`.

### Kleuren aanpassen

De primaire kleur is `#42b983`. Deze kun je aanpassen in de CSS van `TrafficAnalyzer.vue`.

---

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
