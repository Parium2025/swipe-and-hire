# Inställningar utan vänteläge och utan utvecklarvy

## Genomförande
- Låt `/settings` alltid öppnas med samtliga sektioner stängda. Undantaget är en uttrycklig direktlänk till aviseringar, som fortsatt öppnar rätt sektion.
- Behåll inställningsinnehållet monterat även när panelerna är stängda, så data för Teamet, automatiska utskick, mallar, sessioner och integritet börjar laddas direkt när sidan nås och är redo vid öppning.
- Förbättra Teamets datahämtning från en fråga per medlem till en samlad hämtning och lägg till användarspecifik, validerad lokal cache med bakgrundsuppdatering för omedelbar återvisning.
- Behåll befintlig cache, realtidssynk och sparlogik för automatiska utskick och mallar; verifiera att ändringar fortfarande sparas i databasen och återläses korrekt.
- Ta bort den synliga utvecklarvyn från både arbetsgivar- och jobbsökargränssnittet samt rensa dess särskilda preview-state och navigeringskopplingar. Vanlig onboarding, adminbehörighet och interna supportsidor lämnas orörda.

## Verifiering
- Kontrollera `/settings` vid första besök, återbesök och omladdning: alla paneler stängda, inga data-pop-ins när Teamet eller Automatiska utskick öppnas.
- Kontrollera direktlänken `#notifications`.
- Kontrollera att utvecklarvyn inte längre renderas på desktop, surfplatta eller mobil.
- Testa öppna/stänga paneler och relevanta sparflöden utan konsol- eller nätverksfel.

## Tekniskt
- Radix Accordion `forceMount` används för förladdning utan att visuellt öppna panelerna.
- Cache isoleras per användare och valideras innan användning; backend förblir sanningskälla och uppdaterar cachen i bakgrunden.
