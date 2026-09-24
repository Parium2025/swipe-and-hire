# Exakt bildfokus och verklighetstrogen förhandsvisning

## Ändring
- Gör fokusdragningen exakt genom att bevara hela bildens höjd fram till den synliga beskärningen; samma fokusvärde ska ge samma utsnitt i justeringsytan, jobbkortet, Swipe Mode och den öppnade annonsen.
- Gör dragningen robust när pekaren lämnar ytan eller släpps längst ned, så musen aldrig kan fastna i dragläge.
- Låt mobilens framsida använda samma visuella Swipe Mode-källa som den riktiga vyn, inklusive bild, logga, företagsnamn, titel, uppgifter och åtgärder.
- Låt datorns framsida fortsätta använda det riktiga sökresultatskortet, med korrekt verklig kortbredd och maximal skala inom skärmen utan förvrängning.
- Visa direkt under Mobilvy/Datorvy vilken verklig vy som förhandsvisas: Swipe Mode respektive sökresultat.
- Behåll klicket på respektive framsida så att den gemensamma, verkliga annonsvyn öppnas.

## Kontroll
- Dra båda fokuspunkterna till ändlägen och mittläge med mus och touch; jämför samma utsnitt i alla motsvarande vyer.
- Släpp musen både inne i och utanför dragytan och kontrollera att dragläget alltid avslutas.
- Jämför all synlig information, logga, bild, datum, lön, förmåner och knappar mot de riktiga vyerna med samma data.
- Kontrollera mobil- och datorstorlekar samt hela den öppnade annonsen genom scrollning.
- Kör tester, typkontroll, bygge och kontrollera konsol-, körnings- och nätverksfel.

## Tekniskt
- Undvik serverbeskärning före `object-position`; optimera bilden utan att kasta bort den del som fokusreglaget behöver kunna visa.
- Återanvänd befintliga verkliga kortkomponenter eller deras gemensamma visuella kärna i stället för fristående kopior.
