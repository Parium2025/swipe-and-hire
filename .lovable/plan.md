## Mål

Splitta de publika landningssidorna visuellt: **översta delen behåller dagens mörkblå** (hero + de första sektionerna), en **SVG-våg** delar bakgrunden, och **nedre delen blir off-white** (ca `hsl(40 20% 96%)`) med mörk text för premium kontrast.

Gäller endast: `/` (Landing), `/jobbsokare`, `/arbetsgivare` (AudienceLanding). Påverkar **inte** inloggade appen.

## Designprinciper

- **Off-white**, inte ren vit (för premium-känsla): `hsl(40 18% 96%)` ≈ `#F5F2EE`.
- **Vågen** är en mjuk SVG-form i samma off-white (toppen = vågens "fyllning" som sticker upp i blått), inspirerad av bifogad referens men mer subtil/premium (inte tecknad).
- **Brytpunkt** på AudienceLanding: vågen placeras **mellan "Funktioner"-sektionen och "Priser"** — så hero/storytelling stannar i blå premium-mörker, och konvertering (priser/faq/kontakt/CTA-footer) lever i ljus seriös ton.
- På `/` (Landing.tsx, fullscreen hero utan scroll) appliceras **ingen våg** — den sidan har bara en hero, så split blir meningslös. Vi rör inte den.

## Vad som byggs

### 1. Ny komponent: `src/components/landing/WaveDivider.tsx`
- Återanvändbar SVG-våg (full bredd, ~120px hög på desktop, ~70px mobil).
- Props: `fill` (default off-white token), `flip` (för uppåt/nedåt-böjning).
- Använder design-tokens, inga hårdkodade färger.

### 2. Nytt token i `src/index.css`
```css
--landing-light: 40 18% 96%;   /* off-white botten */
--landing-light-foreground: 215 35% 18%;  /* mörk text på ljus */
--landing-light-muted: 215 15% 38%;
```

### 3. `AudienceLanding.tsx` — strukturändring
- Wrappa sektionerna **Priser, FAQ, Kontakt, BouncyFooter** i en `<div className="relative bg-[hsl(var(--landing-light))] text-[hsl(var(--landing-light-foreground))]">` med `<WaveDivider />` placerad ovanpå överkanten.
- AnimatedBackground och FixedPhoneLayer döljs i ljusa zonen (z-index/clip).

### 4. Färgsvep i ljusa zonen (Priser, FAQ, Kontakt, BouncyFooter)
- `text-white` → `text-[hsl(var(--landing-light-foreground))]`
- `text-white/60` → `text-[hsl(var(--landing-light-muted))]`
- `border-white/[0.07]` → `border-black/10`
- `bg-white/[0.04]` glass → `bg-white` med subtil shadow + `border-black/8`
- Sekundärfärgen (secondary/accent) behålls för CTA-knappar — kontrast funkar både ljus och mörk.
- `BouncyFooter` får en separat ljus-variant (props eller intern detektering).

### 5. Ingen ändring på:
- LandingNav (transparent, fungerar mot båda)
- Hero, PinnedHorizontalGallery, Statement, Funktioner (förblir mörk blå)
- Inloggade appen
- Auth/EmailConfirm/övriga publika sidor (kan göras senare om önskat)

## Tekniska anteckningar

- `AudienceLanding.tsx` har root `bg-primary` + inline gradient. Den behålls — ljusa zonen läggs som **eget lager ovanpå** med wave-cut på toppen, så scroll-baserad parallax inte påverkas.
- `FixedPhoneLayer` ligger position:fixed; den är bara aktiv i hero (heroIndex 0), så når aldrig ljusa zonen. Ingen åtgärd.
- `AnimatedBackground` ges en `style={{ clipPath }}` eller döljs via z-index så bubblor inte syns över ljus bakgrund.

## SEO

Inga SEO-ändringar i denna prompt (du sa att vi tar SEO i nästa).

## Begränsningar / Vad denna prompt INTE gör

- Ingen ändring på `/` Landing (bara hero, ingen scroll → split meningslöst).
- Ingen ändring i appen bakom login.
- Inga textuella/innehållsändringar — bara visuell omdaning av nedre tredjedelen.
