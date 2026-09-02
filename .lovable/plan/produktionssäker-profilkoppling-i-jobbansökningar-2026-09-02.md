# Produktionssäker profilkoppling i jobbansökningar

## Målbild

Jobbsökaren ska alltid veta vilken av sina tre profiler som skickas. Valet ska vara snabbt, förvalt och identiskt i vanlig ansökan och snabbansökan. När ansökan har skickats ska exakt den valda profilens CV, bild och video förbli tillgängliga för arbetsgivaren även om kandidaten senare byter media, byter standardprofil eller tar bort profilen.

## Beslutat användarflöde

1. Standardprofilen är förvald när ansökan öppnas.
2. På sista granskningsytan visas en kompakt rad: **Du söker med: [profilnamn]**.
3. Tryck på raden öppnar en snabb profilmeny med **Min profil** och de sparade extraprofilerna.
4. Varje alternativ visar profilnamn och om CV, bild och video finns, så att fel profil inte skickas av misstag.
5. Valet finns på samma plats och fungerar likadant i både vanlig ansökan och snabbansökan.
6. Om användaren bara har **Min profil** visas ingen onödig väljare.
7. Om en vald profil tas bort i en annan flik före skickning återgår valet tydligt till standardprofilen; ansökan skickas aldrig tyst med en ogiltig profil.
8. Efter lyckad ansökan blir profilnamn, CV, bild och video en historisk ögonblicksbild. Senare profiländringar påverkar inte ansökan.

## Genomförande

### 1. Gemensam logik för profilval

- Skapa en liten gemensam hook för att läsa profiler, välja standardprofil, hantera **Min profil** och reagera på ändringar/radering i realtid.
- Låt både den vanliga ansökan och snabbansökan använda samma hook, så att reglerna inte kan glida isär.
- Behåll senaste giltiga val under den öppna ansökan, men ändra inte användarens globala standardprofil bara för att en annan profil väljs för ett enskilt jobb.
- Flytta den nuvarande stora profilväljaren ur sektionen **Personuppgifter** och ersätt den med den kompakta granskningsraden nära **Skicka ansökan**.
- Utöka snabbansökans befintliga granskningssteg med samma profilrad. För jobb utan frågor visas raden direkt ovanför skickaknappen.

### 2. Backend som enda källa till sanning

- Lägg till `candidate_profile_id` på `job_applications` som en valfri referens till `candidate_profiles`, med `ON DELETE SET NULL`.
- Behåll `candidate_profile_label` som fryst historisk text. Profilens namn ska därför fortfarande visas korrekt efter namnbyte eller radering.
- Lägg till backendvalidering vid skapande av ansökan:
  - vald extraprofils id måste tillhöra den inloggade kandidaten,
  - backend hämtar själv profilens aktuella CV-, bild- och videosökvägar,
  - klienten får inte kunna ange en annan användares profil eller blanda media från flera profiler,
  - för **Min profil** hämtas grundprofilens media enligt samma regel,
  - snapshots och frågeögonblicksbild skapas i samma databastransaktion som ansökan.
- Gör snapshotfält, sökandeidentitet och valt profil-id oföränderliga efter att ansökan skapats. Arbetsgivaren ska endast kunna ändra tillåtna processfält, exempelvis status.
- Lägg index på `candidate_profile_id`, `profile_image_snapshot_url` och `video_snapshot_url`; CV-index finns redan. Det håller referenskontroller snabba även vid stor volym.

### 3. Riktiga, hållbara snapshots utan onödig filduplicering

Vi kopierar inte varje video och CV för varje ansökan. Det skulle mångdubbla lagring och kostnad vid stor skala. I stället används unika, oföränderliga filsökvägar och referenssäker retention:

- En ny uppladdning får alltid en ny unik sökväg; befintliga filer skrivs aldrig över.
- Ansökan sparar sökvägen som gällde när den skickades.
- Direkt fysisk filradering tas bort från profilradering och mediabyte.
- Filer får bara tas bort när de inte längre refereras av `profiles`, `candidate_profiles`, `job_applications`, CV-analyser eller andra kända källor.
- Inför en liten kö för filer som kan städas. Profilborttagning och mediabyte lägger kandidaten i kön; en backendfunktion kontrollerar samtliga referenser igen precis före fysisk radering.
- Den befintliga veckovisa fullskanningen behålls som säkerhetsnät, inte som primär städmekanism. Det gör normal städning proportionell mot antalet ändrade filer i stället för hela lagringsmängden.
- Videons posterbild behandlas som en del av videon och behålls/raderas tillsammans med den.

