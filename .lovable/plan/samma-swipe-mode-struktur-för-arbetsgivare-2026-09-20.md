# Samma Swipe Mode-struktur för arbetsgivare

## Mål
Arbetsgivarens Swipe Mode ska använda samma visuella och tekniska struktur som jobbsökarens Swipe Mode: samma kortstack, rörelse, nästa-kort-underlag, prickindikator och fasta åtgärdsrad.

## Beteende
- Vänstersvep nekar/hoppar över kandidaten i den aktuella öppna genomgången och visar nästa kandidat.
- Nekandet sparas inte, flyttar inte kandidaten till ett fack och tar inte bort kandidaten. När Swipe Mode öppnas igen finns kandidaten kvar.
- Högersvep öppnar kandidatens fullständiga information, motsvarande hur högersvep öppnar jobbinformation på jobbsökarsidan.
- Vertikalt svep fortsätter navigera mellan kandidater.
- Ofullständiga sidodrag fjädrar tillbaka och knappar/video får inte feltolkas som svep.

## Genomförande
- Återanvänd jobbsökarens gemensamma gestmotor, timing, fjädrar och `SwipeDots` i stället för att skapa en separat förenklad kopia.
- Anpassa kandidatkortet till samma aktiva kort + förberett nästa kort-struktur, inklusive dragrotation, skalning, feedback och sömlös överlämning.
- Ge kandidatvyn samma fasta huvudrad, pricknavigation och åtgärdsrad. Kandidatens befintliga Spara och Visa information behålls med kandidatanpassade etiketter; neka och ångra fungerar endast lokalt under den öppna genomgången.
- Behåll kandidatens foto, video, initialfallback, filterrad och profilöppning. Jobbsökarens Swipe Mode ändras inte funktionellt.
- Säkerställ att alla tre arbetsgivaringångarna till Swipe Mode får samma beteende.

## Kontroll
- Verifiera vänster = neka/nästa, höger = information, vertikal navigation, återfjädring, prickar och ångra.
- Stäng och öppna Swipe Mode igen och bekräfta att nekade kandidater fortfarande finns kvar och ligger i samma fack.
- Kontrollera foto, video, initialer, Spara, full profil och filter på mobil.
- Kör typkontroll, befintliga tester och kontroll av kodändringarna.
