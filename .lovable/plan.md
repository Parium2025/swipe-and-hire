# Mobil bildförhandsvisning – korrekt beskärning och sparning

## Mål
Mobilbilden ska se likadan ut i bildredigeraren, telefonförhandsvisningen och det riktiga Swipe Mode-kortet. Datorvyn ska lämnas oförändrad.

## Ändringar
- Ändra mobilens bildredigering från jobbkortets breda 2:1-format till telefon-/Swipe Mode-formatet 1:2. Det hindrar att en redan bredbeskuren bild förstoras kraftigt i telefonen.
- Behåll den separata fokusväljaren i 2:1. Den fortsätter enbart styra hur samma mobilbild beskärs på de vanliga jobbkortens breda bildyta.
- Synkronisera Swipe Mode-bildens serverstorlek med telefonförhandsvisningens 1:2-format, så ingen extra dold beskärning sker mellan sparning och visning.
- Använd samma regler i både Skapa jobb och Redigera jobb, inklusive dragning, zoom, återställning och sparning.
- Behåll datorbildens nuvarande 16:9-redigering och datorförhandsvisning exakt som de är.

## Verifiering
- Testa skapa och redigera jobb med porträtt-, landskaps- och kvadratisk bild.
- Kontrollera på liten mobilvy att zoom, dragning, återställning och sparning återger samma utsnitt efter återöppning.
- Kontrollera att telefonförhandsvisningen och riktiga Swipe Mode inte får extrem inzoomning eller tomma kanter.
- Kontrollera att 2:1-jobbkortet fortfarande följer den separata fokuspunkten.
- Kör typkontroll, hela testsamlingen och produktionsbygget.

## Bedömning efter test
Rapportera separata betyg för bildredigering, mobilförhandsvisning, jobbkort, Swipe Mode, lagring och datorvy samt en totalbedömning 1–10.
