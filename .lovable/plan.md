## Mål

Ta bort den scroll-kapande "vi gör det tillsammans"-mekaniken på `/jobbsokare`, så att hjul/touch beter sig 1:1 som på en vanlig premium-sajt (Apple, Linear, Stripe). Behåll allt visuellt — Hero, Intro, wave, bubblor, telefon, galleri, statement, features, stats, testimonials, CTA — och addera diskreta, eleganta scroll-in-animationer per sektion.

## Vad som tas bort (endast scroll-kontroll-logik)

I `src/pages/AudienceLanding.tsx`:
- `HeroIntroStage` GSAP `Observer` (wheel/touch-hijack mellan Hero ↔ Intro)
- `blockNativeInput` + alla `wheel`/`touchmove` capture-listeners på `scrollRoot`
- `releaseAndScrollNext` / `returnFromGalleryToIntro` (programmatisk GSAP scrollTop-tween mellan Intro ↔ galleri)
- `snapStageToTop`, `lockNativeInput`, `withScrollBehaviorAuto`, `transitionBlockUntil`
- Pinned-gallery "wheel back to intro"-tröskeln
- `useLenisOnElement` (Lenis smooth-scroll på scroll-roten) — native scroll är mer förutsägbart och matchar resten av appen

Behåll:
- Hela DOM-strukturen, alla refs, alla sektioner
- Pinned horizontal gallery (den scrollar fortfarande horisontellt när man når den — det är inte scroll-hijack, det är en sticky-sektion med native scroll-driven progress)
- Telefon-anchor och wave-map
- Alla framer-motion `useScroll`-animationer i `LandingFeatures`, `LandingStats`, `LandingForUsers`, `LandingTestimonials`, `LandingHowItWorks`, `LandingStatement`, `LandingCTA`

## Ny struktur för Hero + Intro

Istället för två lager i samma 100svh-yta som byts via Observer:

```text
[ Hero section — 100svh, native scroll ]
[ Intro section — auto-höjd, native scroll, fade+slide-in när den entrar viewport ]
[ Pinned gallery (oförändrad) ]
[ Övriga sektioner (oförändrade) ]
```

- Hero behåller framer-motion-fade på rubrik/CTA
- Intro renderas som en vanlig sektion (inte absolut-positionerad ovanpå Hero)
- Intro-rubrik, paragrafer och CTA fadar/slidar in via framer-motion `whileInView` när sektionen entrar viewport
- Phone-anchor justeras så telefonen ligger kvar i Hero som idag (ingen visuell förändring där)

## Premium scroll-in-animationer (nya)

Skapa en liten återanvändbar `<Reveal>`-wrapper (framer-motion) som används i sektioner som idag saknar entry-animation:

- Default: `opacity 0 → 1`, `y: 24 → 0`, `duration 0.7`, `ease: [0.16, 1, 0.3, 1]` (samma "expo-out" som resten av sajten)
- Varianter: `fade`, `slide-up`, `slide-left`, `slide-right`, `scale`
- Stagger-stöd för listor (cards, stats, testimonials)
- Triggrar via `whileInView` med `viewport={{ once: true, margin: '-10% 0px' }}`
- Respekterar `prefers-reduced-motion` (deaktiverar translate, behåller fade)

Appliceras lätt och konsekvent på:
- Intro-block (rubrik + paragrafer + CTA, stagger 0.08s)
- Statement-sektion (stora citatet fadar in)
- Features-kort (stagger när raden entrar)
- Stats-siffror (count-up finns redan, lägg till container-fade)
- Testimonials-kort (stagger)
- CTA-band (scale-in på knappen)

Inga nya bibliotek. framer-motion finns redan.

## Tekniska detaljer

- Ta INTE bort `gsap`/`gsap/Observer`-importer från projektet (används av PinnedHorizontalGallery internt om det gör det — verifiera först)
- Ta bort `useLenisOnElement`-anropet i `AudienceLanding.tsx`, men behåll själva hooken (kan användas elsewhere)
- Ta bort `parium:hero-index`, `parium:gallery-reset-start`, `parium:gallery-enter`, `parium:gallery-leave`-events som inte längre triggas, OCH deras lyssnare i child-komponenter (sök igenom alla `landing/`-filer först)
- Phone-anchor: behåll `phoneWrapper` wheel-forward eftersom Spline-canvasen fortfarande äter scroll annars
- `data-landing-scroll-root` blir vanlig scroll-container utan Lenis — overflow ändras inte
- Visuell QA: jämför hero/intro/galleri före och efter på desktop + mobil (390px) via browser-tool

## Vad jag INTE rör

- Backend, auth, RLS
- Pinned horizontal gallery's interna scroll-mekanik
- Alla andra sidor/routes
- Design-tokens, färger, fonter, layout
- `EditJobDialog`, `MobileJobWizard`, `ProfilePreview`, `ProfileVideo` (memory-skyddade)

## Risk & verifiering

Detta är en stor refaktor i en 1379-radersfil med tätt sammanflätad scroll-logik. Plan:
1. Implementera i en commit
2. Verifiera /jobbsokare i preview på desktop + mobil
3. Klicka igenom alla CTAs och navigationslänkar (Så funkar det, Funktioner, Priser, Vanliga frågor, Kontakt)
4. Kontrollera att galleriet fortfarande pinnar och scrollar horisontellt
5. Kontrollera att inga console-fel uppstår

Vill du att jag kör det här rakt av, eller vill du först se en mindre PoC bara på Hero ↔ Intro-övergången?
