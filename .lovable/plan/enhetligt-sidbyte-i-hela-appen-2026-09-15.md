# Enhetligt sidbyte i hela appen

## Genomförande
- Identifiera och ta bort överlappande scroll- och sidbyteslogik som kan starta i fel ordning.
- Ge Nästa, Föregående och direkta sidnummer samma enda kodväg: rörelsen startar direkt, innehållet byts under rörelsen och sidan landar färdig högst upp.
- Använd samma struktur på jobbsöket, Sparade jobb, arbetsgivarens översikt och Mina annonser utan visuell omdesign.
- Behåll förladdning och bildcache så nya kort inte laddas synligt efter landningen.
- Verifiera båda riktningarna och olika långa sista sidor i mobil storlek samt köra typkontroll och hela testsuiten.

## Bedömning
- Efter verifieringen betygsätts den berörda sidbyteskoden 1–10, med kvarvarande risker tydligt angivna.

## Avgränsning
- Endast sidnumrerade listor berörs; guider, dialoger och andra Nästa/Föregående-flöden ändras inte.
