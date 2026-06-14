## Mål

Bygg om alla SEO-landningssidor (`/jobb/...`, `/yrke/...`, `/yrken`, `/annonser`, `/guider/...`) så de:
1. Har samma struktur och känsla som appens egen landning (`/jobbsokare`).
2. Använder Pariums **ljusblå pill-CTA** ("Skapa min profil idag"-stilen) — inte vit/kritvit.
3. Visar **äkta jobbsiffror** för varje (stad × yrke) — och döljer/disablar länkar utan jobb.
4. Skickar alla knappar och länkar till rätt destination (`/auth` → in i appen, eller direkt till matchande SEO-sida).

---

## 1. Knapp-standard (gäller överallt på SEO)

Ny gemensam komponent `src/components/seo/SeoCTAButton.tsx`:
- `rounded-full bg-secondary text-white px-8 py-4 font-semibold` — exakt samma som hero-knappen på `/jobbsokare`.
- Hover: `scale-1.03`, `bg-secondary/90`.
- Ersätter alla `bg-chalk`-knappar på SEO-sidor.
- Mobil-sticky CTA (`MobileStickyCTA`) använder samma stil.

**Text på alla primära CTA**: "Skapa min profil idag" (enhetligt, matchar landning).

---

## 2. Ny sidstruktur (per SEO-sida)

```text
┌─ LandingNav (logga + Logga in)
│
├─ HERO
│   • Breadcrumb (Jobb / Stad / Yrke)
│   • H1 "Lediga jobb som elektriker i Göteborg"
│   • 2 rader intro
│   • [Skapa min profil idag]  [Se 12 jobb i Göteborg]
│         ↑ ljusblå pill          ↑ outline, visar äkta siffra
│
├─ JOBB-LISTA (om jobb finns)
│   • Upp till 6 äkta jobbkort från job_postings
│   • "Se alla X jobb" → /auth
│
├─ KOMPAKT INFO-RAD (3 kolumner, tätt)
│   • Arbetsuppgifter | Krav | Lön
│
├─ FAQ ACCORDION (stängd by default)
│   • 4-5 frågor, JSON-LD FAQPage för rich results
│
├─ INTERN LÄNK-FOOTER (diskret, för Google + UX)
│   • "Andra yrken i {stad}"  — visar antal jobb per yrke
│   • "Elektriker i andra städer" — visar antal jobb per stad
│   • Yrken/städer med 0 jobb: gråade ut, ej klickbara,
│     med label "Inga jobb just nu"
│
└─ MobileStickyCTA (samma ljusblå knapp)
```

---

## 3. Dynamiska jobbsiffror (kritisk ändring)

Ny hook `src/hooks/useJobCounts.ts`:
- En query mot `job_postings` (`is_active=true`, `deleted_at IS NULL`) som returnerar `{ city: count, occupation: count, "city|occupation": count }`.
- Cachas i React Query (5 min stale).
- Används av alla SEO-sidor + footer-länkar.

**Beteende:**
- `12 jobb` → knapp aktiv, visar siffran.
- `0 jobb` → länken renderas som inaktiv chip med text "Inga jobb just nu" + CTA "Bevaka {stad} {yrke}" → `/auth?notify=elektriker-malmo`.
- Detta löser ditt exempel: "Elektriker Malmö" utan jobb kan inte längre klickas till tom sida.

---

## 4. Konsekvens i innehåll

- Alla CTA: **"Skapa min profil idag"**.
- Alla sekundärknappar: **"Se {N} jobb i {stad}"** eller **"Bevaka jobb"** (om N=0).
- Breadcrumbs alltid: `Jobb / {Stad} / {Yrke}`.
- FAQ-rubriker enhetliga per sidtyp.

---

## 5. Filer som ändras (~9 filer)

**Nya:**
- `src/components/seo/SeoCTAButton.tsx` — den ljusblå pill-knappen.
- `src/components/seo/SeoFooterLinks.tsx` — diskret länk-footer med jobbsiffror + disable-läge.
- `src/components/seo/SeoFAQ.tsx` — kompakt accordion + JSON-LD.
- `src/hooks/useJobCounts.ts` — aggregerade siffror.

**Uppdateras (struktur + knappar):**
- `src/pages/JobbCity.tsx`
- `src/pages/JobbCityYrke.tsx`
- `src/pages/YrkePage.tsx`
- `src/pages/JobbHub.tsx`
- `src/pages/YrkenHub.tsx`
- `src/pages/AnnonserHub.tsx`
- `src/pages/GuidePage.tsx`
- `src/pages/GuiderHub.tsx`
- `src/pages/PublicJobPage.tsx`
- `src/components/seo/MobileStickyCTA.tsx` (byter till `bg-secondary`)

---

## 6. Vad detta INTE rör

- Inga ändringar i appens inloggade vyer.
- Inga ändringar i `/jobbsokare`, `/arbetsgivare`, `/` (landning).
- Ingen databas-migration — bara läs-query mot `job_postings`.
- Ingen påverkan på befintliga URL:er — alla canonicals behålls.

---

## 7. Svar på "kommer SEO drunkna parium.se?"

**Nej, 2/10 risk.** Alla SEO-sidor är på **samma domän** (parium.se) och länkar canonical hem. Google rankar dem som delar av Parium — det stärker hela domänen istället för att konkurrera. Och varje ny jobbannons skapar EN sida (`/annons/{id}`), inte en hel SEO-trädgren — strukturen är fast och kontrollerad.

---

**Klart att köra?** Säg "kör" så bygger jag allt i en sittning.