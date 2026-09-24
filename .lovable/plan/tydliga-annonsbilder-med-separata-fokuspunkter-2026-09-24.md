# Tydliga annonsbilder med separata fokuspunkter

## Mål
Gör bildvalet begripligt och konsekvent utan övriga designändringar:

- **Annonsbild** används i jobbkort, söklistor och Swipe Mode.
- **Bild i annonsen** används när en jobbsökare öppnar hela annonsen, på alla skärmstorlekar.
- Om ingen separat bild i annonsen valts används annonsbilden som reserv.

## Ändringar
1. Byt de nuvarande benämningarna “Mobilbild” och “Datorbild” till “Annonsbild” och “Bild i annonsen” i både skapa- och redigera-flödet.
2. Uppdatera hjälptexter och kopieringsknappar så de beskriver var bilderna faktiskt visas.
3. Visa en egen fokusväljare under båda bilderna, alltid när respektive bild finns.
4. Spara annonsbildens fokus och den öppnade annonsbildens fokus separat.
5. Använd rätt fokuspunkt i jobbkort/Swipe Mode respektive den öppnade annonsen och den publika annonslänken.
6. Behåll befintlig reservlogik för äldre annonser och annonser som bara har en bild.

## Verifiering
- Skapa och redigera annons: båda bilderna kan väljas, anpassas och fokuseras oberoende.
- Jobbkort/Swipe Mode visar annonsbilden med dess fokus.
- Öppnad och publik annons visar “Bild i annonsen” med dess fokus på mobil, surfplatta och dator.
- Sparade värden finns kvar efter stängning och återöppning.
- Bygg och relevanta tester passerar.
