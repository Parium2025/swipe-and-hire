# Arbetsgivarens Swipe Mode i helkort

## Mål
Arbetsgivarens Swipe Mode ska använda hela kandidatkortet för foto eller profilvideo, i stället för den nuvarande runda medieytan. Kortet ska också kunna dras horisontellt med fingret med samma direkta, mjuka respons som jobbsökarens Swipe Mode.

## Genomförande
- Ändra endast arbetsgivarens kandidatkort i Swipe Mode; kandidatlistor, full profil, desktop och jobbsökarens Swipe Mode lämnas oförändrade.
- Låt kandidatens profilbild, omslagsbild eller profilvideo täcka hela kortytan med korrekt beskärning och mörk läsbarhetsgradient.
- Behåll namn, ålder, ort, urvalskriterier och åtgärdsknappar ovanpå mediet utan överlappning.
- Lägg till horisontell touchdragning på kortet:
  - drag åt vänster går till nästa kandidat,
  - ofullständigt drag fjädrar tillbaka,
  - vertikal rörelse fortsätter byta kandidat som idag,
  - knappar och video­kontroller ska inte feltolkas som swipe.
- Visa kortets rörelse och lätt rotation under draget, så att det känns direkt och likadant som jobbsökarens kort.
- Säkerställ att foto, video, initialer och fallback fungerar i samma helkortsformat.

## Kontroll
- Verifiera på den aktuella mobilstorleken 393 × 580.
- Kontrollera foto, video, initialfallback, horisontell dragning, vertikalt kandidatbyte, knappar och öppning av full profil.
- Köra befintliga tester och kontrollera att inga nya fel eller layoutklippningar uppstår.
