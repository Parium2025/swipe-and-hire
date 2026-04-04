
## Problem
Swipe-kortens innehåll (JobSlide) visar för mycket text utan trunkering, vilket skapar en rörig upplevelse. Målet är att matcha den rena designen i förhandsvisningen (bild 2).

## Design — "Premium TikTok-kort"
Varje kort ska visa:
1. **Bakgrundsbild** (eller gradient-fallback) — som idag
2. **Bottensektion** med gradient-overlay:
   - Företagsnamn (vit, medium, en rad)
   - Jobbtitel (vit, bold, max 2 rader med `line-clamp-2`)
   - Anställningsform • Plats (en rad, truncated)
3. **Swipe-hints** längst ner ("← Skippa · Dubbeltryck för mer · Gilla →")
4. **LIKE/NOPE-stämplar** vid drag — som idag

### Vad som tas bort från kortet:
- All beskrivningstext — den visas bara i detaljvyn (SwipeJobDetail) vid dubbeltryck

### SwipeJobDetail (detaljvyn vid dubbeltryck):
- Behåller all info (beskrivning, krav, förmåner etc.)
- **Trunkerar** beskrivningen till max 6 rader med "Visa mer"-knapp
- Bättre visuell hierarki

### Synk med förhandsvisning:
- Kortets layout matchar exakt vad arbetsgivaren ser i mobilförhandsvisningen (MobileJobWizard)
- Samma typografi-storlekar och trunkering

## Filer att ändra
1. `src/components/swipe/JobSlide.tsx` — Rensa bottensektionen, säkerställ trunkering
2. `src/components/swipe/SwipeJobDetail.tsx` — Trunkera description med "Visa mer"
3. `src/components/swipe/SwipeCard.tsx` — Synka samma bottenlayout (om den fortfarande används)

## Inte ändra
- Swipe-mekanik (touch, drag, snap)
- Filter, header, dots
- Backend/data
