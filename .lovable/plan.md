# Stabil frågefiltrering och tydligt Swipe-läge

## Det här ändras
- Flytta laddningssignalen från sökfältets högra hörn till filterområdet och göra den diskret, centrerad och stabil.
- Behålla nuvarande kandidatkort synliga medan ett nytt filter hämtas, utan att profilbilder får fyrkantiga mellanlägen eller blinkar.
- Visa aktiva frågefilter högst upp i Swipe-läget, med trunkering och möjlighet att se hela frågan när det behövs.
- Låta samma filterinformation följa med på varje kandidatkort under hela Swipe-sessionen.
- Säkerställa att Swipe-läget öppnas med exakt det färdiga filtrerade resultatet, inte föregående resultat under pågående hämtning.
- Förtydliga kandidatprofilens historiska text så den säger att frågan tagits bort från annonsen men att kandidatens sparade svar fortfarande visas.

## Verifiering
- Kontrollera frågefilter för `Alla`, exakta Ja/Nej-svar och flervärdessvar.
- Kontrollera mobil laddning, profilbilder och Swipe-läge i 393 px bredd.
- Köra projektets tester och typkontroll.

## Tekniskt
- Aktiva filter skickas som visningsdata till den befintliga Swipe-vyn; databasens befintliga korrigerade filtrering förblir källan till kandidaturvalet.
- Avatarens befintliga cirkulära ram behålls monterad mellan bildstatusar för att undvika fyrkantig ommålning.
