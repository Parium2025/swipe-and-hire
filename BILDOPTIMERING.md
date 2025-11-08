# Bildoptimering - Komplett Strategi

Denna fil beskriver den kompletta bildoptimeringsstrategin som implementerats i Parium.

## Mål
- **Noll synlig laddning**: Bilder ska alltid vara förladdade när användaren behöver dem
- **Aggressiv cachning**: Bilder ska cachas i 30 dagar och aldrig laddas om i onödan
- **Bakgrundsladdning**: Alla bilder laddas i bakgrunden medan användaren navigerar
- **Instant navigation**: När man klickar på ett jobb ska bilden redan vara där

## Implementerade Optimeringar

### 1. Image Preloader Hook (`src/hooks/useImagePreloader.ts`)
En custom React hook som förladddar bilder i bakgrunden:
- Skapar osynliga img-element som laddar bilderna
- Stöder prioritering (high/low) för fetchPriority
- Förhindrar dubbelladning med en Set av laddade URLs
- Exporterar också hjälpfunktioner för manuell preloading

**Användning:**
```tsx
useImagePreloader(imageUrls, { priority: 'high' });
```

### 2. Hover Preload Hook (`src/hooks/useHoverPreload.ts`)
Hook för att förladdda bilder när användaren hovrar över element:
- Perfekt för jobbkort - ladda bilden innan klick
- Använder hög prioritet vid hover
- Cachear vilka URLs som redan preloadats

**Användning:**
```tsx
const preload = useHoverPreload();
onMouseEnter={() => preload([imageUrl])}
```

### 3. Service Worker (`public/sw.js`)
Aggressiv cachning av alla bilder med Service Worker:
- **Cache-tid**: 30 dagar för alla bilder
- **Patterns**: Matchar job-images, profile-media, company-logos osv.
- **Strategi**: Cache-first med network fallback
- **Offline support**: Returnerar cachad version även vid nätverksfel

**Registrering**: Sker automatiskt i `index.html`

### 4. React Query Cache-konfiguration (`src/App.tsx`)
Längre cache-tider för att behålla bildurls:
```tsx
staleTime: 30 * 60 * 1000,  // 30 minuter
gcTime: 60 * 60 * 1000,      // 1 timme
refetchOnWindowFocus: false,
refetchOnMount: false
```

### 5. Eager Loading på Viktiga Bilder
Alla synliga bilder använder:
```tsx
loading="eager"
fetchPriority="high"
```

**Filer som uppdaterats:**
- `src/components/ReadOnlyMobileJobCard.tsx`
- `src/pages/JobView.tsx`

## Komponenter med Bildoptimering

### SearchJobs (`src/pages/SearchJobs.tsx`)
- ✅ Förladddar alla jobbbilder så fort de laddas
- ✅ Använder längre cache-tider (30 min staleTime)
- ✅ Eager loading på mobila jobbkort

### JobView (`src/pages/JobView.tsx`)
- ✅ Förladddar jobbbild så fort den finns
- ✅ Eager loading med hög prioritet
- ✅ Importerar useImagePreloader

### JobSwipe (`src/components/JobSwipe.tsx`)
- ✅ Förladddar alla swipe-bilder i bakgrunden
- ✅ Hög prioritet på alla bilder

### ReadOnlyMobileJobCard (`src/components/ReadOnlyMobileJobCard.tsx`)
- ✅ Eager loading på alla bilder
- ✅ Hög fetch-prioritet

## Resultat

Med denna implementering:
1. **Första besöket**: Bilder laddas i bakgrunden medan användaren scrollar
2. **Andra besöket**: Bilder finns i Service Worker-cache (30 dagar)
3. **Navigation**: Bilder är alltid redan laddade när man klickar
4. **Offline**: Bilder fungerar även utan internet

## Cache-hierarki

```
Browser Memory Cache (snabbast)
    ↓
React Query Cache (30 min)
    ↓
Service Worker Cache (30 dagar)
    ↓
Supabase Storage (signed URLs, 1 timme)
    ↓
Supabase CDN
```

## Underhåll

### Rensa Service Worker-cache
Om du behöver tvinga omladd ning av bilder:
```javascript
navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
```

### Uppdatera cache-version
I `public/sw.js`, ändra:
```javascript
const CACHE_NAME = 'parium-images-v2'; // Öka version
```

## Prestanda

Förväntade resultat:
- **Första sidladdning**: Bilder laddas i bakgrunden
- **Andra sidladdning**: Instant (från cache)
- **Jobbklick**: Bild redan laddad (0ms)
- **Offline**: Fullt fungerande bildvisning

## Säkerhet

- Service Worker använder samma origin-policy
- Signerade URLs från Supabase har 1 timmes giltighetstid
- Cache respekterar CORS-headers
- Ingen känslig data cachas (endast publika bilder)
