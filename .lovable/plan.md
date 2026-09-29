# Direkt och enhetlig bildsynk i chatten

## Mål
Personbild och bolagslogga ska bytas konsekvent överallt utan väntetid, tom avatar eller kvarhängande gammal bild. Ingen visuell förändring görs.

## Genomförande
- Uppdatera chattens redan inlästa data direkt efter ett lyckat profil- eller loggbyte, så den egna enheten visar rätt bild utan omladdning.
- Aktivera den befintliga säkra profilsignalen i databasen när namn, personbild eller bolagslogga ändras.
- Låt chatten lyssna på profilsignalen, tömma exakt den berörda personens bild- och profilcache samt hämta om berörda konversationer och öppna meddelanden.
- Behåll identitetsregeln: manuella meddelanden visar personbild/personinitialer; automatiska utskick visar bolagslogga/bolagsinitialer.
- Säkerställ samma flöde för arbetsgivare, jobbsökare och bolagsprofil, inklusive flera flikar och andra enheter.

## Verifiering
- Lägg regressionstester för personbild, bolagslogga, lokal direktuppdatering och live-uppdatering hos motparten.
- Kör relevanta tester, hela testsviten och kontrollera senaste byggstatus.
- Kontrollera att inga inloggnings-, omladdnings- eller designskydd påverkas.

## Tekniskt
- Den befintliga profilcachen töms redan vid vissa sparvägar, men chattens redan renderade data byts inte ut.
- Databasen har en säker tabell och åtkomstregel för profilsignaler, men saknar den trigger/prenumeration som gör kedjan aktiv. Den kopplas nu färdigt med begränsad åtkomst och utan att exponera profilens privata fält.
