# Kandidatsök i Apple-klass — skala till 100 000+

## Nuläge, ärligt betyg

| Område | Betyg | Kommentar |
|---|---|---|
| Dataisolering & säkerhet | 9,5 | Snapshots per ansökan, RLS + org-scoping håller |
| Sökrelevans (namn/ort/jobb/svar) | 8 | FTS + trigram + synonymer fungerar bra |
| Sök i CV och anteckningar | 3 | **Finns inte.** CV-text och anteckningar är osökbara idag |
| Skalning vid 100 000+ | 6 | Offset-paginering + `DISTINCT ON` sorterar om hela träffmängden per sida |
| Raderade konton | 6 | Ansökan överlever korrekt, men UI säger inte att kontot är borta |
| Rendering vid långa listor | 7,5 | Alla inlästa rader ligger i DOM:en |

Kort svar på "hur hade Apple gjort": de hade aldrig visat en räknare de inte kan leverera på, aldrig
använt offset-paginering, och sökfältet hade sökt i *allt* kandidaten lämnat — inte bara namnet.

## Vad som byggs

### 1. Sök i CV-text och anteckningar
- Ny sökkälla: `profile_cv_summaries.raw_text` + `summary_text` (CV-innehåll) och `candidate_notes.note`
  (endast den inloggade arbetsgivarens/organisationens egna anteckningar — aldrig andras).
- Materialiserad sökkolumn per kandidat så att sökningen förblir en indexträff, inte en join-scan.
- Träffar visas med källetikett i raden: "Träff i CV" / "Träff i anteckning", så man förstår varför
  personen dök upp.

### 2. Keyset-paginering istället för offset
- Byt `LIMIT/OFFSET` mot markörbaserad paginering (`applied_at, id` respektive sorteringsnyckel).
- Sida 4 000 blir då lika snabb som sida 1. Idag växer kostnaden linjärt med sidnumret.
- `DISTINCT ON (applicant_id)` ersätts med en förberäknad "senaste ansökan per kandidat"-nyckel så att
  vi slipper sortera hela träffmängden vid varje sidladdning.

### 3. Ärlig räknare
- Exakt antal upp till 10 000 träffar. Över det visas "10 000+" med exakt siffra beräknad i bakgrunden.
- Ingen sidladdning blockeras längre av en totalräkning.

### 4. Raderade konton
- Kandidatraden och profilen märks tydligt när kontot är borttaget: ansökan finns kvar (den är
  arbetsgivarens dokumentation), men profilbild/video/chatt visas som otillgängliga istället för tomma.
- Bokning av intervju och meddelande blockeras med förklarande text i stället för att tyst misslyckas.

### 5. Virtualiserad lista
- Endast synliga rader renderas. Noll visuell skillnad, men 20 000 inlästa rader blir lika lätta som 25.

## Teknisk detalj
- Databas: ny migration för sökkolumn + GIN-index, uppdaterad `search_employer_candidates` med
  markörparametrar och `p_count_cap`.
- Klient: `src/hooks/useApplicationsData.tsx` byter till markörbaserad `useInfiniteQuery`,
  `src/components/CandidatesTable.tsx` får virtualisering och träffkälla-etiketter.
- Offline-snapshoten behålls oförändrad.
