# Återställ videosidans Safari-topp

## Resultat
Videosidans topp ska åter visa samma färg som sidan bakom statusfältet i vanlig iPhone-Safari. Ingen svart remsa, extra höjd eller förskjutning av logotyp och meny får uppstå.

## Ändringar
- Återställ den tidigare fungerande överlappande färgytan i vanlig Safari endast på videosidan.
- Behåll installerat app-läges nuvarande safe-area-yta och avstånd exakt som de är.
- Låt vanliga Safari-ytan överlappa sidan med noll layoutavstånd, så den inte skapar en extra remsa.
- Behåll videosidans befintliga färg `#626262` samt samtliga skydd mot omladdningsloopar oförändrade.
- Uppdatera skyddstestet så videosidan kräver färgytan i vanlig mobil-Safari medan övriga webbsidor fortsatt saknar den.

## Verifiering
- Kontrollera videosidan i iPhone-liknande Safari-storlek: rätt toppfärg, ingen svart lucka och oflyttad meny.
- Kontrollera jobbsökar-, arbetsgivar- och inloggningssidor så deras nuvarande toppbeteende är oförändrat.
- Kör relevanta tester och kontrollera att bygget är grönt.
