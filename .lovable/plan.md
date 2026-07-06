## Mål

Höj kodkvaliteten i Swipe Mode till minst 9/10 utan att ändra en enda pixel visuellt eller ändra beteende. All swipe, catching, animation, haptik och preload ska kännas premium — men det gör den redan visuellt. Fokus här är **koden bakom**.

## Nuvarande problem (bedömning: 6/10)

- `JobSlide.tsx` = 887 rader, gör allt (media, badges, gester, hint-overlays, actions, salary-parsing, undo-logik, entry-animation).
- `SwipeFullscreen.tsx` har dubbla render-vägar (empty state + main) med identiska undo-props → risk för drift.
- Många parallella flags i JobSlide (`isVisible`, `isActive`, `overlayOpen`, `skipEntryAnimation`, `isUndoEntry`, `canUndo`) utan central state — svårt att resonera om.
- Gester, haptik, preload och animationer är utspridda som inline-logik istället för hooks.
- `SwipeJobDetail.tsx` (651 rader) och `SwipeApplySheet.tsx` (504 rader) har liknande blandning av UI + logik.

## Vad refaktorn gör

### 1. Dela `JobSlide.tsx` (887 → ~250 rader) i rena presentational-delar
```
src/components/swipe/jobSlide/
├── JobSlide.tsx              # Container: state, gester, layout
├── JobSlideMedia.tsx         # Bild + gradient + preload-hint
├── JobSlideBadges.tsx        # Top badges (företag, ort, lön)
├── JobSlideActions.tsx       # ✕, spara, hjärta, ångra (alla alltid mounted)
├── JobSlideHints.tsx         # Overlay-hints vid drag
└── useJobSlideState.ts       # Reducer som samlar alla flags
```

### 2. Extrahera återanvändbara hooks
- `useSwipeCardGesture` — hela drag/threshold/haptik-logiken (idag inline)
- `useSlideEntryAnimation` — konsoliderar `skipEntryAnimation` + `isUndoEntry`
- `useJobActions` — save/dislike/undo-orchestrering (idag i JobSlide + Fullscreen)

### 3. Rensa `SwipeFullscreen.tsx`
- Ta bort dubbelrendering; en enda render-väg med conditional inner-content.
- Flytta all undo-state till en `useSwipeUndo` hook (redan halvvägs).

### 4. Splitta `SwipeJobDetail.tsx` och `SwipeApplySheet.tsx`
- Bryt ut sektioner (header, salary-block, description, apply-CTA) till egna komponenter.
- Ren separation: data-hooks vs. presentational.

### 5. Typer & konstanter
- Samla alla magic numbers (threshold 80px, velocity 0.3, delays) i `swipe/constants.ts`.
- Stärka `types.ts` med diskriminerade unions för slide-state.

## Vad refaktorn INTE gör

- **Ingen visuell ändring.** Samma klasser, samma z-index, samma animationer, samma haptik-timing.
- **Ingen beteendeändring.** Samma threshold, samma undo-fönster, samma preload-strategi.
- Ingen ändring i data-hämtning eller Supabase-anrop.

## Verifiering

- `bun test` grönt.
- `tsgo` grönt.
- Playwright: öppna swipe mode, swipa 3 kort åt vardera hållet, tryck ångra — screenshot före/efter jämförs mot huvudbranch.

## Omfattning

~15–18 nya filer, ~5 filer refaktoreras. Ingen ny dependency. Uppskattat ~2 000 rader flyttad + omorganiserad kod.

## Fråga innan jag börjar

Refaktorn är stor och kommer att röra många filer i ett svep. Vill du att jag:
- **A) Kör hela refaktorn i en session** (ca 20–30 min arbete från min sida, 1 stor diff), eller
- **B) Delar upp i faser** (Fas 1: JobSlide → Fas 2: Fullscreen/Detail → Fas 3: ApplySheet), så du kan verifiera visuellt mellan varje?

Jag rekommenderar **B** eftersom du då kan öppna swipe mode och känna efter mellan faserna att inget ändrats.
