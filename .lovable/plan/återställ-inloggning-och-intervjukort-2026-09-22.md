# Återställ inloggning och intervjukort

## Åtgärder
- Stabiliserar appens sidladdning genom att sluta tvinga Vite att bygga om alla beroenden vid varje start. Det är den omladdningen som gjorde att startsidans modul tillfälligt försvann och visade felrutan i stället för inloggat läge.
- Låter intervjukortet hämta även intervjuer med status `completed` under de senaste 24 timmarna. De finns kvar i databasen men filtreras just nu bort efter att den automatiska slutföringen ändrar status.
- Behåller nuvarande regler: framtida/pågående intervjuer visas, avböjda och avslutade visas i 24 timmar eller tills arbetsgivaren tar bort dem.

## Verifiering
- Startar om förhandsvisningen en gång efter ändringen och kontrollerar att den skyddade startsidan laddas utan modulfelet.
- Testar som inloggad arbetsgivare att intervjukortet visar den pågående intervjun samt nyligen avslutade och avböjda intervjuer.
- Kontrollerar konsol, nätverk och aktuella data efter testet.
