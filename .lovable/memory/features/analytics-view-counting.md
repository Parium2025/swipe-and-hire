---
name: Statistik – vilka visningar räknas
description: Endast inloggade besökares jobbvisningar räknas i statistiken; utloggade besök ska aldrig loggas.
type: feature
---

- Jobbvisningar loggas **endast för inloggade användare** (`useJobViewTracker`: kräver `userId`, 2 s på sidan + 50 % scroll). Detta är ett medvetet beslut — föreslå aldrig att logga utloggade/anonyma besök.
- Interna visningar (arbetsgivaren själv och kollegor i samma organisation) exkluderas i `get_employer_analytics_v2` och `get_employer_advanced_analytics`.
- Analys-fliken mäter alltid **externa visningar och ansökningar inom vald period**. `job_postings.views_count/applications_count` är livstidsräknare och används bara på annonskorten — blanda aldrig ihop de två måtten.
- Tidszon för all dag/tid-gruppering: `Europe/Stockholm`.
- Statistikcache i localStorage har 6 h TTL och UI visar "Uppdaterad HH:MM".
- "Tid till första ansökan" mäts från `job_postings.published_at` (sätts automatiskt av triggern `trg_set_job_published_at` första gången annonsen blir aktiv), med fallback till `created_at` för äldre rader. Ansökningar före publicering ignoreras.
