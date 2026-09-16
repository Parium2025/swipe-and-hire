# Eliminera bildblinkningen vid sidbyte

## Mål
Nästa, Föregående och sidnummer får starta först när exakt de kortbilder och logotyper målsidan visar är hämtade och avkodade. Själva hissrörelsen ändras inte.

## Genomförande
- Samla bildförberedelsen i en gemensam kodväg för alla fyra sidnumrerade listor.
- Förbered föregående, aktuell och nästa sida med exakt samma bildadress, storlek och version som kortet använder.
- Lägg en beredskapskontroll före sidbytet: om målsidan ännu inte är färdig väntar bytet på bilderna i stället för att skapa bildytor under hissen.
- Ta bort de parallella och avvikande förladdningsvägar som värmer originalbild eller fel variant.
- Behåll senaste fungerande hisskod, hastighet och kurva helt oförändrade.

## Verifiering
- Mäta nätverk, avkodning och bildstatus under Nästa och Föregående i mobil WebKit.
- Kontrollera jobbsök, Sparade jobb, arbetsgivarens översikt och Mina annonser, inklusive kort sista sida.
- Köra typkontroll och hela testsviten.
