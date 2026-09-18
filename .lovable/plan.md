# Stabilisering av mobil landning och Safari-färger

## Mål
Ta bort dagens dubbelstyrning och återfå en förutsägbar mobilupplevelse utan att ändra appens design, texter eller funktioner.

## Bekräftade fynd
- **6 överlappande kodgrupper** styr samma beteenden på flera ställen:
  1. Rutt → topp-/bottenfärg definieras tre gånger plus i första sidladdningen.
  2. Topp- och bottenremsan har nästan identisk färg-, rutt- och eventlogik.
  3. Sidans bakgrund, webbläsarfärg, CSS-variabler och remsor uppdateras av flera konkurrerande mekanismer.
  4. Bottenutrymme styrs både från JavaScript och flera CSS-regler.
  5. Landningssidorna förladdas både på tomgång, vid pekning och via routern.
  6. Spline-scenen förladdas från flera separata filer.
- **3 döda deklarationer** finns kvar i landningssidan: två oanvända hooks och deras enda hjälpfunktion.
- Dagens SSR-skydd, Spline-skydd, kalender/mejl och realtidsfixar är separata och ska behållas.

## Genomförande
1. Skapa en enda gemensam källa för ruttens webbläsarfärg och ruttklassning.
2. Låt första sidladdningen och senare sidbyten använda samma färgregler, utan dubbla färgkartor.
3. Slå ihop topp- och bottenremsornas gemensamma logik i en liten intern hook; behåll separata visuella remsor.
4. Välj en enda ägare för CSS-variablerna för topp- och bottenutrymme och ta bort konkurrerande skrivningar.
5. Behåll omedelbar navigation, men konsolidera all målroute-/Spline-förladdning till en idempotent funktion.
6. Ta bort de tre bekräftat döda deklarationerna.
7. Behåll CSS-baserad mobil/desktop-växling som förhindrar hydration-krasch och dubbla H1.

## Verifiering
- Kontrollera `/`, `/jobbsokare` och `/arbetsgivare` med kallstart och sidbyte i båda riktningar.
- Testa mobil 393×580 samt desktop, inklusive svart/grå topp, bottenfärg, storlekshopp och blinkning.
- Kontrollera att endast en `theme-color` finns och att inga hydration-, konsol- eller nätverksfel uppstår.
- Kör befintliga tester och riktade regressionstester för färgkartning, touch/desktop och omedelbar navigation.

## Säkerhetsgräns
Ingen total återställning och inga visuella redesignändringar. Endast dubbelkodning, dödkod och konkurrerande styrning i den berörda mobil-/landningskedjan ändras.
