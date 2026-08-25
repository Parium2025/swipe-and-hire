# Slutför arbetsgivarsidan med verifierad text- och funktionssäkerhet

## Mål
Ta bort godtyckliga korta textgränser utan att skapa layoutfel och göra en evidensbaserad slutverifiering av hela arbetsgivarprodukten. Ingen del ska kallas klar enbart för att den ser implementerad ut.

## Bekräftat nuläge
- Databasen begränsar just nu jobb- och malltitlar till 160 tecken samt mallnamn till 100 tecken.
- Frontend begränsar dessutom kandidatlistnamn till 40 tecken och företagsnamn/plats via gemensamma gränser.
- De tidigare nämnda talen 15, 11 och 16 var observerade datalängder, inte gränser. Den tidigare formuleringen var missvisande.
- En tidigare migration kapade redan äldre jobbtitlar över 160 tecken. Originaltexten kan inte återskapas säkert från nuvarande tabell; befintliga värden lämnas därför orörda om ingen separat källa eller backup finns.
- Betalning är inte implementerad: checkout visar “kommer snart”, ekonomisidan innehåller exempeldata och flera betalningsknappar saknar funktion.
- Team-inbjudan är också ofärdig: den visar framgång trots att inget backendanrop eller mejl skickas.
- Dashboard, annonser, kandidater, Mina kandidater, chatt, mallar/regler/utskick, intervjuer, analys, notiser, profiler, recensioner och support har verklig klient- och backendlogik. Det bevisar implementation, men inte ännu fullständig end-to-end-kvalitet.

## Genomförande

### 1. Bevara originaltext och ta bort godtyckliga gränser
- Ta bort databasreglerna för jobb-/malltitel och mallnamn med en ny migration; gamla migrationsfiler ändras inte.
- Ta bort frontendens `maxLength` för jobb-/malltitlar, mallnamn, företagsnamn, kandidatlistnamn och ort/plats.
- Ta bort `clampJobTitle` ur datamappning, cache och preload så att samma fullständiga titel följer med genom systemet.
- Behåll endast semantiskt motiverade gränser för strukturerade eller särskilda fält, exempelvis telefon, organisationsnummer, verifieringskod och tekniska metadata. Långa fritextfält granskas separat och ska inte blandas ihop med layoutbegränsningar.

### 2. Härda alla visningsytor för långa värden
- Inventera varje renderingsyta för jobb-/malltitel, företag, kandidatlista och ort.
- I kompakta ytor: använd riktig ellips, `min-w-0` och fulltext-tooltip utanför chatten.
- I detaljvyer och formulär: låt texten brytas naturligt utan att originalet kapas.
- Chatten behåller ren trunkering utan tooltip enligt tidigare beslut.
- Särskilt verifiera swipe-kortets jobbtitel, kandidatlistdialoger/listväljare, analysrader, mallkort, jobbkort och profilhuvuden.

### 3. Slutgranska skapa jobb och mallar
- Testa skapa, spara utkast, redigera, publicera, pausa, återaktivera och ta bort annons genom hela flödet.
- Verifiera varje steg och kategori: grunddata, plats/arbetsform, anställningsform och tider, lön, förmåner, frågor, media, mobil-/datorförhandsvisning samt sammanfattning.
- Testa mallens skapa/redigera/använd/radera-flöde och att mallvärden förs över korrekt till en ny annons utan förlust eller stale state.
- Kontrollera validering, felåterhämtning, behörigheter, cache/realtime och extremt långa värden i både mobil- och desktopwizard.

### 4. Verifiera hela arbetsgivarprodukten områdesvis
Kör en roll- och funktionsmatris för:
- Dashboard och statistik
- Mina annonser och annonsdetaljer
- Kandidater och Mina kandidater, inklusive listor, steg och kollegors åtkomst
- Chatt, mallar, automatiska regler och utskick
- Intervjuer
- Analys och rapporter
- Notiser
- Personlig profil, företagsprofil, recensioner, team och inställningar
- Support samt adminskyddade sidor

För varje område verifieras läsning, skapande, ändring, radering, tomt läge, felläge, offline/återanslutning där relevant, organisationsisolering och rätt ägare/roll. Fynd åtgärdas i sin grundorsak och syskonflöden med samma antagande kontrolleras samtidigt.

### 5. Åtgärda den separata team-blockeraren
- Ersätt den falska framgångstoasten med ett verkligt, säkert organisationsbundet inbjudningsflöde via backend och appens mejlsystem.
- Säkerställ att endast behörig arbetsgivare kan bjuda in, att roller inte kan själveskaleras, att dubbletter hanteras och att acceptans kopplar användaren till rätt organisation.
- Verifiera inbjudan, acceptans, rolländring och borttagning end-to-end.

### 6. Betalning behandlas som ett eget återstående lanseringsprojekt
- Redovisa betalning som ofärdig tills riktig checkout, webhookhantering, abonnemangsstatus, kundportal, kort- och fakturavyer är inkopplade.
- Ta bort all falsk exempeldata och alla döda betalningsknappar när betalningsarbetet genomförs.
- Följ den befintliga juridiska checklistan innan aktivering: policy, DPA, registerförteckning, versionsnummer, lagringstid och 30 dagars information om nytt underbiträde.

## Teknisk verifiering
- Lägg fokuserade tester för fulltextbevarande, extrema strängar, wizardens stegdata, mallöverföring och behörighetskritiska handlingar.
- Kör befintliga relevanta enhets- och flödestester samt backend-linter/säkerhetskontroll utan att ändra orelaterade fynd.
- Kör autentiserade webbläsartester i minst 320 px mobil, Android-lik mobil, iPad stående, iPad liggande, 1180 px brytpunkt och 1463 px desktop.
- Mät horisontell overflow i DOM, kontrollera tooltips visuellt och verifiera att inga konsol- eller nätverksfel uppstår.
- Slutrapportera per område som **verifierat**, **åtgärdat**, **blockerat** eller **kvarstår** med konkret testbevis. Ingen ny 1–10-bedömning ges förrän denna matris är körd.

## Avgränsning och ärlig leveransstatus
- Betalning implementeras inte i samma arbete utan ett separat godkännande, eftersom det kräver leverantörsaktivering och juridiska ändringar.
- Textsäkerhet, wizard/mallar, teaminbjudan och övrig arbetsgivarverifiering kan slutföras nu.
- “Klar” betyder efter detta inte bara att kod finns, utan att de centrala flödena har körts med rätt roller och bekräftats i UI, nätverk och backend.
