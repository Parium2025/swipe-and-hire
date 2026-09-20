# Stabil mobilchatt på iMessage-nivå

## Resultat
- Skrivfältet ligger stabilt direkt ovanför tangentbordet utan vit/blå blinkning.
- Senaste meddelandet förblir synligt när tangentbordet öppnas, när ett meddelande skickas och när tangentbordet stängs.
- Korta konversationer ligger längst ned nära den vita skiljelinjen i stället för högt upp med ett stort tomrum.

## Genomförande
1. Ta bort den konkurrerande tidsstyrda tangentbordslogiken i chatten och använda en enda bottenankring kopplad till den synliga mobilhöjden.
2. Förhindra iOS automatisk fokuszoom genom att ge skrivfältet minst 16 px textstorlek på mobil.
3. Göra meddelandeytans interna innehåll explicit fullhögt och bottenjusterat, utan att förlita sig på ScrollArea-wrapperns implicita mått.
4. Behålla fokus efter skickning och ankra omedelbart utan mjuk scroll, så inget mellanläge kan målas.
5. Begränsa ändringen till chatten och mobilskalet; desktop och övriga sidor ska behålla sitt nuvarande utseende.

## Verifiering
- Testa öppning/stängning av tangentbord, flera skickningar i följd och både korta och långa trådar i mobilstorlek.
- Kontrollera att header, senaste bubbla, skiljelinje och skrivfält aldrig försvinner eller hoppar.
- Köra tester, typkontroll, produktionsbygge och kontroll av kodändringarna.

## Teknisk detalj
Safari rapporterar flera tillfälliga `visualViewport`-mått under fokus och tangentbordsanimation. Nuvarande kod reagerar både i appskalet och inne i chatten, samtidigt som skrivfältets mobiltext kan trigga fokuszoom. Lösningen gör skalet till ensam källa för synlig höjd och låter chatten endast sköta sin interna bottenposition.
