# 🚀 GitHub Pages Deployment

## Voorbereiding

### 1. Repository aanmaken
1. Maak een nieuw GitHub repository (bijv. `traffic-app`)
2. Maak het **public** of **private** (beide werken)

### 2. API Key beveiligen
Je API key mag **NOOIT** in Git komen!

1. Ga naar je GitHub repository
2. **Settings** → **Secrets and variables** → **Actions**
3. Klik **New repository secret**
4. Name: `VITE_GOOGLE_MAPS_API_KEY`
5. Secret: Plak je API key: `AIzaSyByY4hWlvhgW3bORx3m6irgHP5-aSA0UqE`
6. Klik **Add secret**

### 3. Base URL aanpassen
Open `vite.config.ts` en pas de base aan naar je repository naam:

```typescript
export default defineConfig({
  base: '/jouw-repo-naam/', // Bijv. '/traffic-app/'
  ...
})
```

## Deployment

### Eerste keer pushen

```bash
# Initialiseer git
git init

# Voeg alle bestanden toe (behalve .env - zit al in .gitignore!)
git add .

# Eerste commit
git commit -m "Initial commit: I Hate Traffic Jams app"

# Voeg remote toe (vervang USERNAME en REPO)
git remote add origin https://github.com/USERNAME/REPO.git

# Push naar GitHub
git branch -M main
git push -u origin main
```

### 4. GitHub Pages activeren

1. Ga naar je repository op GitHub
2. **Settings** → **Pages**
3. Bij **Source** selecteer: **GitHub Actions**
4. Klik **Save**

### 5. Deployment check

1. Ga naar **Actions** tab
2. Je ziet de workflow draaien
3. Wacht tot het groen is ✅
4. Je app is live op: `https://USERNAME.github.io/REPO/`

## Volgende updates

```bash
# Maak wijzigingen in je code
git add .
git commit -m "Update: beschrijving van wijziging"
git push

# Automatisch gedeployed! 🎉
```

## Checklist ✅

- [ ] GitHub repository aangemaakt
- [ ] `VITE_GOOGLE_MAPS_API_KEY` secret toegevoegd
- [ ] `base` in `vite.config.ts` aangepast naar repo naam
- [ ] `.env` zit in `.gitignore` (✅ al gedaan)
- [ ] Code gepushed naar GitHub
- [ ] GitHub Pages ingeschakeld via Actions
- [ ] Workflow succesvol uitgevoerd
- [ ] App werkt op `https://USERNAME.github.io/REPO/`

## Troubleshooting

**"Page not found"**
- Check of `base` in `vite.config.ts` correct is
- Moet eindigen met `/`: `/traffic-app/`

**"Google Maps errors"**
- Check of secret `VITE_GOOGLE_MAPS_API_KEY` correct is toegevoegd
- Check of de naam exact `VITE_GOOGLE_MAPS_API_KEY` is (case-sensitive!)

**Build errors**
- Check Actions tab voor error logs
- Lokaal eerst testen: `npm run build`

**API key visible in code**
- ✅ De key zit in een GitHub Secret
- ✅ De key wordt NIET in je repository opgeslagen
- ✅ `.env` staat in `.gitignore`

## 🎉 Klaar!

Je app is nu live en update automatisch bij elke push!
