# 🔑 HERE API Setup Instructies

## Stap 1: Maak HERE Account aan

1. Ga naar [https://platform.here.com/](https://platform.here.com/)
2. Klik op **"Sign Up"** rechtsboven
3. Vul je gegevens in (naam, email, wachtwoord)
4. ✅ **GEEN credit card nodig!**
5. Bevestig je email adres

## Stap 2: Maak API Key aan

1. Log in op [https://platform.here.com/](https://platform.here.com/)
2. Klik op **"Access Manager"** in het menu
3. Klik op **"Create New App"**
4. Vul een naam in (bijv. "Traffic Analyzer")
5. Klik op **"Create"**
6. Selecteer je nieuwe app
7. Klik op **"Create API Key"**
8. Kopieer de API key (bewaar deze goed!)

## Stap 3: Configureer je app

1. Open het bestand `.env` in de root van je project
2. Vervang `your_api_key_here` met jouw API key:

```bash
VITE_HERE_API_KEY=jouw-api-key-hier
```

3. **BELANGRIJK**: Commit NOOIT je `.env` bestand naar Git!

## Stap 4: Activeer de juiste APIs

1. In je HERE project dashboard
2. Ga naar **"REST & XYZ HUB API"**
3. Zorg dat deze services enabled zijn:
   - ✅ Geocoding & Search API
   - ✅ Routing API v8
   - ✅ Traffic API (automatisch inbegrepen)

## Stap 5: Start de app

```bash
npm run dev
```

## ✅ Checklist

- [ ] HERE account aangemaakt (zonder credit card!)
- [ ] API key aangemaakt
- [ ] `.env` bestand aangepast met jouw API key
- [ ] App gestart en getest

## 🎯 Je Gratis Limiet

- **250,000 requests per maand**
- Voor jouw gebruik (~250 requests/maand) = **0.1% van de limiet**
- Geen credit card ooit nodig
- Geen verrassingen

## ⚠️ Troubleshooting

**"Locatie niet gevonden"**
- Gebruik specifieke adressen: "Amsterdam Centraal" ipv "Amsterdam"
- Gebruik postcodes: "1012 AB Amsterdam"

**"API key niet geconfigureerd"**
- Check of `.env` bestand bestaat in de root
- Check of de key begint met je account prefix
- Herstart de dev server (`Ctrl+C` en `npm run dev`)

**API errors**
- Check of de Routing API enabled is in je HERE dashboard
- Check of je nog binnen de gratis limiet zit (250k/maand)
