# Produktionshärdning 2: Jobbsökarens Home + GPS-livscykel

Avgränsad körning. Ingen designändring, inga anteckningsfiler, inga arbetsgivarspecifika filer, ingen annan realtime, ingen publicering.

## Vad koden faktiskt gör i dag (verifierat)

- `src/hooks/useWeather.ts` startar per montering: en `navigator.geolocation.watchPosition`, ett 10/20-minutersintervall, en `visibilitychange`-lyssnare och en retry-loop med backoff (30s → 2min → 5min). Ingen av dem tar hänsyn till om Home är synlig.
- `src/pages/Index.tsx` håller `/home` monterad via `KeepAlive` (`JOB_SEEKER_KEEP_KEYS` innehåller `/home`). Vid navigering till `/messages` döljs Home med `display`, men effekterna lever kvar — därav loggarna på /messages.
- `preloadWeatherLocation()` anropas från tre håll utan gemensam spärr: `useAuth.tsx:874`, `useEagerRatingsPreload.ts:187`, `useJobSeekerBackgroundSync.ts:82`. Var och en kan köra `getAccuratePosition` parallellt med hookens egen `checkForLocationChange`. Hookens `inFlightRef` skyddar bara inom en instans.
- `getAccuratePosition` i `src/lib/gpsUtils.ts` gör alltid ett andra högprecisionsförsök när första försöket ger `null` — även när orsaken är nekad behörighet eller timeout. Det är exakt loggraden `📍 Coarse position (none) — retrying with high accuracy`, och den fördubblar antalet nekade/timeoutade anrop.
- Positions-cachen `parium_weather_location` är global (ej användarbunden) och rensas **inte** i `clearAllAppCachesSync` (`useEagerRatingsPreload.ts`), där bara `parium_weather_data` finns med. Nästa konto på samma enhet kan alltså ärva föregående kontos position.

## Mål och åtgärder

1. **Inga parallella GPS-anrop** – processgemensam single-flight för positionsupplösning.
2. **Pausa när Home är dold/inaktiv** – watcher, intervall och retry vilar när sidan inte är aktiv.
3. **Preload/prewarm behålls** – men blir roll- och sidmedveten i stället för att tas bort.
4. **Ingen positionscache mellan konton** – användarbunden nyckel + rensning vid logout.
5. **Väder-UI och design exakt oförändrade.**
6. **Ingen retry vid nekad behörighet.**

## RED-tester (skrivs först, ska misslyckas mot nuläget)

Nya filer:
- `src/lib/__tests__/gpsCoordinator.test.ts`
  - Två samtidiga `resolvePosition()` ger **ett** underliggande GPS-anrop (single-flight).
  - Efter `PERMISSION_DENIED` görs **inget** nytt högprecisionsförsök inom spärrfönstret.
  - `getAccuratePosition` retriar inte när felet är nekad behörighet.
- `src/lib/__tests__/weatherLocationCache.test.ts`
  - Positionscache är isolerad per user-id (nyckel `parium_weather_location:v2:<userId>`).
  - Utan user-id sker ingen skrivning.
  - Exakt legacy-nyckeln `parium_weather_location` tas bort utan migrering.
  - Logoutrensningen tar bort både v2-prefixet och legacy-nyckeln.
- `src/hooks/__tests__/useWeatherLifecycle.test.ts`
  - När `active: false` startas ingen watcher, inget intervall och ingen retry-timer.
  - Byte `active: true → false` avregistrerar watchern (`clearWatch` anropas).
  - Byte tillbaka till `true` återupptar utan att duplicera watchers.

## GREEN-implementation (minsta möjliga)

1. **Ny `src/lib/gpsCoordinator.ts`**
   - Modul-global single-flight runt `getAccuratePosition`.
   - Kort spärr (t.ex. 10 min) efter `PERMISSION_DENIED`; under spärren returneras `null` direkt utan nytt anrop.
   - Används av både `useWeather` och `preloadWeatherLocation`.
2. **`src/lib/gpsUtils.ts`**
   - `getAccuratePosition` hoppar över det andra högprecisionsförsöket när första försöket misslyckades p.g.a. nekad behörighet (fel exponeras internt, inte i UI).
3. **`src/hooks/useWeather.ts`**
   - Ny option `active?: boolean` (default `true`). När `false`: ingen watcher, inget intervall, ingen retry — befintligt cache-värde returneras oförändrat.
   - All positionsupplösning går via `gpsCoordinator`.
   - Läser/skriver positionscache via användarbunden hjälpare.
4. **`src/lib/weatherApi.ts`**
   - `getCachedLocation`/`setCachedLocation` blir user-scopade (`parium_weather_location:v2:<userId>`), legacy-nyckeln raderas utan migrering. Väder-datacachen (`parium_weather_data`) lämnas orörd i format.
5. **`src/components/JobSeekerHome.tsx`**
   - Skickar `active={isHomeVisible}` till `useWeather`. Synlighet läses från befintlig aktiv-route-signal i `Index.tsx`/KeepAlive; ingen markup- eller klassändring.
6. **`src/hooks/useEagerRatingsPreload.ts`**
   - Lägger till v2-prefix och exakt legacy-nyckel i logoutrensningen.
7. **Preload-anropen** (`useAuth`, `useEagerRatingsPreload`, `useJobSeekerBackgroundSync`) behålls men delar samma coordinator, så de kollapsar till ett anrop i stället för tre.

## Acceptanskriterier

- Ingen `Coarse position (none) — retrying` efter nekad behörighet.
- Inga GPS-loggar alls när Home är dold (t.ex. på /messages).
- Högst ett GPS-anrop åt gången i hela appen.
- Väderraden ser exakt likadan ut och visas fortfarande bara vid GPS-bekräftat väder.
- Nytt konto på samma enhet ärver aldrig föregående kontos position.
- Alla befintliga tester gröna, `tsc --noEmit` rent, build ok.

## Risker

- **Vilande watcher kan ge lite äldre väder** vid återkomst till Home. Mitigering: kör en `checkForLocationChange` vid återaktivering om cachen är äldre än 3 minuter (samma tröskel som dagens visibility-logik).
- **User-scopad positionscache** ger ett engångstapp av cache vid deploy (första laddningen hämtar position på nytt). Acceptabelt och tyst i UI.
- **Deny-spärren** kan fördröja att väder dyker upp direkt efter att användaren godkänt platsen. Mitigering: spärren nollställs vid `permissions`-change till `granted` (samma signal `GpsPrompt` redan lyssnar på).

## Rollback

Varje steg är isolerat: ta bort `gpsCoordinator.ts` + `active`-optionen och återställ de fyra rörda filerna till commit före körningen. Inga migreringar, ingen backend, inga schemaändringar — rollback är rent frontend-revert.
