
## Mål

Behåll startsidan (`/`) exakt som den är idag: hero med video, "Välkommen till Parium", knapparna **För jobbsökare** / **För arbetsgivare** och login-knappen i nav. Inget rörs där.

När användaren trycker på en av de två knapparna och tas in på `/jobbsokare` eller `/arbetsgivare` ska sidan kännas som en premium, mörk, cinematic Origin-Executive-upplevelse — sektion för sektion, med mjuka scroll-animationer, sticky text, parallax och staggered reveals. Login-knappen i nav följer alltid med.

## Vad som behålls (rörs inte)

- `src/pages/Landing.tsx` — startsidan
- `src/components/landing/LandingHero.tsx` — hero, video, CTA-kort, exit-animation
- `src/components/landing/HeroVideo.tsx` — video-uppspelning
- `LandingNav` — login-knappen alltid synlig
- All routing och `syncBrowserChrome`-logik

## Vad som byggs

### 1. Ny premium-scroll-sida för audience-flödet

`src/pages/AudienceLanding.tsx` skrivs om från en kort statisk vy till en full scroll-upplevelse byggd av sektioner i `src/components/landing/audience/`. Den behåller:

- Den befintliga slide-in-entry-animationen (höger/vänster beroende på roll)
- `LandingNav` med login
- `AnimatedBackground`
- `syncBrowserChrome`

Men byter ut den korta hero-blocken mot en lodrät resa med ~6 sektioner, anpassade per roll (jobbsökare vs arbetsgivare).

### 2. Sektionsstruktur (per roll)

```text
┌───────────────────────────────────────────────────────────────┐
│ Section 1 – Audience Hero                                     │
│   eyebrow → headline rad-för-rad → subtitle → CTA + floating   │
│   mockup/illustration (subtil floating-animation)              │
├───────────────────────────────────────────────────────────────┤
│ Section 2 – Statement (slideLeft headline + slideRight body)   │
├───────────────────────────────────────────────────────────────┤
│ Section 3 – Sticky "Så fungerar det" (sticky text vänster,     │
│   3–4 steg-cards scrollar fram till höger, staggered)          │
├───────────────────────────────────────────────────────────────┤
│ Section 4 – Features grid (4 cards, fadeUp + stagger 0.1s)     │
├───────────────────────────────────────────────────────────────┤
│ Section 5 – Social proof / siffror (parallax glow bakom)       │
├───────────────────────────────────────────────────────────────┤
│ Section 6 – Final CTA (stor knapp → /auth med rätt role)       │
└───────────────────────────────────────────────────────────────┘
```

Innehåll per roll:

- **Jobbsökare**: "Hitta jobb som faktiskt passar dig", fokus på matchning, snabb dialog, profil > CV.
- **Arbetsgivare**: "Hitta rätt människor snabbare", fokus på kvalificerade kandidater, smidigare urval, tydliga nästa steg.

### 3. Animationsbibliotek (delat)

Ny fil `src/components/landing/audience/motionPresets.ts` exporterar variants som följer briefen exakt:

```ts
const ease = [0.16, 1, 0.3, 1] as const;
export const fadeUp     = { hidden:{opacity:0,y:40},  visible:{opacity:1,y:0,  transition:{duration:0.8, ease}} };
export const slideLeft  = { hidden:{opacity:0,x:-80}, visible:{opacity:1,x:0,  transition:{duration:0.9, ease}} };
export const slideRight = { hidden:{opacity:0,x:80},  visible:{opacity:1,x:0,  transition:{duration:0.9, ease}} };
export const stagger    = { hidden:{}, visible:{ transition:{ staggerChildren:0.12, delayChildren:0.05 }}};
```

Alla sektioner använder `motion.* whileInView="visible" viewport={{ once:true, amount:0.25 }}` så animationen triggas när ~25 % av elementet syns. Befintliga `ScrollReveal`/`StaggerReveal` återanvänds där det passar.

### 4. Parallax & sticky

- `useScroll({ target: sectionRef, offset:['start end','end start'] })` per sektion (enligt befintlig konvention och landing-isolation-policyn — aldrig mot window).
- Subtila `useTransform` på dekorativa glow-blobs (±60–120 px y-translate, opacity 0.4→0.7).
- Sticky-sektion: `sticky top-24` på vänster kolumn, höger kolumn scrollar normalt med staggered cards.

### 5. Hero rad-för-rad

Audience-hero animerar i ordning via `staggerChildren: 0.18`:
eyebrow → headline → subtitle → CTA-rad → floating mockup (`animate={{ y:[0,-8,0] }}` loop, 6s, ease-in-out).

### 6. Tillgänglighet & mobil

- Alla `motion.*`-element wrappas så att `prefers-reduced-motion: reduce` ⇒ animationer ersätts av direkt `opacity:1`. Lägger en helper `useReducedMotionSafe()` eller använder framer-motions inbyggda `useReducedMotion()`.
- Sticky-sektioner stängs av < `md` (blir vanlig vertikal stack).
- Touch-targets ≥ 44 px, CTA-knappar oförändrade i storlek.
- Inga horisontella overflow — varje `section` får `overflow-hidden` på x-led.

### 7. Färg & känsla

Behåller befintliga semantiska tokens i `index.css` (mörk `--background`, vit text, `--secondary` som accent). Ingen hårdkodad palett läggs in — om accentnyansen ska skiftas mot champagne/guld så justeras `--secondary` i `index.css` separat efter ditt godkännande (inte i denna plan).

## Filer som skapas

- `src/components/landing/audience/motionPresets.ts`
- `src/components/landing/audience/AudienceHero.tsx`
- `src/components/landing/audience/AudienceStatement.tsx`
- `src/components/landing/audience/AudienceHowItWorks.tsx` (sticky)
- `src/components/landing/audience/AudienceFeatures.tsx`
- `src/components/landing/audience/AudienceProof.tsx`
- `src/components/landing/audience/AudienceFinalCTA.tsx`
- `src/components/landing/audience/content.ts` (texter per roll)

## Filer som ändras

- `src/pages/AudienceLanding.tsx` — komponerar sektionerna ovan, behåller nav, bakgrund och slide-in-entry.

## Filer som inte rörs

- `src/pages/Landing.tsx`
- `src/components/landing/LandingHero.tsx`
- `src/components/landing/HeroVideo.tsx`
- `LandingNav`, `AnimatedBackground`, `browserChrome.ts`
- Alla "skyddade" filer i memory (EditJobDialog, MobileJobWizard, ProfilePreview, ProfileVideo)

## Out of scope (gör vi inte nu)

- Inga ändringar på `/` (startsidan)
- Inga nya färgtokens / temaskift
- Inga bilder/videoassets genereras — placeholder-mockup blir en CSS-glass-card tills du ger en riktig asset
- Ingen ny copywriting utöver utkast — du får finslipa texten efteråt
