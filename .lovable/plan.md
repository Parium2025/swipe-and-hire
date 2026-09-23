# Jämnt intervjukort med touch-svepning

## Resultat
- Behåll exakt samma yttre höjd som övriga dashboardkort i alla lägen.
- Visa en intervju per kortyta på mindre touchskärmar, utan att innehållet flyttar eller ändrar kortets storlek mellan intervjuer.
- Ge `Pågår nu`/`Avslutad`, `Ta bort`, `Inget svar`/kandidatsvar och `Kalender` samma bredd, höjd, mellanrum och genomskinliga bakgrund.
- Byt de små intervjupunkterna mot samma punktstorlek och placering som statistik-kortet.
- Lägg till horisontell svepning åt båda håll med en mjuk övergång; punkterna ska fortsatt gå att trycka på.
- Begränsa en-intervju-layouten och svepningen till mindre skärmar med touch. Desktoplistan förblir oförändrad.

## Teknisk lösning
- Återanvänd dashboardens gemensamma höjdklass och `DashboardCarouselDots` för visuell paritet.
- Återanvänd projektets befintliga touch- och sveplogik så vertikal sidscroll inte störs.
- Ge varje mobilvy en stabil intern layout med fasta åtgärdskolumner och skydd mot textklippning.
- Animera bytet i samma riktning som svepet och respektera reducerad rörelse.

## Verifiering
- Kontrollera aktiva, pågående, avslutade och avböjda intervjuer i mobil- och surfplatteläge.
- Verifiera vänster/höger-svep, punkttryck, kalender och borttagning utan oavsiktlig kortöppning.
- Kontrollera att samtliga dashboardkort behåller identisk höjd och att desktop inte ändras.
- Kör relevanta tester och produktionskontroll.
