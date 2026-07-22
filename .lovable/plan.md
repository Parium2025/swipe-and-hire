# Skeleton-paritet 1:1 — hela appen

Målet: varje skelett (den grå laddningsvyn) ska matcha den riktiga sidan i **struktur, positioner, storlekar och antal element** — exakt som vi nyss gjorde på `EmployerTopNav`. Ingen ska "hoppa" när riktiga innehållet tar över.

## Omfattning

### Arbetsgivarvyn (`EmployerPageSkeleton.tsx` + `JobDetailsSkeleton.tsx`)
1. **`EmployerHomeSkeleton`** (`/home`) — jämför mot `EmployerHome` (hälsning, "Din översikt", `HomeDashboardGrid`, 4 kort).
2. **`EmployerDashboardSkeleton`** (`/dashboard`, `/my-jobs`) — kontrollera stats-grid (mobil vs desktop), sökfält, tab-pills, kort-layout, paginering.
3. **`EmployerMyCandidatesSkeleton`** (`/my-candidates`) — header, sök, stage-pills, kort.
4. **`EmployerCandidatesSkeleton`** (`/candidates`) — verifiera att den finns; annars lägg till.
5. **`JobDetailsSkeleton`** (`/job-details/:id`) — kanban-kolumner + kort per stage (redan per-annons-cache).
6. **Topnav-chrome (`SkeletonChrome`)** — mobil-header + desktop-topnav (desktop är nyss fixad; verifiera mobilen mot `EmployerMobileHeader`).

### Jobbsökarvyn
7. **`SearchPageSkeleton`** (`/search`) — jämför mot `SearchJobs` (topnav, sökfält, filter-chip-rad, sort-pill, kort-grid). Verifiera bottom-nav på mobil.
8. **`JobCardGridSkeleton`** — antal kort per breakpoint mot faktisk grid.
9. **`JobViewSkeleton`** (`/job/:id`) — hero (2:1), logo-cirkel, titel, badges, förmåner, footer-CTA.
10. **`ProfilePreviewSkeleton`** — mot `ProfilePreview` (avatar, namn, sektioner, badges).
11. **Sidor med inline-skelett** (kontrollera, inte nödvändigtvis skriv om):
    - `Messages` (konversationslista + chattvy)
    - `MyApplications`, `SavedJobs`
    - `Dashboard` (jobbsökar-hem)
    - `MyCandidates`

## Metod (per skelett)

1. Läs den riktiga komponenten. Notera: yttre wrapper-klasser, spacing (`space-y-*`, `gap-*`), grid-cols per breakpoint, exakta höjder (h-14, aspect-ratio 2/1, m.m.), avatar-storlekar, badge-storlekar, antal rader.
2. Läs skelettet. Diffa mot 1.
3. Rätta skelettet så att:
   - Container-hierarkin matchar (samma paddings, `responsive-container-wide`, `p-3`, m.m.).
   - Antal element (kort, kolumner, rader) drivs av `readCachedCount` / `useLiveEmployerJobCount` — inte hårdkodat.
   - Höjder/bredder matchar de riktiga elementen på px-nivå.
   - Endast en ton används (`bg-white/10`), ingen accentfärg.
4. Testa mentalt hand-off: när riktigt innehåll poppar in ska ingenting flytta sig sidleds/nedåt.

## Teknisk not

- Skelett-tokens: `SHAPE = 'bg-white/10 animate-pulse'`, `fullscreenSkeletonStyle` (fixed overlay).
- Live-räknare: `useLiveEmployerJobCount` (react-query cache → `localStorage` → default). Utöka mönstret till fler skelett där det ger värde (candidates, applications, messages).
- Layout-cache för `JobDetails` (per-jobId stages+counts i `localStorage`) — verifiera att den fortfarande skrivs vid varje datauppdatering.
- Mobilheader-skelettet ska följa `EmployerMobileHeader` exakt (samma knappar/positioner).

## Leverans

- Endast skelett-filer + ev. helper i `skeletonCounts.ts` ändras. Ingen affärslogik, ingen färg-/UX-ändring i live-UI.
- Efter varje del: kort verifiering via `tsgo`/build.

## Bedömning (efter genomgången)

Ger en slutlig 1–10-bedömning av skelett-lagret + korta rekommendationer på det som inte är värt att jaga (t.ex. per-kort-metadata i skelett).

---

**Bekräfta så kör jag hela sviten i ett svep** (kan bli 5–8 filredigeringar). Vill du att jag begränsar till en delmängd (t.ex. bara arbetsgivarsidan först) säg till.