Detta ger samma historiska garanti som en fysisk kopia per ansökan, men utan att samma stora video behöver lagras hundratals gånger.

### 4. Säkra profiluppladdningar och profilradering

- Stoppa SVG centralt i mediahanteraren för profilbilder, coverbilder, företagslogotyper och jobbilder; SVG ska inte kunna passera genom en alternativ uppladdningsväg.
- Byt `image/*` i berörda filväljare mot en explicit lista över godkända bildformat. Användaren ska få ett tydligt fel innan bildredigeraren öppnas.
- Lägg samma validering före skapande av lokala object-URL:er i profil, onboarding och profilredigeraren.
- Varje uppladdning får ett eget `AbortController` och fångar profil-id:t som gällde när uppladdningen startade.
- Vid profilradering avbryts alla lokalt kända uppladdningar till profilen.
- Före slutlig databasuppdatering verifieras att profilen fortfarande finns och ägs av användaren. En uppdatering som träffar noll rader behandlas som avbruten, inte som lyckad.
- Om en fil hinner laddas upp men profilen raderas i en annan flik sparas ingen profilreferens; filen hamnar i städkön och användaren får inte ett falskt **Sparat**-läge.
- Profilbyte under uppladdning fortsätter att binda resultatet till ursprungsprofilen, inte den profil som råkar vara aktiv när uppladdningen blir klar.

### 5. Offline och samtidighet

- Den vanliga ansökans offlinekö sparar hela snapshot-payloaden och valt profil-id vid köögonblicket.
- Vid senare synkning ska backend använda den frysta payloaden om profilen därefter ändrats eller tagits bort; kön får inte byta till en ny standardprofil i smyg.
- Dubbla submit-försök fortsätter stoppas av befintlig unikhetsregel och submit-lås.
- Samtidig profilradering och ansökan hanteras transaktionellt: antingen skapas en komplett ansökan med giltig snapshot, eller så avvisas den med ett begripligt fel och kan skickas igen efter nytt profilval.

## Tekniska ändringsytor

- Databas: `job_applications`, snapshot-/valideringstrigger eller en strikt ansökningsfunktion, index och mediastädkö med RLS/GRANT.
- Ansökan: `JobApplication.tsx`, `SwipeApplySheet.tsx`, `ApplicationQuestionsWizard.tsx`, `useApplySubmit.ts` och offlinekön.
- Profiler: `useCandidateProfiles.ts`, `ProfileSwitcherRail.tsx`, `Profile.tsx`, `CandidateProfileEditor.tsx` och `WelcomeTunnel.tsx`.
- Media: central MIME-validering i `mediaManager.ts`/`useResilientUpload.ts`, filväljarens accept-listor och `purge-orphaned-media`.
- Arbetsgivarvyer behöver ingen visuell förändring; de fortsätter läsa snapshotfälten.

## Tester och godkännandekriterier

### Automatiska tester

- Standardprofil väljs korrekt i båda ansökningsflödena.
- Byte av profil på granskningssteget ändrar CV, bild, video, etikett och profil-id atomiskt.
- Manipulerat profil-id från en annan användare avvisas av backend.
- Historisk ansökan behåller sina filer efter mediabyte, profilradering och veckovis städning.
- Filen raderas först när sista databasreferensen är borta.
- SVG nekas i alla centrala bildflöden, även med förfalskad filändelse.
- Pågående uppladdning + profilbyte sparar till ursprungsprofilen.
- Pågående uppladdning + profilradering ger ingen sen uppdatering och inget falskt lyckat tillstånd.
- Offlineansökan behåller profilen som valdes när den köades.
- Befintliga äldre ansökningar utan `candidate_profile_id` fortsätter fungera.

### E2E i riktig webbläsare

1. Skapa tre profiler med olika CV, bild och video.
2. Skicka en vanlig ansökan med profil två och en snabbansökan med profil tre.
3. Kontrollera arbetsgivarvyn för båda ansökningarna.
4. Byt media och ta bort profilerna.
5. Kontrollera igen att arbetsgivaren fortfarande ser exakt ursprungligt material.
6. Testa mobil, iPad och desktop samt långsam uppkoppling, profilbyte under upload och offlinekö.

## Klart när

- Profilvalet är synligt och konsekvent i båda flödena.
- Ingen ansökan kan innehålla blandade eller obehöriga profilfiler.
- Historiska ansökningar förlorar aldrig CV, bild eller video vid normal profilhantering.
- SVG och sena race-skrivningar är blockerade i både UI och central logik.
- Databasmigration, enhetstester, integrationstester, E2E och säkerhetskontroll går igenom utan nya kritiska fynd.