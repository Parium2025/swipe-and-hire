## Status efter förra ändringen

Jag har gått igenom hela kedjan. Den förra fixen löste flimret **för arbetsgivarens chatt-badge**, men jag hittade två platser till med exakt samma bugg som påverkar **jobbsökarsidan** — så strukturen är inte helt likvärdig än. Här är vad jag vill åtgärda + hela bilden av hur det hänger ihop.

---

## 1. Det jag verifierade fungerar redan

### Chatt-badge på arbetsgivarsidan ✅
Badgen i `EmployerTopNav` läser `preloadedUnreadMessages` från `useAuth`. Värdet sätts bara till slutligt resultat (aldrig nollställt mid-fetch). Förra fixen tog bort den falska "0"-skrivningen från `useEmployerBackgroundSync`. **Stabilt.**

### Notisklockan 🔔 (den med "9+") ✅
`useNotifications` är redan välbyggd:
- Hydrerar från `localStorage` direkt på mount (inget tomt mellanläge)
- På flikbyte: refetchar och sätter state till **slutligt värde** — aldrig till 0 först
- Realtime ökar räknaren inkrementellt på nya notiser
- Cache delas mellan flikar via `localStorage` (per user)

Ingen fix behövs här.

### Flera flikar samma dator ✅
- En sessionstoken per webbläsare (`localStorage`) → räknas som **en enhet** i 3-enheter-gränsen
- Varje flik har egen React-state, egna React Query-cacher i minnet, egen scroll-position
- Ingen `BroadcastChannel`/storage-lyssnare som tvingar omladdning
- Heartbeats från valfri flik håller sessionen vid liv för alla

Du kan ha 3 flikar med olika kandidater öppna utan att de stör varandra.

---

## 2. Det jag vill fixa nu (jobbsökarsidan)

`JobSeekerTopNav` använder `conversationsCtx.totalUnreadCount` (live) — alltså **direkt** beroende av React Query-cachen `['conversations', userId]`. Två preloaders klobbar fortfarande den cachen med konversationer **utan** `unread_count`-fält:

| Fil | Rad | Problem |
|---|---|---|
| `src/hooks/useJobSeekerBackgroundSync.ts` | 191 | `queryClient.setQueryData(['conversations', userId], conversations)` — saknar `unread_count` |
| `src/hooks/useEagerRatingsPreload.ts` | 559 | Samma sak |

**Effekt:** På jobbsökarsidan flimrar chatt-badgen vid flikbyte (>30s) precis som det gjorde på arbetsgivarsidan innan fixen.

**Åtgärd:** Ta bort `setQueryData`-anropen i båda filerna. Behåll `safeSetItem`-skrivningen till `localStorage`/`sessionStorage` (det är en separat fallback-cache och påverkar inte React Query). `useConversations` refetchar själv vid behov via `refetchOnWindowFocus` + realtime.

---

## 3. Symmetrin mellan sidorna efter fixen

| Yta | Mekanism | Status efter fix |
|---|---|---|
| Arbetsgivare · chatt-badge | `preloadedUnreadMessages` (useAuth state) | Stabil |
| Jobbsökare · chatt-badge | `totalUnreadCount` (useConversations live) | Stabil |
| Båda · notisklocka | `useNotifications` localStorage + realtime | Stabil |
| Båda · multi-flik | Egen React-state per flik, delad session | Isolerade |

Strukturen blir alltså likvärdig — bara olika datakällor under huven (vilket är OK eftersom de täcker samma användarbehov).

---

## 4. Stabilitetsbedömning

**Innan denna fix: 7/10**
- Arbetsgivar-badgen fixad, men jobbsökar-badgen flimrar fortfarande
- Övriga delar (notisklocka, sessionshantering, multi-flik) är solida

**Efter denna fix: 9/10**
- Alla badges håller sina värden stabilt vid flikbyten på båda sidor
- Inga onödiga omladdningar mellan flikar
- En kvarvarande risk på 1 poäng: den globala `messagesChannel`-realtimen i `useAuth` triggar `refreshEmployerStats` på **alla** nya meddelanden i hela databasen (utan filter), vilket vid hög trafik kan orsaka onödiga RPC-anrop. Inte ett buggproblem — en framtida skalningsoptimering. Lämnar utanför denna fix för att inte ändra något oombett.

---

## 5. Tekniska detaljer (för utvecklare)

```text
Innan: preloader → setQueryData(['conversations', uid], rawRows)
       useConversations subscribers → totalUnread = sum(c.unread_count) = NaN || 0
       → badge flimrar → useConversations refetchar → korrekt värde

Efter: preloader → bara localStorage + sessionStorage
       useConversations egen queryFn → setQueryData med berikade rows
       (inkl. unread_count) → badge stabil hela tiden
```

Inga andra konsumenter använder `['conversations', userId]`-cachen, så borttagningen av `setQueryData` är säker.
