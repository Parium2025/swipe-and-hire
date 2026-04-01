## Swipe Mode Filter — Fristående söktunnel

### Arkitektur
Swipe mode använder redan de filtrerade jobben från SearchJobs. Vi behöver:

1. **Ny komponent: `SwipeFilterSheet.tsx`** — en bottom sheet med sökfält, plats, yrkesområde, anställningstyp och sortering. Stilmässigt anpassad till swipe mode (mörk, glasmorfism, samma premium-känsla).

2. **Uppdatera `SwipeFullscreen.tsx`** — lägg till en filter-ikon uppe till vänster (bredvid jobbräknaren). Klick öppnar SwipeFilterSheet. Visa en aktiv-filter-badge om filter är satta.

3. **Uppdatera `SearchJobs.tsx`** — skicka ner filterstaten (searchInput, selectedCity, selectedCategory, selectedEmploymentTypes, sortBy) och deras setters till SwipeFullscreen.

### SwipeFilterSheet innehåll
- Sökfält (jobbtitel/företag)
- Plats (LocationSearchInput)
- Yrkesområde (dropdown)
- Anställningstyp (dropdown)
- Sortering (dropdown)
- "Rensa filter" + "Visa X jobb" knapp

### UX
- Filter-ikon i headern bredvid "1/N"
- Öppnas som smooth bottom sheet (samma animation som SwipeJobDetail)
- Aktiv badge på ikonen om filter är aktiva
- Jobb-listan uppdateras live när filter ändras
- Stängs via drag-ner, X eller "Visa jobb"-knapp

### Filer som ändras
- `src/components/swipe/SwipeFilterSheet.tsx` (NY)
- `src/components/SwipeFullscreen.tsx` (lägg till filter-knapp + state)
- `src/pages/SearchJobs.tsx` (skicka ner filter-props)
