# Slutför global textsäkerhet och layoutverifiering

## Mål
Göra gränssnittet robust mot extremt långa namn, rubriker och backendtexter utan överlapp, klippning eller layoutförskjutningar.

## Genomförande
1. Åtgärda grundorsaken i chattens swipe-rader så dolda åtgärder aldrig kan blinka, överlappa eller ärva gammalt visuellt tillstånd.
2. Rätta React-varningen i `NewConversationDialog` genom korrekt ref-hantering.
3. Täppa till alla redan identifierade overflow-luckor utanför chatten, främst supportadmin, driftstatus, analys, frågefilter, karriärtips och mobilkort.
4. Använd tooltip för trunkerad dynamisk text utanför chatten; chatten behåller ren trunkering utan tooltip.
5. Hantera de tre befintliga orimligt långa annonstitlarna vars data skapades före den nya längdgränsen, utan att förstöra originalinnehåll godtyckligt.
6. Lägg fokuserade regressionstester för trunkering, dialog-ref och extrema strängar där testmiljön stödjer det.

## Teknisk verifiering
- Kontrollera bygg-/testresultat efter ändringarna.
- Kör appen med extrema strängar och kontrollera faktisk DOM-bredd, horisontell overflow och konsolfel.
- Verifiera desktop (1463 px), iPad stående/liggande och mobil.
- Bekräfta att ingen relevant vy får horisontell sidscroll, överlappande text eller saknad fulltext-tooltip utanför chatten.
