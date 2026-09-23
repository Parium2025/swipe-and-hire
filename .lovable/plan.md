# Återställ Safaris färgstyrning utan synlig remsa

## Mål
Återställa den Safari-lösning som fungerade före veckans ändringar, utan att skapa extra höjd, glipor eller påverka sidornas innehåll.

## Genomförande
- Återaktivera topp- och bottenankaret i vanlig Safari på touch-enheter; installerat app-läge behåller sin befintliga safe-area-fyllning.
- Låt vanliga Safari-ankare överlappa sidans befintliga ytterkant i stället för att reservera nytt utrymme.
- Återställ den tidigare beprövade temafärgsuppdateringen som tvingar Safari att läsa om färgen vid sidbyte, men utan gamla långvariga timers eller reload-loopar.
- Behåll exakt nuvarande ruttfärger för startsidan, jobbsökar-/arbetsgivarsidorna, inloggningen och appen.
- Uppdatera regressionsskyddet så vanlig Safari kräver färgankare men noll innehållsförskjutning.

## Verifiering
- Kontrollera startsida, jobbsökarsida och inloggning i mobil Safari-liknande viewport.
- Kontrollera att rätt enda `theme-color` finns efter sidbyte och att färgankarna byter färg direkt.
- Kontrollera att ingen remsa tar layoututrymme eller flyttar sidans innehåll.
- Kör riktade tester och hela testsuiten, samt kontrollera konsol och nätverksfel.
