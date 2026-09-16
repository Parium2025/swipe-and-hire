# Färdigrenderat sidbyte utan synligt kortskifte

## Mål
När användaren trycker på Nästa, Föregående eller ett sidnummer ska målsidan redan vara komplett — kort, bilder, logotyper och initialer — innan hissen börjar. Inget innehåll får bytas under den synliga rörelsen och själva hissens timing eller känsla ändras inte.

## Genomförande
1. **Dubbelbuffra listan**
   - Behåll den aktuella sidan synlig.
   - Rendera målsidan i en separat, dold buffert utanför synfältet med samma kortkomponenter och mått.
   - Vänta tills React har färdigställt korten och webbläsaren har målat deras bild-, logotyp- och initiallager.

2. **Aktivera målsidan före första rörelsebilden**
   - Växla den färdiga bufferten till aktiv sida innan hissens första synliga bildruta.
   - Bevara aktuell rullposition och sidans höjd, så användaren inte ser växlingen längst ned.
   - Låt därefter den befintliga hissen köra oförändrad till toppen.

3. **Samma lösning överallt**
   - Använd en gemensam dubbelbuffert för jobbsök, sparade/skippade jobb, arbetsgivaröversikten och Mina annonser.
   - Nästa, Föregående och direkta sidnummer går genom exakt samma kodväg.

4. **Rensa den gamla bytespunkten**
   - Ta bort sidans React-byte nära toppen; där ska inget kortinnehåll längre ändras.
   - Behåll bildcache och förladdning som stöd, men låt den färdigrenderade bufferten vara det avgörande kravet.

## Verifiering
- Mobil Safari/WebKit i båda riktningarna, inklusive bild → initialer, initialer → bild, kort sista sida och direkt sidnummer.
- Kontrollera bildruta för bildruta att kortens innehåll är konstant under hela hissen, utan blinkning, dubblering eller nya bildanrop.
- Kontrollera att toppen, knapparna och sidnumret landar rätt.
- Kör typkontroll och hela testsviten.

## Tekniskt
Lösningen blir en gemensam React-hook/behållare för förberedelse och aktivering av en dold målsida. Den befintliga easing-kurvan, varaktigheten och rAF-scrollningen i hissmotorn lämnas oförändrade; endast tidpunkten för när den redan färdiga sidan aktiveras flyttas till före rörelsens första frame.
