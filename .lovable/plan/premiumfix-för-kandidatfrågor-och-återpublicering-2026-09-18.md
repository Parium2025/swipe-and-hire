# Premiumfix för kandidatfrågor och återpublicering

## Mål
Göra frågefiltret korrekt och lättanvänt på mobil, säkerställa att samma filtrerade kandidater används i listan och Swipe Mode samt ta bort det kvarvarande tomrummet i återpubliceringsdialogen.

## Ändringar
- Ändra mobilinteraktionen i frågefiltret:
  - vanligt tryck öppnar eller stänger svarsalternativen direkt
  - långtryck visar hela en trunkerad fråga utan att samtidigt öppna en annan meny
  - desktop behåller hover-tooltip
  - touch-timers och tillstånd städas korrekt för att undvika fastnade overlays
- Rätta serverfiltreringen av kandidatfrågor:
  - slå upp frågans ID via varje ansökans frysta `questions_snapshot`
  - matcha svaret på rätt ID i `custom_answers`
  - `Alla` betyder att kandidaten faktiskt har ett icke-tomt svar på den valda frågan
  - Ja/Nej och övriga val matchas exakt, skiftlägesokänsligt och utan falska delsträngsträffar
  - flervärdessvar som lagras med `|||` matchas per enskilt val
  - behåll befintlig RPC-signatur så frontend och äldre klienter fortsätter fungera
- Verifiera att listans räknare, pagination och Swipe Mode använder samma korrigerade RPC-resultat; ingen separat klientfiltrering införs.
- Förtydliga fallbacktexten för historiska frågor till att frågan inte längre finns i den aktuella annonsen, medan kandidatens sparade svar fortsatt visas.
- Ta bort den dubbla vertikala marginalen i dialogen ”Redigera annonsen först”, utan andra designändringar.

## Teknisk kontroll
- Lägg korrigeringen i en ny Supabase-migration och bevara behörigheterna för `authenticated`.
- Lägg regressionstester för exakt svarsmatchning, `Alla`, saknade svar, snapshot-ID och flervärdessvar.
- Kör projektets tester och kontrollera typningen.
- Kontrollera mobilflödet för frågerad, långtryck, svarsalternativ, räknare och Swipe Mode samt dialogens avstånd.
