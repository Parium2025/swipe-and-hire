# Sammanhängande mobilövergångar

## Mål
Göra sidbyten från mobilmenyn mjukare och mer sammanhängande, särskilt vid kallstart, utan att ändra sidornas design eller desktopupplevelsen.

## Genomförande
- Behåll föregående vy visuellt stabil medan mobilmenyn stängs och nästa sektion blir redo.
- Ersätt den bleka, fristående fade-effekten med en diskret rörelse och opacitetskurva som aldrig exponerar en tom eller svart yta.
- Ge kalla laddningar samma bakgrund och visuella kontinuitet som den omgivande appen, med laddningsindikator först när väntan faktiskt märks.
- Samordna timing mellan meny, navigation och sidans entré för jobbsökare och arbetsgivare.
- Respektera reducerad rörelse och lämna desktop oförändrad.

## Verifiering
- Kontrollera sidbyten och kall laddning i mobil viewport.
- Kontrollera att inga tomma/svarta bildrutor, dubbla animationer eller layoutskiften uppstår.
- Kör relevanta tester och typkontroll.
