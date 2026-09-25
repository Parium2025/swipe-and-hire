# Ta bort den extra mobilramen

## Resultat
Toppen ska alltid ha samma kompakta placering som i den bifogade bilden med tangentbordet öppet. Ingen extra mörk remsa får visas eller täcka sidhuvudet när tangentbordet är stängt.

## Ändringar
- Sluta rendera den överliggande toppremsan i vanlig Safari och andra mobila webbläsare.
- Behåll nödvändigt utrymme kring statusfältet endast i installerat app-läge, där skärmen annars kan hamna under telefonens urtag.
- Uppdatera skyddstesterna så tangentbordets öppna och stängda läge ger samma topp i vanlig mobilwebbläsare.
- Inventera alla skrivfält och säkerställa att de använder den gemensamma stabila fokuslösningen; dolda filfält lämnas orörda.
- Kontrollera arbetsgivar- och jobbsökarskal i mobilstorlek samt att bygget är grönt.

## Tekniskt
- Webbläsarens systemfärg fortsätter styras av sidans befintliga färgsynkronisering, utan en visuell overlay över innehållet.
- Installerat läge behåller en enda ägare av safe-area-avståndet.
