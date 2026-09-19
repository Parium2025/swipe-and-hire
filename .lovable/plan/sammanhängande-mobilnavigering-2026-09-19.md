# Sammanhängande mobilnavigering

## Mål
Sidbyte från mobilmenyn ska kännas som chattens konversationsbyte: nästa sida glider in kontinuerligt medan menyn stängs, utan mellanbild, blinkning eller hopp.

## Genomförande
- Samordna meny-stängning och sidbyte i en gemensam övergång i stället för dagens sekventiella väntan.
- Låt den gamla sidan ligga kvar som stabil bakgrund tills nästa sida är monterad och börjar glida in.
- Använd samma 320 ms-kurva och GPU-transform som chatten, med reducerad rörelse för användare som valt det.
- Behåll desktopbeteendet och befintliga regler för scrollåterställning, osparade ändringar och detaljvyer.
- Tillämpa samma lösning för både arbetsgivare och jobbsökare så att mobilmenyn känns enhetlig överallt.

## Verifiering
- Testa flera menybyten åt båda håll på 393 px mobilvy.
- Kontrollera att toppen ligger kvar, sidan börjar högst upp och att ingen tom bildruta eller dubbel animation syns.
- Kör relevanta tester och kontrollera att inga befintliga flöden påverkas.
