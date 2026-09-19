# Stabil mobil topp, långtryck och felvy

## Ändringar
- Förhindra att mobilens toppavstånd läggs på först efter inloggning, så den tillfälliga svarta randen/dubbelramen inte blinkar fram.
- Låta avkortade aktiva frågefilter visa hela texten med långtryck på mobil, medan vanligt tryck och krysset fortsätter fungera som nu.
- Uppdatera felvyn så **Försök igen** verkligen gör en ren omladdning och **Till startsidan** navigerar korrekt.
- Ge båda felknapparna samma mörka glasfärg, kant och kritvita text; ingen vit knapp.

## Avgränsning
- Ingen annan design, desktoplayout eller filterlogik ändras.
- Bilden används bara som visuell referens.

## Verifiering
- Kontrollera mobil första inloggningsrendering utan höjdhopp i toppen.
- Kontrollera vanligt tryck, långtryck och borttagning på det avkortade filtret.
- Kontrollera båda felknapparnas funktion och utseende samt köra befintliga tester.
