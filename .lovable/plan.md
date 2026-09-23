# Separera jobbkortets bildfokus från skärmförhandsvisningen

## Ändring
- Låt dragytans fokusvärde styra beskärningen i de rektangulära jobbkorten, precis som texten under bilden anger.
- Koppla bort fokusvärdet från telefon- och datorskärmen i förhandsvisningen så deras fasta bildläge inte flyttas när bilden dras.
- Säkerställ samma beteende när ett jobb skapas och redigeras, utan andra visuella ändringar.

## Teknisk detalj
- Behåll det sparade kortfokusvärdet och dess användning i riktiga jobblistor och arbetsgivarkort.
- Använd fast bildposition i skärmförhandsvisningarna i stället för jobbkortets fokusvärde.

## Verifiering
- Dra fokusbilden och kontrollera att endast jobbkortets beskärning ändras.
- Kontrollera både skapa och redigera jobb på mobil och dator.
- Kör typkontroll och relevanta tester.
