# Korrigera laddningsvyer i hela Parium

## Mål
Alla skeleton-vyer ska ligga på samma plats, ha samma höjd och följa samma struktur som innehållet som ersätter dem. Ingen färdig vy eller funktionalitet ska ändras.

## Genomförande
- Rätta **Mina kandidater** först:
  - dator: rubrikkort, sökfält, valknapp, stegfilter och riktiga pipeline-kolumner med kandidatrader
  - mobil: rubrikkort, sökfält, valknapp, Swipe-läge, stegflikar och kandidatrader
  - använd senast kända antal kandidater och steg där det finns, utan främmande dashboardkort eller falska sektioner
- Granska samtliga strukturella skeleton-vyer för arbetsgivare: startsida, annonser, alla kandidater, mina kandidater, chattar, företagsprofil, profil och inställningar.
- Granska samtliga strukturella skeleton-vyer för jobbsökare: startsida, sök jobb, sparade/skippade jobb, ansökningar/intervjuer, chattar, profil och profilförhandsvisning.
- Ändra bara de skeletons som faktiskt avviker från sin färdiga sida. Behåll befintliga färger, navigation, innehåll, cache och funktioner.
- Säkerställ att tomma konton inte visar påhittade kort, medan kända listor använder cachat antal utan layoutskifte.

## Teknisk kontroll
- Jämför varje laddningsstruktur med den färdiga sidans aktuella markup och brytpunkter.
- Kontrollera kallstart och återbesök på mobil och dator för båda rollerna.
- Verifiera att övergången från skeleton till innehåll inte hoppar, blinkar, skapar extra scroll eller visar fel navigation.
- Kör berörda tester, kodkontroll och produktionsbygge.
- Kontrollera webbläsarkonsol och nätverksfel under autentiserade tester.

## Leverans
- Redovisa exakt vilka avvikelser som hittades och korrigerades.
- Ge en slutbedömning 1–10, med kvarvarande begränsningar tydligt angivna.
