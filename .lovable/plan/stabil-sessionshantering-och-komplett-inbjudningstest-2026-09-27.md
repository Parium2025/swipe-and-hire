# Stabil sessionshantering och komplett inbjudningstest

## Mål
- Varje konto får ha tre aktiva enheter samtidigt, oberoende av om kontot är jobbsökare eller arbetsgivare.
- En fjärde enhet avslutar den äldsta sessionen för just det kontot.
- Kontobyte eller utloggning i en Safari-flik får inte skapa omladdningsloopar eller påverka ett annat konto i en annan flik.
- En teaminbjudan ska fungera korrekt från utloggat läge och ge tydliga stopp för fel konto eller jobbsökarkonto.

## Genomförande
1. Ändra den centrala sessionsgränsen från två till tre i databasen och synka texten under Aktiva sessioner.
2. Behåll sessionsräkningen strikt per användarkonto och samma webbläsare som en enhet, även med flera flikar.
3. Separera autentiseringshändelser mellan flikar så att en annan fliks inloggning inte kan starta en omdirigerings- och återställningsloop i den aktuella fliken.
4. Gör fjärrutloggning enkelriktad: avslutad session rensas lokalt och går en gång till inloggningen utan automatisk återupplivning.
5. Säkerställ att manuell utloggning stoppar alla samtidiga uppdateringar innan nästa konto loggas in.
6. Lägg till automatiska regressionstester för tre tillåtna enheter, fjärde enheten, äldsta sessionen, två konton i samma Safari, manuell utloggning och återgång till teaminbjudan.
7. Kör befintliga tester och verifiera de centrala flödena i webbläsaren på dator- och mobilstorlek utan visuella ändringar.

## Verifieringsmatris
- Jobbsökare: dator + mobil + surfplatta kvar; fjärde enheten avslutar den äldsta.
- Arbetsgivare: samma regel och helt egen sessionsmängd.
- Två olika konton i separata Safari-flikar: inget konto byts, ingen loop uppstår.
- Manuell utloggning: kontot förblir utloggat och nästa inloggning fungerar direkt.
- Inbjudningslänk: utloggad återvänder efter inloggning; fel mejl stoppas; jobbsökarkonto stoppas; rätt arbetsgivarkonto accepterar; återanvänd länk nekas.

## Tekniskt
- Databasfunktionerna för registrering, återregistrering och hård sessionsgräns får samma värde: tre.
- Klientens flikhändelser valideras mot flikens faktiskt lagrade konto innan de får ändra användare eller navigera.
- Ingen design eller övrig funktionalitet ändras.
