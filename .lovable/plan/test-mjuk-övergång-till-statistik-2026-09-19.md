# Test: mjuk övergång till Statistik

## Resultat
- När **Statistik** väljs i arbetsgivarens sidomeny på mobil stängs menyn utan mellanliggande hack.
- Statistikvyn glider in från höger med samma lugna rörelse och kurva som när en chatt öppnas.
- Övriga sektioner och datorvyn lämnas oförändrade under testet.

## Genomförande
- Märk endast navigeringen till Statistik när den kommer från den öppna mobila sidomenyn.
- Starta den nya vyns rörelse synkroniserat med sidomenyns avslut, utan tom bildruta eller dubbel fördröjning.
- Respektera inställningen för reducerad rörelse.
- Kontrollera på mobilbredd att toppfältet ligger stilla, Statistik börjar högst upp och inga element klipps.

## Verifiering
- Testa sidomeny → Statistik i den körande mobilvyn.
- Kontrollera återbesök och snabb upprepad navigering.
- Kör relevanta tester och typkontroll.
