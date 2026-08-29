# Produktionshärdning 1: Jobbsökare Home – statistikcache

Avgränsad körning. Endast `JobSeekerStatsCard`s localStorage-cache och RPC-felhantering. Ingen designändring, ingen realtime-refaktor, inget arbetsgivarflöde, ingen publicering.

## Nuläge (verifierat)

- `src/components/dashboard/JobSeekerStatsCard.tsx:13` använder en **global** nyckel `parium-jobseeker-stats` utan user-id. På delad enhet läser nästa konto föregående kontos siffror tills RPC svarar.
- `cachedStats` läses i `useMemo(..., [])` – den uppdateras inte vid kontobyte i samma session.
- RPC-fel returnerar idag `{ applications: 0, ... }` som ett **lyckat** svar (rad 50). React Query får `isSuccess`, cache skrivs inte men UI visar noll som vore det sanning; ingen retry, ingen felstatus.
- Central logout-rensning finns: `clearAllAppCaches()` i `src/hooks/useEagerRatingsPreload.ts` (prefix-lista rad 78-86, exakta nycklar rad 88-94), anropad från `useAuth.tsx` (bl.a. rad 1464 vid signOut och vid kontobyte/kick). Nyckeln är **inte** registrerad där idag.
- `src/lib/cacheNuke.ts` har en prefixlista för engångsrensning vid ny build – kan bära bort den gamla globala nyckeln.

## Mål

1. Cachen blir strikt användarbunden.
2. Gammal global nyckel rensas säkert (ingen migrering av värden – de kan tillhöra fel konto).
3. RPC-fel blir riktigt fel (stale cache visas), inte falska nollor.
4. Identisk visuell och funktionell upplevelse i övrigt.

## Teststeg först (ska misslyckas mot nuläget)

Ny fil `src/lib/__tests__/jobseekerStatsCache.test.ts` (vitest, jsdom localStorage):

1. `writeCachedStat(userA, 'applications', 5)` → `readCachedStats(userB)` returnerar `{}`.
2. `writeCachedStat(userA, ...)` skriver till nyckeln `parium-jobseeker-stats:v2:<userA>` och inte till `parium-jobseeker-stats`.
3. `readCachedStats(userA)` efter att den gamla globala nyckeln satts manuellt → returnerar `{}` **och** den gamla nyckeln är borttagen (legacy purge).
4. `readCachedStats(undefined)` (ej inloggad) → `{}`, ingen skrivning sker.
5. Korrupt JSON i användarnyckeln → `{}` utan kast.

Dessa misslyckas idag eftersom modulen inte finns och logiken är global.

## Minsta implementation

**Ny fil `src/lib/jobseekerStatsCache.ts`**
- `export const JOBSEEKER_STATS_CACHE_PREFIX = 'parium-jobseeker-stats:v2:'`
- `LEGACY_JOBSEEKER_STATS_KEY = 'parium-jobseeker-stats'`
- `readCachedStats(userId?: string): Record<string, number>` – tar bort legacy-nyckeln vid första anrop, returnerar `{}` utan userId, validerar att parsat värde är ett objekt med numeriska fält (annars rensa och returnera `{}`).
- `writeCachedStat(userId: string | undefined, key: string, value: number)` – no-op utan userId, skriver via `safeSetItem`.

**`src/components/dashboard/JobSeekerStatsCard.tsx`**
- Importera helpers, ta bort de lokala `readCachedStats`/`writeCachedStats`/`STATS_CACHE_KEY`.
- `const cachedStats = useMemo(() => readCachedStats(user?.id), [user?.id]);`
- Alla skrivningar får `user?.id` som första argument (inkl. `profile_views`- och `messages`-effekterna, som får `user?.id` i dependency-listan).
- I `queryFn`: vid `error` → `throw error` i stället för att returnera nollor. Behåll `enabled: !!user?.id`. Lägg `retry: 1`.
- `dataReady={isSuccess}` och `hasCachedData` behålls oförändrade → vid fel visas cachade siffror precis som idag när data saknas; inga påhittade nollor skrivs till cache.

**`src/hooks/useEagerRatingsPreload.ts`**
- Lägg `JOBSEEKER_STATS_CACHE_PREFIX` i `prefixesToClear` och `'parium-jobseeker-stats'` i `exactKeysToRemove` (importeras från den nya modulen, ingen duplicerad sträng).

**`src/lib/cacheNuke.ts`**
- Lägg `'parium-jobseeker-stats'` i `STALE_PREFIXES` så gamla installationer städas vid nästa build.

Inga andra filer rörs. Anteckningskortet, kortordningen, StatsCarousel, realtime-kanalen och prewarm är oförändrade.

## Acceptanskriterier

- Konto A loggar ut, konto B loggar in på samma enhet → inga av A:s siffror syns någon gång (varken i första frame eller efter reload).
- Efter utloggning finns inga `parium-jobseeker-stats*`-nycklar kvar i localStorage.
- Nätverksfel på `get_jobseeker_dashboard_stats` → kortet visar senast cachade värden för samma användare, aldrig 0; React Query markerar `isError` och retryar en gång.
- Kortet ser pixelidentiskt ut, samma fem statistikposter i samma ordning, samma realtime-invalidering.
- `tsgo` rent, alla befintliga tester gröna + de nya.

## Rollback

Isolerat: återställ de fyra filerna. Den nya nyckelversionen (`:v2:`) gör att en rollback bara innebär att den gamla globala nyckeln börjar användas igen; inga dataförluster eller DB-ändringar.
