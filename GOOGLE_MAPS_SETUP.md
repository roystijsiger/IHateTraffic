# 🔑 Google Maps API Setup + Limiet Beveiliging

## ✅ Voordeel: Limiet werkt over ALLE devices

Je stelt de limiet in bij Google zelf, dus het maakt niet uit hoeveel devices je hebt!

---

## Stap 1: Google Cloud Account

1. Ga naar [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Log in met je Google account (of maak nieuw account)
3. Accepteer de terms
4. ⚠️ **Credit card verplicht** (maar je betaalt niks als je binnen limiet blijft)

---

## Stap 2: Nieuw Project Maken

1. Klik rechtsboven op project dropdown
2. Klik **"New Project"**
3. Naam: bijv. "Traffic Analyzer"
4. Klik **"Create"**

---

## Stap 3: Distance Matrix API Activeren

1. Ga naar [APIs & Services > Library](https://console.cloud.google.com/apis/library)
2. Zoek naar **"Directions API"**
3. Klik op de API
4. Klik **"Enable"**

---

## Stap 4: API Key Maken

1. Ga naar [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
2. Klik **"Create Credentials"** → **"API Key"**
3. Kopieer de API key
4. Klik **"Edit API key"** (potlood icoontje)
5. Onder **"API restrictions"**:
   - Selecteer **"Restrict key"**
   - Vink aan: **"Directions API"**
   - Vink aan: **"Maps JavaScript API"**
   - Vink aan: **"Places API"**
6. Klik **"Save"**

---

## Stap 5: 🛡️ BELANGRIJK: Stel Quota In (Limiet Beveiliging)

### Dit voorkomt dat je OOIT betaalt!

1. Ga naar [APIs & Services > Distance Matrix API](https://console.cloud.google.com/apis/api/distancematrix-backend.googleapis.com/)
2. Klik op **"Quotas & System Limits"** in het menu
3. Zoek naar **"Requests per day"**
4. Klik op het potlood icoontje
5. Stel in: **1,000 requests per dag** (= 30,000 per maand, ver onder de 40k gratis limiet)
6. Klik **"Save"**

### Extra veiligheid: Budget Alert

1. Ga naar [Billing > Budgets & alerts](https://console.cloud.google.com/billing/budgets)
2. Klik **"Create Budget"**
3. Naam: "Traffic App Budget"
4. **Amount**: $5 (je krijgt alert ver voordat je betaalt)
5. Alert op: **50%, 90%, 100%**
6. Vul je email in
7. Klik **"Finish"**

---

## Stap 6: Configureer de App

1. Open `.env` in je project
2. Vervang `your_api_key_here`:

```bash
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...jouw-key-hier
```

3. Herstart dev server: `Ctrl+C` en `npm run dev`

---

## 📊 Je Bescherming

| Beveiliging | Waarde | Status |
|-------------|--------|--------|
| Google gratis limiet | 40,000 req/maand | ✅ |
| Jouw quota limiet | 1,000 req/dag | ✅ |
| Budget alert | $5 | ✅ |
| Verwacht gebruik | ~250 req/maand | ✅ |

**Conclusie**: Je zit op **0.6%** van je limiet! 🎯

---

## ✅ Checklist

- [ ] Google Cloud account aangemaakt
- [ ] Distance Matrix API enabled
- [ ] API key aangemaakt en restricted
- [ ] **Quota limiet ingesteld (1000/dag)**
- [ ] **Budget alert ingesteld ($5)**
- [ ] API key in `.env` gezet
- [ ] Dev server herstart

---

## 🎯 Hoe het werkt

**Device 1 doet 20 requests → Google telt: 20**
**Device 2 doet 15 requests → Google telt: 35**
**Device 3 doet 10 requests → Google telt: 45**

Google blokkeert automatisch bij 1000/dag, ongeacht hoeveel devices!

---

## ⚠️ Troubleshooting

**"OVER_QUERY_LIMIT" error**
- ✅ Dit is GOED! Je quota werkt
- Check: [Google Cloud Console > Quotas](https://console.cloud.google.com/apis/api/distancematrix-backend.googleapis.com/quotas)
- Reset: Automatisch elke dag om 00:00 Pacific Time

**"REQUEST_DENIED" error**
- Check of Distance Matrix API enabled is
- Check of API key restrictions correct zijn
- Wacht 5 minuten (API keys hebben propagation time)

**Budget alert email ontvangen**
- Check je usage in [Google Cloud Console](https://console.cloud.google.com/apis/dashboard)
- Verlaag quota als je te veel gebruikt

---

## 💰 Kosten Voorbeeld

Bij jouw gebruik (~250 requests/maand):
- **Kosten**: $0.00 (onder de $200 gratis credit)
- **Percentage van limiet**: 0.6%
- **Je quota blokkeert bij**: 1000 req/dag
- **Budget alert bij**: $2.50 (50% van $5)

**Je kunt NOOIT over de limiet!** 🛡️
