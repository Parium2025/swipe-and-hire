# Layout & Responsiv-regler för parium.se

Detta dokument är **sanningen** för hur landningssidorna (`AudienceLanding`,
`LandingNav`, `Index`) ska bete sig på alla skärmstorlekar — från iPhone SE
(320px) till 4K-TV via Chromecast (3840px+).

## 1. Container-system

| Lager | max-width | Horisontell padding |
|-------|-----------|---------------------|
| `LandingNav` (yttre wrapper) | `1400px` | `px-3 sm:px-5 md:px-6 lg:px-24` |
| Hero-grid | `1400px` | `px-3 sm:px-5 md:px-6 lg:px-24` |
| Innehållssektioner (Funktioner, Priser, FAQ, Kontakt) | `1180px` / `880px` / `920px` | `px-5 sm:px-6 md:px-12 lg:px-24` |

**Regel:** Nav + hero har EXAKT samma container-värden så att loggan i navet
hamnar i vertikal linje med hero-rubriken på alla skärmar. Detta får inte
brytas.

**Regel:** Innehållssektioner under hero är medvetet smalare (1180px) av
läsbarhetsskäl — de spretar därför inte ut på 4K. Detta är design, inte bugg.

## 2. Logo-ring alignment

Hero-rubriken ska starta exakt under **första ringen** i Parium-loggan, inte
under loggans bounding box (PNG:n har transparent marginal till vänster).

Detta löses med CSS-variabeln `--logo-ring-offset` i `src/index.css`:

```css
:root { --logo-ring-offset: 26px; }
@media (min-width: 1024px) { :root { --logo-ring-offset: 29px; } }
```

Hero-textens motion-div använder:
```tsx
style={{ paddingLeft: 'var(--logo-ring-offset, 26px)' }}
```

**Om loggan byts ut** måste värdet räknas om: mät avståndet från PNG:ns
vänsterkant till mitten av första ringen i Figma/bildverktyg.

## 3. Fluid skalning

- `html { font-size: clamp(0.875rem, 0.8rem + 0.25vw, 1.125rem) }` — alla
  `rem`-värden skalar därför kontinuerligt mellan 14–18px utan brytpunktshopp.
- Hero-rubrik: `font-size: clamp(1.75rem, 4.4vw, 4.75rem)`.
- Telefon-mockup: storlek/zoom beräknas i JS via `clamp()` i `phoneMetrics`.

## 4. Viewport-enheter

Använd alltid `100svh` / `100dvh` istället för `100vh` på overlays och
sektioner som ska fylla skärmen. Detta krävs för att iOS Safari inte ska
göra layouten sönder när adressfältet visas/döljs.

## 5. Breakpoints (Tailwind default)

| Breakpoint | Min width | Typisk enhet |
|------------|-----------|--------------|
| (default) | 0 | iPhone SE → iPhone 14 |
| `sm:` | 640px | Stor mobil / liten tablet |
| `md:` | 768px | iPad portrait |
| `lg:` | 1024px | iPad landscape / laptop |
| `xl:` | 1280px | Desktop |
| `2xl:` | 1536px | Stor desktop / 4K |
| `min-[1100px]:` | 1100px | Anpassad — endast för hero-text Y-offset |

**Regel:** Lägg INTE till `2xl:`-overrides utan explicit godkännande — det
ändrar utseendet på desktop.

## 6. Cross-browser & cross-device

- iOS Safari, Android Chrome, Firefox, Edge, Samsung Internet — fullt stöd.
- `100svh/dvh` har full support sedan 2023.
- Inga User-Agent-sniffar — all responsivitet baseras på `width`/`height`.

## 7. Mobile-first hårda regler (från memory)

- Min touch target: **44px**.
- Inputs: minst **16px** font-size för att förhindra iOS-zoom vid focus.
- Ingen horisontell scroll på mobil (`overflow-x: hidden` på `html`).
- Använd `onPointerDown` (inte `onClick`) för overlays som måste kännas instant.

## 8. Vad som INTE får ändras utan uttrycklig begäran

- Container-värdena i tabell 1 (bryter logo↔hero-alignment).
- `--logo-ring-offset`-värdet (bryter ring-alignment).
- Innehållssektionernas `max-w-[1180px]` (skulle sprida ut kort/text på desktop).
- `clamp()`-värden i `phoneMetrics` (hero-mockup blir fel).

---

Senast uppdaterad: 2026-05-23
