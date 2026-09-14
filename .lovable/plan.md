# Systematisk genomgång — sida för sida

Ja, jag håller med: en enda stor granskning blir oöverskådlig och missar detaljer. Vi delar upp den i avgränsade pass, ett per chatt-omgång, med samma checklista varje gång så att inget faller mellan stolarna.

## Så går varje pass till

För varje sida/flöde gör jag:

1. **Läser koden** för sidan och dess hjälpfiler — letar dubbletter, död kod, saker som gör samma sak på två ställen.
2. **Klickar igenom den live** i förhandsvisningen (inloggad, både bred skärm och mobilbredd) — knappar, tomma lägen, felmeddelanden, textbrytning.
3. **Kollar laddningen** — vad hämtas, hur många anrop, cachas det, är sidan varm när man kommer tillbaka, kallstart utan cache.
4. **Kollar bilder och video** — rätt storlek, rätt format, ingen hoppande layout, inga onödigt tunga filer.
5. **Kollar databasfrågorna** — finns index, är de begränsade, håller de med mycket data (jag mäter mot uppblåsta datamängder där det är relevant).
6. **Kollar behörigheter** — att ingen kan se någon annans data på just den sidan.
7. **Rapport**: vad som hittades, vad jag fixade direkt, vad som är kvar och varför.

Allt jag hittar fixar jag i samma pass. Du får en tydlig grön/röd status per pass.

## Ordning på passen

**Arbetsgivarsidan**
1. Start/Översikt + Mina annonser
2. Skapa ny annons (hela guiden) + redigera annons
3. Alla kandidater + kandidatvyn
4. Mina kandidater (listor, steg, flyttar)
5. Statistik
6. Chatt
7. Företagsprofil + intervjuinställningar
8. Utskick & mallar
9. Fakturering, abonnemang, köp
10. Inställningar + notisinställningar
11. Notiscenter, min profil, hjälp & support, tips, logga ut

**Jobbsökarsidan**
12. Start + jobbsök (sök, filter, kartan)
13. Jobbvyn + ansökningsflödet
14. Mina ansökningar + sparade jobb
15. Chatt + intervjuer
16. Min profil, CV, video, flera profiler
17. Notiser, inställningar, konto, radera konto

**Utsidan och grunden**
18. Landningssidan + alla SEO-sidor + publik jobbsida
19. Registrering, inloggning, mejlbekräftelse, återställ lösenord
20. Mejlutskick och bakgrundsjobb (att de går i tid och inte krockar)
21. Slutpass: hela kodbasen — dubbletter, oanvänd kod, startladdningens storlek, sammanfattande betyg

## Vad jag särskilt jagar

- Samma logik skriven två gånger på olika ställen (risk att bara den ena rättas).
- Frågor utan gräns eller index som funkar med 100 rader men dör med en miljon.
- Data som hämtas om i onödan vid varje sidbyte.
- Sidor som är tomma en sekund innan de fylls (dålig kallstart).
- Bilder som laddas i full storlek när en miniatyr räcker.
- Texter som klipps eller inte bryts på små skärmar.
- Fel som bara syns i konsolen och aldrig når användaren.

## Teknisk not

Varje pass avslutas med typkontroll och testsvit. Tyngre laster mäter jag med genererad testdata direkt mot databasen så vi ser verkliga svarstider, inte gissningar. Ändringar hålls inom passets område så vi aldrig bryter något vi redan godkänt.

## Nästa steg

Vi börjar med pass 1: Start/Översikt + Mina annonser.
