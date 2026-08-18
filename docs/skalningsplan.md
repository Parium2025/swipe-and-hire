# Parium — skalningsplan

Konkreta trösklar för när varje åtgärd behövs. Ingen åtgärd görs "för säkerhets skull";
varje rad har en mätpunkt som utlöser den.

Nivåerna räknas i **registrerade konton** och **DAU** (dagligt aktiva). Där de skiljer sig
anges båda.

---

## Nivå 0 — lansering till 10 000 konton

Ingen åtgärd krävs. Nuvarande arkitektur bär detta med marginal.

Att bevaka från dag ett:
- p95-latens på `search_jobs`, `get_conversation_summaries`, `get_employer_jobs_page`
- egress (GB/dygn) från storage
- antal samtidiga realtidsanslutningar
- felkvot i edge functions

Mätning: `bun run load:test` med 100 virtuella användare en gång i månaden, plus
`supabase--slow_queries` varannan vecka.

---

## Nivå 1 — 10 000–50 000 konton (≈2 000–8 000 DAU)

| Utlösare | Åtgärd |
|---|---|
| Egress > 200 GB/dygn | Lägg CDN framför storage för profilvideo och jobbmedia. Cachehuvuden 1 år, versionering via `image_updated_at`/`media_updated_at` sköter invalidering. |
| p95 på söket > 800 ms | Verifiera att keyset-paginering används överallt; lägg materialiserad kolumn för sökfältet i kandidatsöket (finns beskrivet i tidigare plan). |
| CV-kön växer > 200 poster | Höj batchstorlek i `get_cv_queue_batch` och kör kön oftare, inte parallellt. |
| Compute-larm i backend | Uppgradera compute ett steg. Detta är en inställning, inte kod. |

---

## Nivå 2 — 50 000–250 000 konton (≈8 000–40 000 DAU)

Här går infrastrukturen från "räcker" till "måste dimensioneras".

**Video och media (viktigast)**
- Flytta profilvideo till adaptiv streaming (HLS) i stället för direktlänkad MP4.
  En 90-sekundersvideo i tre kvaliteter kostar mindre i egress än en enda 4K-fil som
  laddas ned i sin helhet på mobil.
- Transkodera vid uppladdning i stället för på klienten för de filer som klienten inte klarar.
- Livstidsregel: video från konton utan aktivitet på 12 månader flyttas till kall lagring.

**AI och edge functions**
- Rate limit per organisation, inte bara per användare, på CV-analys och sammanfattningar.
- Kön får backpressure: nekar nya jobb när djupet överstiger en gräns, med tydligt UI-svar
  i stället för tyst väntan.
- Budgettak per organisation och månad, synligt i `ai_usage_log`.

**Realtid**
- Chatt och notiser delar kanal per konversation i dag. Vid 10 000+ samtidiga behövs
  fallback till polling när anslutningstaket nås, så att inget tappas tyst.
- Typing-indikatorer och närvaro stängs av först vid tryck — de är billigast att offra.

**Cron och batchar**
- Retention, nyhetsinhämtning och utskick blir inkrementella: bearbeta bara rader som
  ändrats sedan förra körningen, med markör i stället för helsvep.
- Utskick delas i chunkar med paus mellan, så att e-postleverantörens gräns aldrig nås.

**Databas**
- Läsreplika för analys och rapporter, så att arbetsgivarstatistik aldrig konkurrerar
  med sök och chatt.
- Partitionering av `job_views`, `profile_views` och `email_send_log` per månad.

---

## Nivå 3 — 250 000–1 000 000 konton

| Område | Åtgärd |
|---|---|
| Sök | Dedikerat sökindex (extern söktjänst) om p95 överstiger 500 ms trots index. Databasen behåller sanningen; sökindexet är en projektion. |
| Media | Egen CDN-domän med signerade URL:er och regional edge-cache. |
| Chatt | Meddelandehistorik arkiveras efter 12 månader till kall tabell; aktiv tabell hålls liten. |
| Notiser | Push-utskick via batch-API i stället för en request per enhet. |
| Kostnad | Kostnad per aktiv användare mäts månadsvis. Video dominerar; allt annat är brus. |
| Drift | Larm på p95, felkvot och ködjup går till en kanal någon faktiskt läser. |

---

## Det som inte behöver göras om

Följande är redan byggt för skala och ska inte skrivas om:

- RLS och RBAC på databasnivå — säkerhetsmodellen håller oavsett volym.
- RPC:er i stället för klientjoins.
- Keyset-paginering i jobbsöket.
- Versionerade media-URL:er.
- Offline-köer och återhämtning vid nätverksfel.
- Windows/extern skärm-vägen i videospelaren — empiriskt intrimmad, dokumenterat fryst.

---

## Beslutsregel

Skala när mätvärdet säger till, inte när användarantalet låter stort. Ett larm som gått
är en åtgärd; en prognos är det inte.
