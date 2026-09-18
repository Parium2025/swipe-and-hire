# Frågefilter och kandidatlistor på mobil

## Ändringar
- Anpassa frågemenyn efter mobilens synliga höjd så att frågeräknaren och **Rensa alla filter** alltid går att nå, även när en fråga expanderas.
- Låt frågelistan själv rulla och håll sökfält samt nedersta åtgärder stabila. En vald svarstyp ska inte flytta menyn utanför skärmen.
- Ta bort den kvarhängande tryckmarkeringen på frågerader och svarsalternativ på touch, utan att påverka valt filter eller tangentbordsfokus på dator.
- När en kandidat redan finns i den egna listan visar listväljaren även en tydlig destruktiv åtgärd för att ta bort kandidaten från den egna listan.
- Bekräfta borttagning innan den genomförs, ta bort rätt rad för inloggad arbetsgivare och uppdatera kandidatstatus, listantal och vy direkt efteråt.
- Behåll möjligheten att flytta kandidaten mellan egna listor och lägga till den i en kollegas lista.

## Teknisk kontroll
- Använd befintliga behörighetsregler och samma medlemskapskälla som den gröna kandidatstatusen.
- Verifiera mobilmenyn vid 393 × 581, inklusive expanderad fråga, nedersta åtgärder och touchmarkering.
- Kör befintliga tester och typkontroll.
