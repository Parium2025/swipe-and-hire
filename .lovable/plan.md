# Mina kandidater: bygg för 3 000+ per kolumn

## Vad som är trasigt i dag

Kanban-vyn laddar **alla** kandidater i listan, inte per kolumn:

- `useMyCandidatesData` hämtar 50 rader åt gången sorterat på `updated_at` över *hela* listan, och en effekt (`useMyCandidatesData.tsx:512`) hämtar automatiskt nästa sida direkt efter varje sida — i all evighet. Med 3 000 kandidater blir det 60 sekventiella rundturer × 3 anrop var = ~180 databasanrop innan tavlan är komplett.
- Kolumnerna får sina kandidater genom att **gruppera det som råkar vara nedladdat**. Vill du se kandidat nr 800 i "Erbjudande" måste hela listan laddas först.
- Siffran i kolumnhuvudet är antalet *nedladdade* rader, inte det verkliga antalet. Den kryper uppåt medan sidorna trillar in.
- Sök filtrerar bara nedladdade rader (`smartSearchCandidates` i `MyCandidates.tsx:250`) — söker du innan allt laddats får du fel träffbild.
- Medieförvärmningen loopar över **alla** nedladdade rader → 3 000 signerade URL:er + 3 000 videoförfrågningar.
- Virtualisering finns redan i `StageColumn.tsx:58-116` (över 60 kort) och fungerar — den delen behåller vi.

## Så här bygger vi om det

Samma modell som "Alla kandidater", som redan håller: servern gör jobbet, klienten renderar ett fönster.

### 1. En kolumn = en egen datakälla
Ny hook `useStageCandidates(listId, stage, searchQuery)` med keyset-paginering (`updated_at` som markör, 50 per sida) och `.eq('stage', stage)`. Varje kolumn hämtar bara sina egna rader och bara när den behöver dem. Hydreringen (ansökningar + profilmedia + aktivitet) bryts ut ur `useMyCandidatesData` till en delad `hydrateMyCandidateRows()` så att båda vyerna använder exakt samma logik — ingen dubbelkodning.

### 2. Ladda vid scroll, inte i förväg
Den självgående "hämta nästa sida"-loopen tas bort. I stället en sentinel i botten av varje kolumn: när du scrollat inom ~600 px från slutet hämtas nästa 50. Tomma kolumner kostar noll.

### 3. Sanna siffror i kolumnhuvudet
Ny databasfunktion `count_my_candidates_per_stage(recruiter_id, list_id)` som returnerar antal per steg i ett anrop. Badgen visar det verkliga totalantalet direkt vid inladdning, oavsett hur mycket som hunnit laddas ner.

### 4. Sök på servern
`search_my_candidates` utökas med `p_stage`, så att sökningen träffar hela kolumnen (alla 1 000) och inte bara det nedladdade. Klientsidans `smartSearchCandidates` blir kvar som omedelbar lokal förfiltrering medan servern svarar — samma upplevelse som i dag, men korrekt resultat.

### 5. Förvärmning med tak
Media förvärms för det virtualiserade fönstret plus 10 kort framåt per kolumn, i stället för för allt nedladdat. Full-size porträtt bara för de kort som faktiskt syns. Taket gör att 3 000 kandidater aldrig kan trigga 3 000 signeringar.

### 6. Cache per lista och steg
`localStorage`-cachen nycklas om till (lista + steg) och sparar första sidan per kolumn. Tavlan målas komplett direkt vid återbesök, med rätt kort i rätt kolumn.

### 7. Drag & drop vid stora volymer
`SortableContext` får bara de renderade kortens id:n (i dag alla 1 000). Dnd-kits autoscroll gör att du kan dra ett kort till en djup position i en lång kolumn; släpp längst upp fungerar som i dag.

## Teknisk sammanfattning

- Databas: ny `count_my_candidates_per_stage`, utökad `search_my_candidates` med `p_stage`, index `(recruiter_id, list_id, stage, updated_at desc)` på `my_candidates` för konstant svarstid.
- Frontend: `hydrateMyCandidateRows()` bryts ut; ny `useStageCandidates`; `StageColumn` får sentinel, riktigt totalantal och fönsterbegränsad `SortableContext`; `useMyCandidatesData` behåller mutationer, realtid och listlogik.
- Inga visuella ändringar. Samma layout, samma kort, samma animationer.

## Vad du kommer märka

Tavlan öppnas lika snabbt oavsett om listan har 30 eller 3 000 kandidater, siffrorna i kolumnhuvudena är rätt från första sekunden, och du kan scrolla igenom en kolumn med tusen kort utan hack eller tomma platser.
