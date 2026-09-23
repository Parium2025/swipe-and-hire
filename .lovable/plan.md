# Mobil bildanpassning för jobbkort

## Mål
Mobilens bildredigerare ska visa och spara samma beskärningsyta som det riktiga jobbkortet, återställningsknappen ska fungera förutsägbart och den tomma ytan ska försvinna. Datorflödet ska lämnas oförändrat.

## Ändringar
- Använd jobbkortets exakta bildformat, **2:1**, när mobilbilden anpassas i både skapa- och redigera-jobb-flödet.
- Behåll datorbildens nuvarande format och beteende.
- Placera mobilens beskärningsyta närmare rubriken och kontrollerna direkt under bilden, i stället för att sprida tomrum över dialogens höjd.
- Gör beskärningsytan så bred som mobilen tillåter utan att avvika från jobbkortets proportioner.
- Ändra återställningen så att den återgår till bildens centrerade grundbeskärning i rätt jobbkortsformat och faktiskt sparar det användaren ser. Den ska inte markera bilden som “oredigerad” och sedan tyst byta tillbaka till en annan originalfil vid Spara.
- Säkerställ att dragning och zoomning hålls inom bildens kanter så att tomma ytor aldrig kan sparas.

## Verifiering
- Kontrollera skapa jobb och redigera jobb på mobil: öppna, zooma, dra, återställ, spara och öppna igen.
- Jämför den sparade bilden mot det riktiga jobbkortets 2:1-yta och fokus.
- Kontrollera att profilbildredigering och datorbildredigering inte förändras.
- Kör typkontroll, relevanta tester och produktionsbygge.
