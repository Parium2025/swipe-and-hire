## Plan: Uppdatera hero-rubrik och subtitle på landningssidan

### Vad som ska göras
1. **Ersätt h1-texten** `"Välkommen till Parium"` i `LandingHero.tsx` med samma logga som används i headern (`parium-logo-rings.png`). Loggan visas centrerat ovanför subtitle med samma Framer Motion-entrè-animation.
2. **Uppdatera subtitle-texten** från `"Rekrytering på 60 sekunder. Swipea, matcha och anställ."` till `"Oavsett om du söker jobb eller rekryterar så finns vi här för dig!"`.
3. **Gör subtitle kritvit** — byt från `text-white/80` till `text-white`.

### Tekniska detaljer
- Importera `pariumLogoRings` från `"@/assets/parium-logo-rings.png"` i `LandingHero.tsx`.
- Byt ut `<motion.h1>` mot en `<motion.div>` som renderar `<img src={pariumLogoRings}>`.
- Bibehåll befintliga `initial`/`animate`/`transition`-värden för motion.
- Loggstorlek: responsiv skalning (~h-14 till h-24 beroende på breakpoint) för att matcha hero-proportionerna.
- Subtitle-p-taggen behåller sina motion-props, endast text och klass ändras.

### Berörda filer
- `src/components/landing/LandingHero.tsx`

Inga databasändringar, inga nya dependencies.