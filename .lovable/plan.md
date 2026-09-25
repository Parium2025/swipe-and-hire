# Stabil mobilskrivning utan hopp

## Mål
Tryck i ett textfält ska öppna tangentbordet utan att sidan flyttas två gånger. När tangentbordet stängs ska vanlig scroll fungera utan att fältet återfår fokus.

## Ändringar
- Ta bort den egna fördröjda fokusningen på `pointerup` för vanliga mobilfält och låt Safari sköta ett normalt tryck.
- Ta bort den fördröjda automatiska scrollen som konkurrerar med Safaris egen tangentbordsplacering.
- Behåll det stabila `100dvh`-skalet, 16 px text, avgränsade skrivytor och den isolerade interna scrollen.
- Behåll fokusfrisläppningen när iOS-tangentbordet faktiskt stängs, så ett efterföljande drag inte öppnar det igen.
- Ta bort den globala tangentbordsberoende scrollmarginalen som påverkar flera nästlade scrollområden samtidigt.

## Kontroll
- Lägg regressionstester för att säkerställa att touch använder webbläsarens normala fokus och inte utlöser egen scroll.
- Kontrollera mallar, företagsprofil och chatt på mobil med öppning, skrivning, stängning av tangentbord och efterföljande scroll.
- Kontrollera tester och aktuell förhandsvisning utan att ändra designen.
