# Skeleton-audit: sida för sida

Jag går igenom varje inloggad sida i appen, jämför riktig vy mot skeleton, och rättar där skeleton inte matchar pixel för pixel. Ingen sida hoppas över.

## Metod per sida

1. Läs riktig vy (layout, spacing, kort-struktur, antal rader).
2. Läs nuvarande skeleton (om den finns).
3. Rätta så skeleton matchar: samma container-padding, samma kort-form, samma antal rader (via `localStorage` last-known-count där listan varierar), samma dividers/ikonplaceringar, samma `bg-white/10` shape-ton.
4. Verifiera att `isLoading && !cached` faktiskt visar skeleton (inte `null` eller spinner).

## Sidor som gås igenom

### Jobbsökare
- `/home` (jobseeker dashboard)
- `/search-jobs`
- `/saved-jobs`
- `/my-applications`
- `/profile` (jobseeker)
- `/profile-preview`
- `/subscription`
- `/settings`
- `/support`
- JobView overlay (`/job/:id`)

### Arbetsgivare
- `/my-jobs` (dashboard)
- `/candidates`
- `/my-candidates`
- `/messages`
- `/reports` (klar men verifieras igen)
- `/company-profile`
- `/employer-profile`
- `/reviews`
- `/templates`
- `/billing`

### Delade
- `/status`
- `/admin` (om relevant)

## Vad jag rättar konkret

- Byt ut `null` / spinner / generisk `Skeleton` mot pixel-matchande skeleton.
- Lägg till `last-known-count` cache via `src/lib/skeletonCounts.ts` där antalet varierar (listor).
- Säkerställ att kort-skeletons har: 2:1 hero, centrerad logga, list-rader med dividers, exakt samma paddings.
- Rör inte affärslogik eller riktig UI — bara loading-states.

## Leverans

En sammanfattning per sida:
- ✅ Redan korrekt (ingen ändring)
- 🔧 Rättad (kort beskrivning av vad)
- ⏭️ Ingen skeleton behövs (laddar synkront från cache/localStorage)

## Teknik

- Ingen ny arkitektur — återanvänder `skeletonCounts.ts`, `bg-white/10` shape-token och samma layout-konstanter som riktiga vyerna.
- Inga migrationer, inga API-ändringar.
- Om jag hittar en vy som returnerar `null` under laddning: ersätts med skeleton, inte spinner.
